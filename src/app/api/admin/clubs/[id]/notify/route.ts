import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifyAdminToken(token);
  if (!session || !session.roles.includes("admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let notifyOnCoachVisit: boolean;
  try {
    const body = (await request.json()) as { notifyOnCoachVisit?: unknown };
    if (typeof body.notifyOnCoachVisit !== "boolean") {
      return NextResponse.json({ error: "notifyOnCoachVisit must be a boolean" }, { status: 400 });
    }
    notifyOnCoachVisit = body.notifyOnCoachVisit;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const updated = await prisma.club.update({
      where: { id },
      data: { notifyOnCoachVisit },
      select: { id: true, notifyOnCoachVisit: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }
}
