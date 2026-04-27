import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { setPresence, getRawPresence } from "@/lib/pagePresence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRESENCE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifyAdminToken(token);
  if (!session || !session.roles.includes("coach") || session.roles.includes("admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { clubId?: string; action?: string };
  try {
    body = (await request.json()) as { clubId?: string; action?: string };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { clubId, action } = body;
  if (!clubId || (action !== "connect" && action !== "disconnect")) {
    return NextResponse.json({ error: "Missing clubId or invalid action" }, { status: 400 });
  }

  let clubName = "";
  if (action === "connect") {
    try {
      const club = await prisma.club.findUnique({ where: { id: clubId }, select: { name: true } });
      clubName = club?.name ?? "";
    } catch {
      // non-fatal
    }
  } else {
    clubName = getRawPresence(clubId)?.clubName ?? "";
  }

  setPresence(clubId, clubName, action === "connect");
  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get("clubId");
  if (!clubId) {
    return NextResponse.json({ error: "Missing clubId" }, { status: 400 });
  }

  const entry = getRawPresence(clubId);
  if (!entry || !entry.active) {
    return NextResponse.json({ active: false });
  }

  const age = Date.now() - entry.lastUpdatedAt.getTime();
  if (age > PRESENCE_TTL_MS) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({
    active: true,
    clubId: entry.clubId,
    clubName: entry.clubName,
    connectedAt: entry.connectedAt.toISOString(),
    lastUpdatedAt: entry.lastUpdatedAt.toISOString(),
  });
}
