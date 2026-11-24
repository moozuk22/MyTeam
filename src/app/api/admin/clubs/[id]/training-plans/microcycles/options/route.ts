import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTraining, findTrainingPlanCoachGroup, UUID_RE } from "@/lib/exercise/access";
import { microcycleGroups } from "@/lib/exercise/microcycleGroups";
import { monday, shiftWeek } from "@/lib/exercise/microcycle";
import { TRAINING_UUID_PATTERN } from "@/lib/trainingPlans";
import { getTodayIsoDateInTimeZone } from "@/lib/training";
import type { CycleOption, TrainingOptions } from "@/lib/exercise/trainingOptions";

/** Microcycles from the last year and later. The editor shows them as options for "Микроцикъл". */
const HISTORY_WEEKS = 53;
const MAX_CYCLES = 200;

type Row = { id: string; group_key: string; week: string; number: unknown; rows: unknown };

/** Lists the microcycles and training numbers of a coach's groups. It reads only the numbers and row IDs, not the training text. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await authorizeTraining(request, id);
  if (session instanceof NextResponse) return session;
  const coach = request.nextUrl.searchParams.get("coachGroupId");
  if (!coach || !UUID_RE.test(coach) || !await findTrainingPlanCoachGroup(id, coach))
    return NextResponse.json({ error: "Невалидна група." }, { status: 404 });
  const scope = await microcycleGroups(id, coach);
  if (!scope) return NextResponse.json({ error: "Няма такъв клуб." }, { status: 404 });
  const groups = scope.groups.filter(group => group.key.startsWith("custom:")).map(({ key, name }) => ({ key, name }));
  const keys = groups.map(group => group.key);
  // Weeks start on Monday in Sofia, as on the microcycle page.
  const from = shiftWeek(monday(getTodayIsoDateInTimeZone("Europe/Sofia")), -7 * HISTORY_WEEKS);
  const rows = keys.length ? await prisma.$queryRaw<Row[]>`
    SELECT c.id::text AS id, g.group_key, c.week, c.content->'number' AS number, jsonb_path_query_array(c.content, '$.rows[*].id') AS rows
    FROM training_microcycle_groups g
    JOIN training_microcycles c ON c.id = g.cycle_id AND c.club_id = g.club_id
    WHERE g.club_id = ${id}::uuid AND g.group_key = ANY(${keys}) AND g.week >= ${from}
    ORDER BY c.week DESC
    LIMIT ${MAX_CYCLES}` : [];
  const cycles: CycleOption[] = rows.flatMap(row => {
    if (typeof row.number !== "string" || row.number.length > 40 || !Array.isArray(row.rows)) return [];
    const ids = row.rows.filter((value): value is string => typeof value === "string" && TRAINING_UUID_PATTERN.test(value));
    return ids.length === row.rows.length
      ? [{ id: row.id, groupKey: row.group_key, week: row.week, number: row.number, rows: ids.map(value => value.toLowerCase()) }]
      : [];
  });
  const body: TrainingOptions = { groups, cycles };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
