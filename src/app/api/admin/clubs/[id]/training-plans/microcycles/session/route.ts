import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTraining } from "@/lib/exercise/access";
import { TrainingImageError } from "@/lib/exercise/imageStorage";
import { sessionTarget } from "@/lib/exercise/trainingSession";
import { trainingReference } from "@/lib/exercise/trainingSessionAccess";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await authorizeTraining(request, id);
  if (session instanceof NextResponse) return session;
  const target = sessionTarget(Object.fromEntries(request.nextUrl.searchParams));
  if (!target) return NextResponse.json({ error: "Невалидна тренировка." }, { status: 400 });
  try {
    return NextResponse.json(await trainingReference(prisma, id, request.nextUrl.searchParams.get("coachGroupId"), target, false), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof TrainingImageError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
