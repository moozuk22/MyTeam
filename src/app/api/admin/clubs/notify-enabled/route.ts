import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clubs = await prisma.club.findMany({
      where: { notifyOnCoachVisit: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(clubs);
  } catch (error) {
    console.error("notify-enabled clubs fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
