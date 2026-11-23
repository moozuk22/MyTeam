import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTraining, UUID_RE } from "@/lib/exercise/access";
import { monday, parseCycle, type PastCycle } from "@/lib/exercise/microcycle";

/** One page of the list. */
const PAGE = 20;
/** The list goes back at most this far. */
const MAX_OFFSET = 1000;

type Row = { id: string; week: string; number: string | null; format: string | null; age: string | null; trainings: number | null; groups: string[]; own: boolean };

const like = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Microcycles of earlier weeks, the newest first. In each week the microcycles of `groupKey` come first.
 * With `cycleId`, it returns the content of one microcycle, so the methodist can use it in a new week.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await authorizeTraining(request, id);
  if (session instanceof NextResponse) return session;
  const search = request.nextUrl.searchParams;
  if (search.has("coachGroupId")) return NextResponse.json({ error: "Този изглед е само за четене." }, { status: 403 });
  const headers = { "Cache-Control": "private, no-store" };
  const cycleId = search.get("cycleId");
  if (cycleId !== null) {
    if (!UUID_RE.test(cycleId)) return NextResponse.json({ error: "Невалиден микроцикъл." }, { status: 400 });
    const cycle = await prisma.trainingMicrocycle.findFirst({ where: { id: cycleId, clubId: id }, select: { content: true } });
    if (!cycle) return NextResponse.json({ error: "Микроцикълът вече не е наличен." }, { status: 404 });
    return NextResponse.json({ content: parseCycle(cycle.content) }, { headers });
  }
  let week: string;
  try { week = monday(search.get("week") ?? ""); } catch { return NextResponse.json({ error: "Невалидна седмица." }, { status: 400 }); }
  const offset = Number(search.get("offset") ?? 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) return NextResponse.json({ error: "Невалидна страница." }, { status: 400 });
  const query = (search.get("q") ?? "").trim().slice(0, 200);
  const groupKey = (search.get("groupKey") ?? "").slice(0, 200);
  try {
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT c.id::text AS id, c.week, c.content->>'number' AS number, c.content->>'format' AS format, c.content->>'age' AS age,
        jsonb_array_length(c.content->'rows')::int AS trainings,
        array_agg(g.group_name ORDER BY g.group_name) AS groups,
        bool_or(g.group_key = ${groupKey}) AS own
      FROM training_microcycles c
      JOIN training_microcycle_groups g ON g.cycle_id = c.id AND g.club_id = c.club_id
      WHERE c.club_id = ${id}::uuid AND c.week < ${week}
      GROUP BY c.id
      HAVING ${query} = '' OR bool_or(g.group_name ILIKE ${like(query)})
      ORDER BY c.week DESC, own DESC, min(g.group_name), c.id
      LIMIT ${PAGE + 1} OFFSET ${offset}`;
    const cycles: PastCycle[] = rows.slice(0, PAGE).map(row => ({
      id: row.id, week: row.week, number: (row.number ?? "").slice(0, 40), format: (row.format ?? "").slice(0, 100),
      age: (row.age ?? "").slice(0, 100), trainings: row.trainings ?? 0, groups: row.groups.map(name => name.slice(0, 100)), own: row.own,
    }));
    return NextResponse.json({ cycles, more: rows.length > PAGE }, { headers });
  } catch { return NextResponse.json({ error: "Предишните микроцикли не могат да бъдат заредени. Опитайте отново." }, { status: 500 }); }
}
