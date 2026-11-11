import dotenv from "dotenv";
import { PrismaClient, Prisma } from "@prisma/client";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

const PAGE_SIZE = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HELP = `Read-only training audit (grouped text to stdout; --format json for full details).
Usage: node scripts/report-training-scope.mjs --since <deployment timestamp> [--until <timestamp>] [--club-id <UUID>] [--format text|json]
Timestamps must include seconds and a timezone, e.g. 2026-11-07T21:35:00+02:00.
The range is [since, until); until defaults to the audit start time.
Uses DATABASE_URL from the environment or .env. Includes all clubs unless --club-id is supplied.
No records are changed. Coach-group scope indicates a review candidate, not a confirmed bug.`;

function timestamp(raw, label) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw ?? "")) {
    throw new Error(`${label} must be an ISO timestamp with seconds and timezone`);
  }
  const date = new Date(raw);
  const day = raw.slice(0, 10);
  const calendarDay = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== day) {
    throw new Error(`${label} is invalid`);
  }
  return date;
}

export function parseOptions(args, now = new Date()) {
  const { values } = parseArgs({ args, options: {
    since: { type: "string" }, until: { type: "string" },
    "club-id": { type: "string" }, format: { type: "string", default: "text" }, help: { type: "boolean" },
  } });
  if (values.help) return { help: true };
  const since = timestamp(values.since, "--since");
  const until = values.until ? timestamp(values.until, "--until") : now;
  if (since >= until) throw new Error("--since must be earlier than --until");
  if (values["club-id"] && !UUID.test(values["club-id"])) throw new Error("--club-id must be a UUID");
  if (!["text", "json"].includes(values.format)) throw new Error("--format must be text or json");
  return { since, until, clubId: values["club-id"], format: values.format };
}

function counts(rows) {
  return new Map(rows.map(row => [row.trainingSessionId, row._count._all]));
}

export async function readPage(tx, options, cursor) {
  // Enforce read-only access at the PostgreSQL transaction level as well as in code.
  await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
  const sessions = await tx.trainingSession.findMany({
    where: { createdAt: { gte: options.since, lt: options.until }, ...(options.clubId ? { clubId: options.clubId } : {}) },
    orderBy: { id: "asc" }, take: PAGE_SIZE,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, clubId: true, scopeType: true, scopeKey: true, scopeId: true,
      teamGroup: true, teamGroups: true, trainingDate: true, trainingTime: true,
      trainingDurationMinutes: true, status: true, createdAt: true, updatedAt: true,
      rosterLockedAt: true, recurrenceId: true, note: true,
      club: { select: { name: true } }, _count: { select: { players: true } } },
  });
  if (!sessions.length) return { rows: [], cursor: null };
  const ids = sessions.map(s => s.id);
  const clubIds = [...new Set(sessions.map(s => s.clubId))];
  const scopeIds = [...new Set(sessions.map(s => s.scopeId).filter(Boolean))];
  const [coaches, customGroups, trainingGroups] = await Promise.all([
    tx.coachGroup.findMany({ where: { clubId: { in: clubIds }, id: { in: scopeIds } }, select: { id: true, clubId: true, name: true } }),
    tx.clubCustomTrainingGroup.findMany({ where: { clubId: { in: clubIds }, id: { in: scopeIds } }, select: { id: true, clubId: true, name: true, coachGroup: { select: { id: true, clubId: true, name: true } } } }),
    tx.clubTrainingScheduleGroup.findMany({ where: { clubId: { in: clubIds }, id: { in: scopeIds } }, select: { id: true, clubId: true, name: true } }),
  ]);
  const names = new Map([
    ...coaches.map(g => [`${g.clubId}:coachGroup:${g.id}`, g.name]),
    ...customGroups.map(g => [`${g.clubId}:customGroup:${g.id}`, g.name]),
    ...trainingGroups.map(g => [`${g.clubId}:trainingGroup:${g.id}`, g.name]),
  ]);
  const coachByScope = new Map([
    ...coaches.map(g => [`${g.clubId}:coachGroup:${g.id}`, g]),
    ...customGroups.filter(g => g.coachGroup?.clubId === g.clubId)
      .map(g => [`${g.clubId}:customGroup:${g.id}`, g.coachGroup]),
  ]);
  const groupBy = where => tx.trainingSessionPlayer.groupBy({
    by: ["trainingSessionId"], where: { trainingSessionId: { in: ids }, ...where }, _count: { _all: true },
  });
  const [recorded, charged, absences, events] = await Promise.all([
    groupBy({ attendanceRecorded: true }),
    groupBy({ creditChargedAt: { not: null } }),
    groupBy({ OR: [{ present: false }, { reasonCode: { not: null } }, { reasonText: { not: null } }] }),
    tx.limitedTrainingEvent.findMany({ where: { OR: sessions.map(s => ({
      clubId: s.clubId, trainingDate: s.trainingDate,
      scopeKey: { in: [s.scopeKey, `${s.scopeKey}:session:${s.id}`] },
    })) }, select: { id: true, clubId: true, scopeKey: true, trainingDate: true, _count: { select: { registrations: true } } } }),
  ]);
  const recordedCounts = counts(recorded), chargedCounts = counts(charged), absenceCounts = counts(absences);
  const eventsByKey = new Map(events.map(e => [`${e.clubId}|${e.scopeKey}|${e.trainingDate.toISOString().slice(0, 10)}`, e]));
  return {
    cursor: sessions.at(-1).id,
    rows: sessions.map(s => {
      const date = s.trainingDate.toISOString().slice(0, 10);
      const linkedEvents = [s.scopeKey, `${s.scopeKey}:session:${s.id}`]
        .map(key => eventsByKey.get(`${s.clubId}|${key}|${date}`)).filter(Boolean);
      return {
        id: s.id, clubId: s.clubId, clubName: s.club.name,
        createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
        date, trainingTime: s.trainingTime, durationMinutes: s.trainingDurationMinutes,
        status: s.status, scopeType: s.scopeType, scopeKey: s.scopeKey, scopeId: s.scopeId,
        groupName: names.get(`${s.clubId}:${s.scopeType}:${s.scopeId}`) ?? (s.scopeType === "club" ? s.club.name : null),
        coachGroupId: coachByScope.get(`${s.clubId}:${s.scopeType}:${s.scopeId}`)?.id ?? null,
        coachGroupName: coachByScope.get(`${s.clubId}:${s.scopeType}:${s.scopeId}`)?.name ?? null,
        teamGroup: s.teamGroup, teamGroups: s.teamGroups,
        coachGroupReviewCandidate: s.scopeType === "coachGroup",
        rosterCount: s._count.players, recordedAttendanceCount: recordedCounts.get(s.id) ?? 0,
        chargedRosterCount: chargedCounts.get(s.id) ?? 0, absenceOrReasonCount: absenceCounts.get(s.id) ?? 0,
        rosterLocked: Boolean(s.rosterLockedAt), hasNote: Boolean(s.note), recurrenceId: s.recurrenceId,
        // Date-level events may cover multiple sessions; report them without claiming exclusive ownership.
        reservationEvents: linkedEvents.map(e => ({ id: e.id, scopeKey: e.scopeKey, registrations: e._count.registrations })),
      };
    }),
  };
}

