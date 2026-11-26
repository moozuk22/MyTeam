import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const tx = { sentMessage: { create: vi.fn() }, sentMessageRecipient: { createMany: vi.fn() } };
  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      sentMessage: { findMany: vi.fn() },
      club: { findMany: vi.fn() },
      coachGroup: { findMany: vi.fn() },
      player: { findMany: vi.fn() },
    },
  };
});
vi.mock("@/lib/db", () => ({ prisma: db.prisma }));

import {
  listSentMessageFilterOptions,
  listSentMessages,
  recordSentMessage,
  SENT_MESSAGES_PAGE_SIZE,
  sentMessageViewer,
} from "./sentMessages";

const clubId = "11111111-1111-4111-8111-111111111111";
const groupId = "22222222-2222-4222-8222-222222222222";
const playerId = "33333333-3333-4333-8333-333333333333";

function row(id: string) {
  return {
    id, audience: "players", body: "Hello", imageUrl: null, clubIds: [clubId], coachGroupIds: [groupId],
    recipientCount: 1, sentAt: new Date("2026-11-26T10:00:00Z"), recipients: [{ playerId, playerName: "Иван" }],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  db.prisma.$transaction.mockImplementation((callback: (tx: typeof db.tx) => unknown) => callback(db.tx));
  db.tx.sentMessage.create.mockResolvedValue({ id: "message" });
  db.prisma.club.findMany.mockResolvedValue([{ id: clubId, name: "Клуб" }]);
  db.prisma.coachGroup.findMany.mockResolvedValue([{ id: groupId, name: "U12" }]);
  db.prisma.player.findMany.mockResolvedValue([]);
});

describe("recordSentMessage", () => {
  it("skips messages without a sender", async () => {
    await recordSentMessage({ senderUserId: undefined, audience: "players", body: "Hello" });
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("saves recipients in bounded chunks and removes duplicate scope IDs", async () => {
    const recipients = Array.from({ length: 2500 }, (_, index) => ({ playerId: `p${index}`, playerName: ` Name ${index} ` }));
    await recordSentMessage({ senderUserId: "user", audience: "players", body: "Hello", clubIds: [clubId, clubId], recipients });
    expect(db.tx.sentMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ senderUserId: "user", clubIds: [clubId], coachGroupIds: [], recipientCount: 2500 }),
    }));
    expect(db.tx.sentMessageRecipient.createMany.mock.calls.map(([args]) => args.data.length)).toEqual([1000, 1000, 500]);
    expect(db.tx.sentMessageRecipient.createMany.mock.calls[0][0].data[0]).toEqual({ messageId: "message", playerId: "p0", playerName: "Name 0" });
  });

  it("does not throw when the history cannot be saved", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    db.prisma.$transaction.mockRejectedValue(new Error("database unavailable"));
    await expect(recordSentMessage({ senderUserId: "user", audience: "coaches", body: "Hello" })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});

describe("sentMessageViewer", () => {
  it.each([
    [{ sub: "u", roles: ["admin", "coach"] }, { userId: "u", view: "admin" }],
    [{ sub: "u", roles: ["coach"] }, { userId: "u", view: "coach" }],
    [null, null],
  ])("maps %j", (session, expected) => {
    expect(sentMessageViewer(session as never)).toEqual(expected);
  });
});

describe("listSentMessages", () => {
  it("always limits results to the sender and lets admins filter by club and player", async () => {
    db.prisma.sentMessage.findMany.mockResolvedValue([row("m1")]);
    const result = await listSentMessages({ userId: "admin", view: "admin" }, { clubId, coachGroupId: groupId, playerId });
    expect(db.prisma.sentMessage.findMany.mock.calls[0][0].where).toEqual({
      senderUserId: "admin", clubIds: { has: clubId }, recipients: { some: { playerId } },
    });
    expect(result).toEqual({
      nextCursor: null,
      messages: [{
        id: "m1", audience: "players", body: "Hello", imageUrl: null, sentAt: "2026-11-26T10:00:00.000Z", recipientCount: 1,
        clubs: [{ id: clubId, name: "Клуб" }], coachGroups: [{ id: groupId, name: "U12" }], recipients: [{ id: playerId, name: "Иван" }],
      }],
    });
  });

  it("lets coaches filter by coach group and ignores the club filter", async () => {
    db.prisma.sentMessage.findMany.mockResolvedValue([]);
    await listSentMessages({ userId: "coach", view: "coach" }, { clubId, coachGroupId: groupId });
    expect(db.prisma.sentMessage.findMany.mock.calls[0][0].where).toEqual({ senderUserId: "coach", coachGroupIds: { has: groupId } });
  });

  it("returns a cursor only when another page exists", async () => {
    db.prisma.sentMessage.findMany.mockResolvedValue(Array.from({ length: SENT_MESSAGES_PAGE_SIZE + 1 }, (_, index) => row(`m${index}`)));
    const result = await listSentMessages({ userId: "admin", view: "admin" }, {}, "cursor-id");
    expect(db.prisma.sentMessage.findMany.mock.calls[0][0]).toMatchObject({ cursor: { id: "cursor-id" }, skip: 1, take: SENT_MESSAGES_PAGE_SIZE + 1 });
    expect(result.messages).toHaveLength(SENT_MESSAGES_PAGE_SIZE);
    expect(result.nextCursor).toBe(`m${SENT_MESSAGES_PAGE_SIZE - 1}`);
  });
});

describe("listSentMessageFilterOptions", () => {
  it("offers coaches only groups and players from their own messages", async () => {
    db.prisma.$queryRaw.mockResolvedValue([{ id: groupId }]);
    db.prisma.coachGroup.findMany.mockResolvedValue([{ id: groupId, name: "U12", club: { name: "Клуб" } }]);
    db.prisma.player.findMany.mockResolvedValue([{ id: playerId, fullName: "Иван" }]);
    const result = await listSentMessageFilterOptions({ userId: "coach", view: "coach" }, { coachGroupId: groupId }, "Ив");
    expect(db.prisma.player.findMany.mock.calls[0][0].where).toEqual({
      sentMessageRecipients: { some: { message: { senderUserId: "coach", coachGroupIds: { has: groupId } } } },
      fullName: { contains: "Ив", mode: "insensitive" },
    });
    expect(result).toEqual({ clubs: [], coachGroups: [{ id: groupId, name: "U12", clubName: "Клуб" }], players: [{ id: playerId, name: "Иван" }] });
  });
});
