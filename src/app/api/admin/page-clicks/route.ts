import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const total = await prisma.pageClick.count();
  const clicks = await prisma.pageClick.findMany({
    orderBy: { clickedAt: "desc" },
    take: 200,
    select: { id: true, clickedAt: true },
  });

  return NextResponse.json({ total, clicks });
}
