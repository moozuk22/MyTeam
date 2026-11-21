import { NextRequest, NextResponse } from "next/server";
import { coachAuthor } from "@/lib/exercise/trainingSessionAccess";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authorizeTraining, findTrainingPlanCoachGroup, UUID_RE } from "@/lib/exercise/access";
import { microcycleGroups } from "@/lib/exercise/microcycleGroups";
import { monday, parseCycle } from "@/lib/exercise/microcycle";
import { currentCompetitionSeason } from "@/lib/exercise/document";
type Context = { params: Promise<{ id: string }> };
async function scope(request: NextRequest, id: string, write = false) {
  const auth = await authorizeTraining(request, id, write ? "save" : "read");
  if (auth instanceof NextResponse) return auth;
  const coach = request.nextUrl.searchParams.get("coachGroupId") ?? undefined;
  if (coach !== undefined && (!UUID_RE.test(coach) || !await findTrainingPlanCoachGroup(id, coach))) return NextResponse.json({ error: "Невалидна група." }, { status: 404 });
  if (write && coach !== undefined) return NextResponse.json({ error: "Този изглед е само за четене." }, { status: 403 });
  const result = await microcycleGroups(id, coach);
  return result ?? NextResponse.json({ error: "Няма такъв клуб." }, { status: 404 });
}
export async function GET(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const result = await scope(request, id);
  if (result instanceof NextResponse) return result;
  let week: string;
  try {
    week = monday(request.nextUrl.searchParams.get("week") ?? "");
  } catch {
    return NextResponse.json({ error: "Невалидна седмица." }, { status: 400 });
  }
  try {
    const coach = request.nextUrl.searchParams.has("coachGroupId");
    const modern = request.nextUrl.searchParams.get("version") === "2";
    const cycles = await prisma.trainingMicrocycle.findMany({ where: { clubId: id, week, ...(coach ? { groupKey: { in: result.groups.map(g => g.key) } } : {}) }, include: { documents: { select: { rowId: true, groupKey: true, document: { select: { id: true, ownerId: true } } } } } });
    const coachId = request.nextUrl.searchParams.get("coachGroupId");
    const active = new Set(result.groups.map(g => g.key));
    return NextResponse.json({ ...result, cycles: cycles.map(({ documents, ...cycle }) => {
      const content = parseCycle(cycle.content);
      if (!modern) {
        const { rows, format, age, season, half, number, saturday, sunday } = content;
        return { ...cycle, content: { format, age, season, half, number, saturday, sunday, rows: rows.map(row => row.cells) } };
      }
      const canLink = !!coachId && active.has(cycle.groupKey);
      const links = canLink ? Object.fromEntries(documents.filter(d => d.groupKey === cycle.groupKey)
        // A plan of another author is hidden. The training shows only that it has a plan.
        .map(d => [d.rowId, d.document.ownerId === coachAuthor(coachId!) ? d.document.id : null])) : {};
      return { ...cycle, content, canLink, links };
    }) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Микроциклите не могат да бъдат заредени. Опитайте отново." }, { status: 500 }); }
}
async function mutate(request: NextRequest, { params }: Context, remove: boolean) {
  const { id } = await params;
  const result = await scope(request, id, true);
  if (result instanceof NextResponse) return result;
  try {
    const body = await request.json();
    const week = monday(body.week);
    if (week !== body.week || typeof body.groupKey !== "string" || !Number.isInteger(body.revision) || body.revision < 0) throw new Error("Невалидни данни.");
    const group = result.groups.find(g => g.key === body.groupKey);
    if (!group && !remove) return NextResponse.json({ error: "Групата вече не е налична." }, { status: 404 });
    const where = { clubId: id, groupKey: body.groupKey, week, revision: body.revision };
    if (remove) {
      const deleted = await prisma.trainingMicrocycle.deleteMany({ where });
      if (!deleted.count) return NextResponse.json({ error: "Микроцикълът е променен. Презаредете страницата." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    if (body.content?.version !== 2) return NextResponse.json({ error: "Презаредете страницата, за да редактирате микроцикъла." }, { status: 409 });
    const content = parseCycle(body.content);
    if (body.revision === 0) {
      const season = currentCompetitionSeason();
      content.season = season.season; content.half = season.halfSeason;
      content.rows = content.rows.map(row => ({ ...row, id: randomUUID() }));
      const cycle = await prisma.trainingMicrocycle.create({ data: { clubId: id, groupKey: group!.key, groupName: group!.name, week, content } });
      return NextResponse.json(cycle, { status: 201 });
    }
    return await prisma.$transaction(async tx => {
      const previous = await tx.trainingMicrocycle.findFirst({ where });
      const conflict = () => NextResponse.json({ error: "Микроцикълът е променен. Презаредете страницата." }, { status: 409 });
      if (!previous) return conflict();
      const stored = parseCycle(previous.content);
      content.season = stored.season; content.half = stored.half;
      const existing = new Set(stored.rows.map(row => row.id));
      content.rows = content.rows.map(row => existing.has(row.id) ? row : { ...row, id: randomUUID() });
      const changed = await tx.trainingMicrocycle.updateMany({ where, data: { content, revision: { increment: 1 } } });
      if (!changed.count) return conflict();
      await tx.trainingSessionDocument.deleteMany({ where: { cycleId: previous.id, rowId: { notIn: content.rows.map(row => row.id) } } });
      return NextResponse.json({ revision: body.revision + 1, content });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Вече има микроцикъл за тази група и седмица. Презаредете страницата." }, { status: 409 });
    return NextResponse.json({ error: error instanceof SyntaxError ? "Невалидни данни." : "Микроцикълът не може да бъде записан. Проверете данните." }, { status: 400 });
  }
}
export const POST = (r: NextRequest, c: Context) => mutate(r, c, false);
export const DELETE = (r: NextRequest, c: Context) => mutate(r, c, true);
