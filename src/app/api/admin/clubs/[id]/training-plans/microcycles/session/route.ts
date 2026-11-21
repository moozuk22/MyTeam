import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTraining, UUID_RE } from "@/lib/exercise/access";
import { TrainingImageError, withTrainingImages } from "@/lib/exercise/imageStorage";
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

/** Removes the plan from the training. The plan stays in the library. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await authorizeTraining(request, id, "save");
  if (session instanceof NextResponse) return session;
  const search = request.nextUrl.searchParams;
  const target = sessionTarget(Object.fromEntries(search));
  const documentId = search.get("documentId")?.toLowerCase();
  if (!target || !documentId || !UUID_RE.test(documentId))
    return NextResponse.json({ error: "Невалидна тренировка или план-конспект." }, { status: 400 });
  return withTrainingImages(id, async tx => {
    const reference = await trainingReference(tx, id, search.get("coachGroupId"), target, true);
    // The plan is already removed.
    if (!reference.occupied) return new NextResponse(null, { status: 204 });
    // A coach can remove only their own plan, and only while the training still uses it.
    if (reference.documentId !== documentId)
      throw new TrainingImageError("Тренировката вече използва друг план-конспект. Заредете страницата отново.", 409);
    await tx.trainingSessionDocument.deleteMany({
      where: { clubId: id, cycleId: target.cycleId, groupKey: target.groupKey, rowId: target.rowId, documentId },
    });
    return new NextResponse(null, { status: 204 });
  });
}
