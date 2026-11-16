import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) return NextResponse.json({ error: "Нямате достъп." }, { status: 401 });
  const { id: clubId } = await params;
  if (!UUID_RE.test(clubId)) {
    return NextResponse.json({ error: "Невалиден клуб." }, { status: 400 });
  }
  if (!session.roles.includes("admin") && session.defaultClubId && session.defaultClubId !== clubId) {
    return NextResponse.json({ error: "Профилът ви няма достъп до този клуб." }, { status: 403 });
  }
  const coachGroupId = request.nextUrl.searchParams.get("coachGroupId");
  if (coachGroupId !== null && !UUID_RE.test(coachGroupId)) {
    return NextResponse.json({ error: "Невалидна треньорска група." }, { status: 400 });
  }
  try {
    const groups = await prisma.clubCustomTrainingGroup.findMany({
      where: { clubId, ...(coachGroupId ? { coachGroupId } : {}) },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true, name: true, coachGroupId: true,
        players: { where: { player: { clubId, isActive: true } }, select: { playerId: true } },
      },
    });
    return NextResponse.json(groups.map(({ players, ...group }) => ({
      ...group, playerIds: players.map(({ playerId }) => playerId),
    })));
  } catch {
    return NextResponse.json({ error: "Неуспешно зареждане на групите." }, { status: 500 });
  }
}