export async function collectReport(db, options) {
  const rows = [];
  let cursor;
  do {
    const page = await db.$transaction(tx => readPage(tx, options, cursor), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000,
    });
    rows.push(...page.rows);
    cursor = page.rows.length === PAGE_SIZE ? page.cursor : null;
  } while (cursor);
  rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return { readOnly: true, since: options.since.toISOString(), untilExclusive: options.until.toISOString(),
    clubId: options.clubId ?? null, total: rows.length,
    coachGroupReviewCandidates: rows.filter(r => r.coachGroupReviewCandidate).length,
    limitations: ["Created timestamp is not the training date. Use the actual deployment timestamp as the cutoff.",
      "Coach-group entries are candidates, not confirmed errors. The intended custom group cannot be inferred from this report.",
      "Deleted sessions are not recoverable here. Counts reflect current data, with a separate read-only snapshot per page.",
      "Activity counts are review aids, not permission to delete. No player names, card codes or note contents are included."],
    trainings: rows };
}

export function formatReport(report) {
  const clubs = new Map();
  for (const training of report.trainings) {
    if (!clubs.has(training.clubId)) clubs.set(training.clubId, { name: training.clubName, groups: new Map() });
    const club = clubs.get(training.clubId);
    const key = training.coachGroupId ?? "none";
    if (!club.groups.has(key)) club.groups.set(key, { name: training.coachGroupName ?? "Без треньорска група", trainings: [] });
    club.groups.get(key).trainings.push(training);
  }
  const lines = [`Създадени от ${report.since} до ${report.untilExclusive} (краят не е включен)`, `Общо тренировки: ${report.total}`, ""];
  const clean = value => String(value).replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");
  for (const club of [...clubs.values()].sort((a, b) => a.name.localeCompare(b.name, "bg"))) {
    lines.push(`Клуб: ${clean(club.name)}`);
    for (const group of [...club.groups.values()].sort((a, b) => a.name.localeCompare(b.name, "bg"))) {
      lines.push(`  Треньорска група: ${clean(group.name)}`, "  Тренировки:");
      for (const t of group.trainings.sort((a, b) => a.date.localeCompare(b.date) || (a.trainingTime ?? "").localeCompare(b.trainingTime ?? "") || a.id.localeCompare(b.id))) {
        const [year, month, day] = t.date.split("-");
        const label = t.scopeType !== "coachGroup" && t.groupName ? ` · ${clean(t.groupName)}` : "";
        const status = t.status === "cancelled" ? " · отменена" : t.status === "scheduled" ? "" : ` · ${clean(t.status)}`;
        lines.push(`    - ${day}.${month}.${year} ${clean(t.trainingTime ?? "без час")}${label}${status} [${clean(t.id)}]`);
      }
    }
    lines.push("");
  }
  if (!report.total) lines.push("Няма тренировки за избрания период.");
  lines.push("Списъкът е само за преглед. Не всички тренировки в него са засегнати от грешката.");
  return lines.join("\n");
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) { console.log(HELP); return; }
  dotenv.config({ quiet: true });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const url = new URL(process.env.DATABASE_URL);
  console.error(`Read-only target: ${url.hostname}:${url.port || "5432"}/${url.pathname.slice(1)}`);
  const db = new PrismaClient();
  try {
    const report = await collectReport(db, options);
    console.log(options.format === "json" ? JSON.stringify(report, null, 2) : formatReport(report));
  }
  finally { await db.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("Audit failed. Check arguments (--help), DATABASE_URL, connectivity and schema. No data changes are performed by this script.");
    process.exitCode = 1;
  });
}
