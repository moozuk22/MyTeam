import { NextRequest, NextResponse } from "next/server";
import { authorizeTraining } from "@/lib/exercise/access";
import { createTrainingPlanCategory, normalizeTrainingPlanCategoryName } from "@/lib/exercise/categories";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await authorizeTraining(request, id);
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => null);
  const name = normalizeTrainingPlanCategoryName(body?.name);
  if (!name)
    return NextResponse.json(
      { error: "Въведете име на категорията до 60 знака." },
      { status: 400 },
    );

  const { status, ...result } = await createTrainingPlanCategory(id, name);
  return NextResponse.json(result, { status });
}
