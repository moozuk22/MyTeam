import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { normalizeToMonthStart, toYearMonth } from "@/lib/paymentStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_session")?.value;
  const payload = token ? await verifyAdminToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!payload.roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id: clubId } = await params;
    const body = await request.json().catch(() => ({}));
    const firstBillingMonthRaw = String((body as { firstBillingMonth?: unknown }).firstBillingMonth ?? "").trim();
    const confirm = (body as { confirm?: unknown }).confirm;
    const playerStatusRaw = (body as { playerStatus?: unknown }).playerStatus;
    const playerStatus = (["keep", "paid", "warning", "overdue"] as const).includes(playerStatusRaw as never)
      ? (playerStatusRaw as "keep" | "paid" | "warning" | "overdue")
      : "warning";

    if (!firstBillingMonthRaw) {
      return NextResponse.json({ error: "firstBillingMonth is required" }, { status: 400 });
    }

    const parsed = new Date(`${firstBillingMonthRaw}-01T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid firstBillingMonth format. Use YYYY-MM." }, { status: 400 });
    }
    const firstBillingMonthDate = normalizeToMonthStart(parsed);
    const firstBillingYM = toYearMonth(firstBillingMonthDate);
    void firstBillingYM;

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, billingStatus: true, firstBillingMonth: true },
    });

    if (!club) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    if (club.billingStatus === "active" && confirm !== "override") {
      return NextResponse.json(
        {
          error: "Club billing is already active. Include `confirm: 'override'` to override.",
          currentFirstBillingMonth: club.firstBillingMonth,
        },
        { status: 409 }
      );
    }

    const updatedClub = await prisma.club.update({
      where: { id: clubId },
      data: {
        billingStatus: "active",
        firstBillingMonth: firstBillingMonthDate,
        billingActivatedAt: new Date(),
      },
    });

    const players = await prisma.player.findMany({
      where: { clubId, isActive: true },
      select: { id: true },
    });

    const statusUpdate = playerStatus !== "keep" ? { status: playerStatus } : {};

    let affectedPlayers = 0;
    for (const player of players) {
      await prisma.player.update({
        where: { id: player.id },
        data: { firstBillingMonth: firstBillingMonthDate, ...statusUpdate },
      });
      affectedPlayers++;
    }

    return NextResponse.json({ club: updatedClub, affectedPlayers });
  } catch (error) {
    console.error("Billing activation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
