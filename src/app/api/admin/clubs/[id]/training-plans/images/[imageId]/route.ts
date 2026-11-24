import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { documentOwnerFilter } from "@/lib/exercise/trainingSessionAccess";
import { authorizeTraining, UUID_RE } from "@/lib/exercise/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const { id: clubId, imageId } = await params;
  const session = await authorizeTraining(request, clubId);
  if (session instanceof NextResponse) return session;
  if (!UUID_RE.test(imageId)) return NextResponse.json({ error: "Невалидно изображение." }, { status: 400 });
  // Club drawings are shared. A document-only image remains private to its owner.
  const image = await prisma.trainingImage.findFirst({
    where: { id: imageId, clubId, OR: [
      { plans: { some: {} } },
      { documents: { some: { document: { ownerId: await documentOwnerFilter(clubId, session.sub, request.nextUrl.searchParams.get("coachGroupId")) } } } },
    ] },
    select: { bytes: true },
  });
  if (!image) return NextResponse.json({ error: "Изображението не е намерено." }, { status: 404 });
  return new NextResponse(new Uint8Array(image.bytes), { headers: {
    "Content-Type": "image/jpeg",
    "Content-Length": String(image.bytes.length),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
