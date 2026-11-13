import { NextRequest, NextResponse } from "next/server";
import { authorizeTraining, UUID_RE } from "@/lib/exercise/access";
import {
  deleteTrainingPlanCategory,
  normalizeTrainingPlanCategoryName,
  renameTrainingPlanCategory,
} from "@/lib/exercise/categories";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; categoryId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const { id, categoryId } = await params;
  const session = await authorizeTraining(request, id);
  if (session instanceof NextResponse) return session;
  if (!UUID_RE.test(categoryId))
    return NextResponse.json({ error: "Невалидна категория." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const name = normalizeTrainingPlanCategoryName(body?.name);
  if (!name)
    return NextResponse.json(
      { error: "Въведете име на категорията до 60 знака." },
      { status: 400 },
    );

  const { status, ...result } = await renameTrainingPlanCategory(id, categoryId, name);
  return NextResponse.json(result, { status });
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const { id, categoryId } = await params;
  const session = await authorizeTraining(request, id);
  if (session instanceof NextResponse) return session;
  if (!UUID_RE.test(categoryId))
    return NextResponse.json({ error: "Невалидна категория." }, { status: 400 });

  const { status, ...result } = await deleteTrainingPlanCategory(id, categoryId);
  return NextResponse.json(result, { status });
}
