import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_session")?.value;
  const { id } = await params;

  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const player = await prisma.player.findUnique({
      where: { id },
      include: { cards: { orderBy: { createdAt: "desc" } } },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    return NextResponse.json(player);
  } catch (error) {
    console.error("Member fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_session")?.value;
  const { id } = await params;

  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const fullName = String(body.fullName ?? "").trim();
    const jerseyNumberRaw = body.jerseyNumber;
    const teamGroupRaw = body.teamGroup;
    const statusRaw = String(body.status ?? "").trim();
    const birthDateRaw = body.birthDate;
    const avatarUrlRaw = body.avatarUrl;

    if (!fullName) {
      return NextResponse.json(
        { error: "fullName is required" },
        { status: 400 }
      );
    }

    const status =
      statusRaw === "paid" || statusRaw === "warning" || statusRaw === "overdue"
        ? statusRaw
        : undefined;
    const teamGroup =
      teamGroupRaw === null || teamGroupRaw === undefined || teamGroupRaw === ""
        ? null
        : Number(teamGroupRaw);
    if (teamGroup !== null && !Number.isInteger(teamGroup)) {
      return NextResponse.json({ error: "teamGroup must be an integer" }, { status: 400 });
    }

    const birthDate =
      birthDateRaw === null || birthDateRaw === undefined || birthDateRaw === ""
        ? null
        : new Date(String(birthDateRaw));
    if (birthDate && Number.isNaN(birthDate.getTime())) {
      return NextResponse.json({ error: "birthDate is invalid" }, { status: 400 });
    }

    const updatedPlayer = await prisma.player.update({
      where: { id },
      data: {
        fullName,
        jerseyNumber:
          jerseyNumberRaw === null || jerseyNumberRaw === undefined || jerseyNumberRaw === ""
            ? null
            : String(jerseyNumberRaw),
        teamGroup,
        birthDate,
        avatarUrl:
          avatarUrlRaw === null || avatarUrlRaw === undefined || avatarUrlRaw === ""
            ? null
            : String(avatarUrlRaw),
        ...(status ? { status } : {}),
      },
      include: { cards: { orderBy: { createdAt: "desc" } } },
    });

    return NextResponse.json(updatedPlayer);
  } catch (error) {
    console.error("Member update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_session")?.value;
  const { id } = await params;

  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String((body as { action?: unknown })?.action ?? "").trim();

    if (action !== "assign_new_card") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const playerExists = await prisma.player.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!playerExists) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    let updatedPlayer = null;
    let lastError: unknown = null;

    for (let i = 0; i < 5; i++) {
      const cardCode = randomBytes(4).toString("hex").toUpperCase();
      try {
        updatedPlayer = await prisma.$transaction(async (tx) => {
          await tx.card.updateMany({
            where: { playerId: id },
            data: { isActive: false },
          });

          await tx.card.create({
            data: {
              playerId: id,
              cardCode,
              isActive: true,
            },
          });

          return tx.player.findUnique({
            where: { id },
            include: { cards: { orderBy: { createdAt: "desc" } } },
          });
        });
        break;
      } catch (error) {
        lastError = error;
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code?: unknown }).code)
            : "";
        if (code !== "P2002") {
          throw error;
        }
      }
    }

    if (!updatedPlayer) {
      throw lastError ?? new Error("Failed to generate unique card code");
    }

    return NextResponse.json(updatedPlayer);
  } catch (error) {
    console.error("Assign new card error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const token = request.cookies.get("admin_session")?.value;
    const { id } = await params;

    if (!token || !(await verifyAdminToken(token))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await prisma.card.deleteMany({
            where: { playerId: id },
        });

        await prisma.player.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Player and associated cards deleted successfully" });
    } catch (error) {
        console.error("Member deletion error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
