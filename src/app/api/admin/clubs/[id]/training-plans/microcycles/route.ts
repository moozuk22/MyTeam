import { NextRequest, NextResponse } from "next/server";
import { coachAuthor } from "@/lib/exercise/trainingSessionAccess";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authorizeTraining, findTrainingPlanCoachGroup, UUID_RE } from "@/lib/exercise/access";
import { microcycleGroups } from "@/lib/exercise/microcycleGroups";
import { monday, parseCycle } from "@/lib/exercise/microcycle";
import { CycleConflict, RemovedLinks, removeCycle, saveCycle } from "@/lib/exercise/microcycleStore";
type Context = { params: Promise<{ id: string }> };
/** A club has fewer groups than this. The limit keeps one save bounded. */
const MAX_ADDED_GROUPS = 200;
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
    const coachId = request.nextUrl.searchParams.get("coachGroupId");
    const modern = request.nextUrl.searchParams.get("version") === "2";
    const usages = await prisma.trainingMicrocycleGroup.findMany({
      where: { clubId: id, week, ...(coachId !== null ? { groupKey: { in: result.groups.map(g => g.key) } } : {}) },
      select: {
        groupKey: true, groupName: true,
        cycle: { select: { id: true, revision: true, content: true, groups: { select: { groupKey: true, groupName: true } } } },
        documents: { select: { rowId: true, document: { select: { id: true, ownerId: true } } } },
      },
    });
    const active = new Set(result.groups.map(g => g.key));
    return NextResponse.json({ ...result, cycles: usages.map(({ documents, cycle, groupKey, groupName }) => {
      const content = parseCycle(cycle.content);
      const base = { id: cycle.id, clubId: id, week, groupKey, groupName, revision: cycle.revision };
      if (!modern) {
        const { rows, format, age, season, half, number, saturday, sunday } = content;
        return { ...base, content: { format, age, season, half, number, saturday, sunday, rows: rows.map(row => row.cells) } };
      }
      const canLink = !!coachId && active.has(groupKey);
      const links = canLink ? Object.fromEntries(documents
        // A plan of another author is hidden. The training shows only that it has a plan.
        .map(d => [d.rowId, d.document.ownerId === coachAuthor(coachId!) ? d.document.id : null])) : {};
      // A coach sees only their own groups. The other groups that use the microcycle stay hidden.
      const shared = coachId === null ? cycle.groups.filter(g => g.groupKey !== groupKey).map(g => ({ key: g.groupKey, name: g.groupName })) : [];
      return { ...base, content, canLink, links, shared };
    }) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Микроциклите не могат да бъдат заредени. Опитайте отново." }, { status: 500 }); }
}
/** Each added group has its key and the microcycle that the editor showed for it (`cycleId` null when it had none). */
function parseAddedGroups(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_ADDED_GROUPS) throw new Error("Невалидни данни.");
  return value.map(item => {
    const { key, cycleId, revision } = item ?? {};
    if (typeof key !== "string") throw new Error("Невалидни данни.");
    if (cycleId === null) return { key, expected: null };
    if (typeof cycleId !== "string" || !UUID_RE.test(cycleId) || !Number.isInteger(revision) || revision < 1) throw new Error("Невалидни данни.");
    return { key, expected: { id: cycleId, revision: revision as number } };
  });
}
async function mutate(request: NextRequest, { params }: Context, remove: boolean) {
  const { id } = await params;
  const result = await scope(request, id, true);
  if (result instanceof NextResponse) return result;
  // The request is checked before the transaction. An error after this point is not an error in the data.
  let stored = false;
  try {
    const body = await request.json();
    const week = monday(body.week);
    if (week !== body.week || typeof body.groupKey !== "string" || !Number.isInteger(body.revision) || body.revision < 0) throw new Error("Невалидни данни.");
    // The editor sends the microcycle that it opened, so a replaced microcycle with the same revision gives a conflict.
    if (body.revision > 0 && (typeof body.cycleId !== "string" || !UUID_RE.test(body.cycleId))) throw new Error("Невалидни данни.");
    // The number of plan links that the user accepted to remove, after a 409 with `removedLinks`.
    if (body.removedLinks !== undefined && (!Number.isSafeInteger(body.removedLinks) || body.removedLinks < 0)) throw new Error("Невалидни данни.");
    if (remove) {
      stored = true;
      await prisma.$transaction(tx => removeCycle(tx, id, week, body.groupKey, body.cycleId, body.revision, body.removedLinks ?? 0));
      return NextResponse.json({ ok: true });
    }
    const group = result.groups.find(g => g.key === body.groupKey);
    if (!group) return NextResponse.json({ error: "Групата вече не е налична." }, { status: 404 });
    if (body.content?.version !== 2) return NextResponse.json({ error: "Презаредете страницата, за да редактирате микроцикъла." }, { status: 409 });
    const added = parseAddedGroups(body.addGroups ?? []);
    const keys = added.map(item => item.key);
    if (new Set(keys).size !== keys.length || keys.includes(group.key) || (body.scope !== undefined && body.scope !== "group" && body.scope !== "all"))
      throw new Error("Невалидни данни.");
    const addGroups = added.flatMap(item => {
      const known = result.groups.find(g => g.key === item.key);
      return known ? [{ ...known, expected: item.expected }] : [];
    });
    if (addGroups.length !== added.length) return NextResponse.json({ error: "Някоя от избраните групи вече не е налична." }, { status: 404 });
    const content = parseCycle(body.content);
    stored = true;
    const saved = await prisma.$transaction(tx => saveCycle(tx, {
      clubId: id, week, group, revision: body.revision, cycleId: body.cycleId, content, scope: body.scope ?? "all", addGroups,
      confirmedLinks: body.removedLinks ?? 0,
    }));
    return NextResponse.json(saved, { status: body.revision === 0 ? 201 : 200 });
  } catch (error) {
    if (error instanceof CycleConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Вече има микроцикъл за тази група и седмица. Презаредете страницата." }, { status: 409 });
    if (error instanceof RemovedLinks)
      return NextResponse.json({ error: "Изтритите тренировки имат план-конспекти. Потвърдете, за да премахнете връзките.", removedLinks: error.count }, { status: 409 });
    if (stored) {
      console.error("Microcycle save failed", error instanceof Prisma.PrismaClientKnownRequestError ? error.code : error instanceof Error ? error.name : "unknown");
      return NextResponse.json({ error: "Микроцикълът не може да бъде записан. Опитайте отново." }, { status: 500 });
    }
    return NextResponse.json({ error: error instanceof SyntaxError ? "Невалидни данни." : "Микроцикълът не може да бъде записан. Проверете данните." }, { status: 400 });
  }
}
export const POST = (r: NextRequest, c: Context) => mutate(r, c, false);
export const DELETE = (r: NextRequest, c: Context) => mutate(r, c, true);
