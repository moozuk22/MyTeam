import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTraining, UUID_RE } from "@/lib/exercise/access";
import { isV2, validateExercise } from "@/lib/exercise/model";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await authorizeTraining(request, id);
  if (session instanceof NextResponse) return session;

  const ids = request.nextUrl.searchParams.get("ids")?.split(",") ?? [];
  if (!ids.length || ids.length > 50 || ids.some((planId) => !UUID_RE.test(planId)))
    return NextResponse.json({ error: "Невалидни планове." }, { status: 400 });

  const plans = await prisma.trainingPlan.findMany({
    where: { clubId: id, id: { in: ids } },
    select: { id: true, layout: true },
  });
  return NextResponse.json({
    previews: plans.filter(({ layout }) => isV2(layout) && !validateExercise(layout)),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
