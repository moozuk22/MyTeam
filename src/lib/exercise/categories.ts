import { prisma } from "@/lib/db";
import { UUID_RE } from "@/lib/exercise/access";
import type { Prisma } from "@prisma/client";

function categoryScope(clubId: string) {
  return { OR: [{ clubId: null }, { clubId }] };
}

export function listTrainingPlanCategories(clubId: string) {
  return prisma.trainingPlanCategory.findMany({
    where: categoryScope(clubId),
    select: { id: true, name: true, clubId: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export function normalizeTrainingPlanCategoryName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!name || name.length > 60 || [...name].some((char) => char < " " || char === "\x7f")) return null;
  return name;
}

export async function isTrainingPlanCategoryAvailable(clubId: string, value: unknown) {
  if (typeof value !== "string" || !UUID_RE.test(value)) return false;
  return Boolean(await prisma.trainingPlanCategory.findFirst({
    where: { id: value, ...categoryScope(clubId) },
    select: { id: true },
  }));
}

export async function createTrainingPlanCategory(clubId: string, name: string) {
  const nameKey = name.toLocaleLowerCase("bg");
  return prisma.$transaction(async (tx) => {
    if (!(await lockCategoryClub(tx, clubId))) return { error: "Клубът не е намерен.", status: 404 };

    const existing = await tx.trainingPlanCategory.findFirst({
      where: { nameKey, ...categoryScope(clubId) },
      select: { id: true, name: true, clubId: true },
    });
    if (existing) return { category: existing, status: 200 };

    if (await tx.trainingPlanCategory.count({ where: { clubId } }) >= 100)
      return { error: "Можете да създадете до 100 категории за този клуб.", status: 400 };

    const category = await tx.trainingPlanCategory.create({
      data: { clubId, name, nameKey },
      select: { id: true, name: true },
    });
    return { category, status: 201 };
  });
}

export function renameTrainingPlanCategory(clubId: string, categoryId: string, name: string) {
  const nameKey = name.toLocaleLowerCase("bg");
  return prisma.$transaction(async (tx) => {
    if (!(await lockCategoryClub(tx, clubId))) return { error: "Клубът не е намерен.", status: 404 };

    const where = { id: categoryId, clubId };
    const category = await tx.trainingPlanCategory.findFirst({ where, select: { id: true } });
    if (!category) return categoryNotFound;

    const duplicate = await tx.trainingPlanCategory.findFirst({
      where: { id: { not: categoryId }, nameKey, ...categoryScope(clubId) },
      select: { id: true },
    });
    if (duplicate) return { error: "Вече има категория с това име.", status: 409 };

    const updated = await tx.trainingPlanCategory.updateMany({ where, data: { name, nameKey } });
    if (updated.count === 0) return categoryNotFound;
    return { category: { id: categoryId, name }, status: 200 };
  });
}

export async function deleteTrainingPlanCategory(clubId: string, categoryId: string) {
  // The category foreign key clears the assignment on affected plans atomically.
  const { count } = await prisma.trainingPlanCategory.deleteMany({ where: { id: categoryId, clubId } });
  return count ? { success: true, status: 200 } : categoryNotFound;
}

const categoryNotFound = { error: "Категорията на клуба не е намерена.", status: 404 };

async function lockCategoryClub(tx: Pick<Prisma.TransactionClient, "$queryRaw">, clubId: string) {
  // Creation and renaming both check for duplicate names within the club.
  const clubs = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM clubs WHERE id = ${clubId}::uuid FOR UPDATE
  `;
  return clubs.length > 0;
}
