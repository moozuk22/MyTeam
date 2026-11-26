import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AdminSessionPayload } from "@/lib/adminAuth";

export type SentMessageAudience = "players" | "coaches";

const RECIPIENT_CHUNK_SIZE = 1000;
export const SENT_MESSAGES_PAGE_SIZE = 20;
const RECIPIENT_PREVIEW_SIZE = 5;
const PLAYER_OPTION_LIMIT = 50;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

export type RecordSentMessageInput = {
  senderUserId: string | undefined;
  audience: SentMessageAudience;
  body: string;
  imageUrl?: string | null;
  clubIds?: string[];
  coachGroupIds?: string[];
  recipients?: { playerId: string; playerName: string }[];
  recipientCount?: number;
};

/**
 * Record a sent message in the history of the sender.
 * The message is already delivered, so a failure is logged and does not stop the request.
 */
export async function recordSentMessage(input: RecordSentMessageInput): Promise<void> {
  if (!input.senderUserId) return;
  const recipients = input.recipients ?? [];
  try {
    await prisma.$transaction(async (tx) => {
      const message = await tx.sentMessage.create({
        data: {
          senderUserId: input.senderUserId!,
          audience: input.audience,
          body: input.body,
          imageUrl: input.imageUrl ?? null,
          clubIds: [...new Set(input.clubIds ?? [])],
          coachGroupIds: [...new Set(input.coachGroupIds ?? [])],
          recipientCount: input.recipientCount ?? recipients.length,
        },
        select: { id: true },
      });
      for (let offset = 0; offset < recipients.length; offset += RECIPIENT_CHUNK_SIZE) {
        await tx.sentMessageRecipient.createMany({
          data: recipients.slice(offset, offset + RECIPIENT_CHUNK_SIZE).map((recipient) => ({
            messageId: message.id,
            playerId: recipient.playerId,
            playerName: recipient.playerName.trim(),
          })),
        });
      }
    });
  } catch (error) {
    console.error("Sent message history save error:", error);
  }
}

/** Admins filter by club. Coaches filter by coach group. A user with both roles uses the admin view. */
export type SentMessageViewer = { userId: string; view: "admin" | "coach" };

export function sentMessageViewer(session: AdminSessionPayload | null): SentMessageViewer | null {
  if (!session?.sub) return null;
  if (session.roles.includes("admin")) return { userId: session.sub, view: "admin" };
  if (session.roles.includes("coach")) return { userId: session.sub, view: "coach" };
  return null;
}

export type SentMessageFilters = { clubId?: string | null; coachGroupId?: string | null; playerId?: string | null };

function messageScope(viewer: SentMessageViewer, filters: SentMessageFilters): Prisma.SentMessageWhereInput {
  const where: Prisma.SentMessageWhereInput = { senderUserId: viewer.userId };
  if (viewer.view === "admin" && filters.clubId) where.clubIds = { has: filters.clubId };
  if (viewer.view === "coach" && filters.coachGroupId) where.coachGroupIds = { has: filters.coachGroupId };
  return where;
}

export async function listSentMessages(viewer: SentMessageViewer, filters: SentMessageFilters, cursor?: string | null) {
  const where = messageScope(viewer, filters);
  if (filters.playerId) where.recipients = { some: { playerId: filters.playerId } };

  const rows = await prisma.sentMessage.findMany({
    where,
    orderBy: [{ sentAt: "desc" }, { id: "desc" }],
    take: SENT_MESSAGES_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      audience: true,
      body: true,
      imageUrl: true,
      clubIds: true,
      coachGroupIds: true,
      recipientCount: true,
      sentAt: true,
      recipients: {
        orderBy: { playerName: "asc" },
        take: RECIPIENT_PREVIEW_SIZE,
        select: { playerId: true, playerName: true },
      },
    },
  });
  const page = rows.slice(0, SENT_MESSAGES_PAGE_SIZE);
  const clubIds = [...new Set(page.flatMap((row) => row.clubIds))];
  const groupIds = [...new Set(page.flatMap((row) => row.coachGroupIds))];
  const [clubs, groups] = await Promise.all([
    clubIds.length ? prisma.club.findMany({ where: { id: { in: clubIds } }, select: { id: true, name: true } }) : [],
    groupIds.length ? prisma.coachGroup.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } }) : [],
  ]);
  const clubNames = new Map(clubs.map((club) => [club.id, club.name]));
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));

  return {
    messages: page.map((row) => ({
      id: row.id,
      audience: row.audience,
      body: row.body,
      imageUrl: row.imageUrl,
      sentAt: row.sentAt.toISOString(),
      recipientCount: row.recipientCount,
      clubs: row.clubIds.map((id) => ({ id, name: clubNames.get(id) ?? null })),
      coachGroups: row.coachGroupIds.map((id) => ({ id, name: groupNames.get(id) ?? null })),
      recipients: row.recipients.map((recipient) => ({ id: recipient.playerId, name: recipient.playerName })),
    })),
    nextCursor: rows.length > SENT_MESSAGES_PAGE_SIZE ? page[page.length - 1]?.id ?? null : null,
  };
}

/** Filter options come only from the messages of the viewer. */
export async function listSentMessageFilterOptions(viewer: SentMessageViewer, filters: SentMessageFilters, search: string) {
  const scope = messageScope(viewer, filters);
  const playersPromise = prisma.player.findMany({
    where: {
      sentMessageRecipients: { some: { message: scope } },
      ...(search ? { fullName: { contains: search, mode: "insensitive" as const } } : {}),
    },
    orderBy: { fullName: "asc" },
    take: PLAYER_OPTION_LIMIT,
    select: { id: true, fullName: true },
  });

  if (viewer.view === "admin") {
    const [rows, players] = await Promise.all([
      prisma.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT unnest(club_ids)::text AS id FROM sent_messages WHERE sender_user_id = ${viewer.userId}`,
      playersPromise,
    ]);
    const clubs = rows.length
      ? await prisma.club.findMany({ where: { id: { in: rows.map((row) => row.id) } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : [];
    return { clubs, coachGroups: [], players: players.map((player) => ({ id: player.id, name: player.fullName })) };
  }

  const [rows, players] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT unnest(coach_group_ids)::text AS id FROM sent_messages WHERE sender_user_id = ${viewer.userId}`,
    playersPromise,
  ]);
  const groups = rows.length
    ? await prisma.coachGroup.findMany({
        where: { id: { in: rows.map((row) => row.id) } },
        orderBy: [{ club: { name: "asc" } }, { name: "asc" }],
        select: { id: true, name: true, club: { select: { name: true } } },
      })
    : [];
  return {
    clubs: [],
    coachGroups: groups.map((group) => ({ id: group.id, name: group.name, clubName: group.club.name })),
    players: players.map((player) => ({ id: player.id, name: player.fullName })),
  };
}
