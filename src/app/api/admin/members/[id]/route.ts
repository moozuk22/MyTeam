import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaPoolRetry } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { randomBytes } from "crypto";
import { publishMemberUpdated } from "@/lib/memberEvents";
import {
  applyCloudinaryTransformToUrl,
  buildCloudinaryUrlFromUploadPath,
} from "@/lib/cloudinaryImagePath";
import {
  isCurrentMonthWaived,
  normalizeToMonthStart,
  resolveStatusFromSettledMonths,
} from "@/lib/paymentStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlayerImageRecord = {
  imageUrl: string;
  isAdminView: boolean;
};

function getPrimaryPlayerImagePath(images: PlayerImageRecord[]): string | null {
  const adminImage = images.find((image) => image.isAdminView);
  return adminImage?.imageUrl ?? images[0]?.imageUrl ?? null;
}

function buildAvatarUrlFromPath(imagePath: string | null, cloudName: string): string | null {
  const avatarTransform = "w_320,h_400,c_limit,dpr_auto,f_auto,q_auto:good";
  if (!imagePath) {
    return null;
  }
  if (imagePath.startsWith("http")) {
    return applyCloudinaryTransformToUrl(imagePath, avatarTransform);
  }
  if (!cloudName) {
    return null;
  }
  return buildCloudinaryUrlFromUploadPath(
    imagePath,
    cloudName,
    avatarTransform,
  );
}

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
      include: {
        cards: { orderBy: { createdAt: "desc" } },
        paymentLogs: {
          orderBy: { paidAt: "desc" },
        },
        paymentWaivers: {
          orderBy: { waivedFor: "desc" },
        },
        images: true,
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
    const imagePath = getPrimaryPlayerImagePath(player.images);

    const waivedDates = player.paymentWaivers.map((item) => item.waivedFor);
    const pausedThisMonth = isCurrentMonthWaived(waivedDates);
    const resolvedStatus = resolveStatusFromSettledMonths({
      paidDates: player.paymentLogs.map((item) => item.paidFor),
      waivedDates,
    });

    return NextResponse.json({
      ...player,
      status: pausedThisMonth ? "paused" : resolvedStatus,
      imageUrl: imagePath,
      avatarUrl: buildAvatarUrlFromPath(imagePath, cloudName),
      imagePublicId: null,
      isPausedThisMonth: pausedThisMonth,
    });
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
    const clubIdRaw = body.clubId;
    const jerseyNumberRaw = body.jerseyNumber;
    const teamGroupRaw = body.teamGroup;
    const statusRaw = String(body.status ?? "").trim();
    const birthDateRaw = body.birthDate;
    const avatarUrlRaw = body.avatarUrl;
    const imageUrlRaw = body.imageUrl;
    const hasImageUrl = Object.prototype.hasOwnProperty.call(body, "imageUrl");

    if (!fullName) {
      return NextResponse.json(
        { error: "fullName is required" },
        { status: 400 }
      );
    }

    const existingPlayer = await prisma.player.findUnique({
      where: { id },
      include: {
        images: {
          select: {
            imageUrl: true,
            isAdminView: true,
          },
        },
      },
    });
    if (!existingPlayer) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const clubId =
      clubIdRaw === null || clubIdRaw === undefined || String(clubIdRaw).trim() === ""
        ? undefined
        : String(clubIdRaw).trim();

    if (clubId) {
      const clubExists = await prisma.club.findUnique({
        where: { id: clubId },
        select: { id: true },
      });
      if (!clubExists) {
        return NextResponse.json({ error: "Club not found" }, { status: 404 });
      }
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

    const nextImageUrl = hasImageUrl
      ? imageUrlRaw === null || imageUrlRaw === undefined || String(imageUrlRaw).trim() === ""
        ? null
        : String(imageUrlRaw).trim()
      : undefined;
    const fallbackImageUrl =
      avatarUrlRaw === null || avatarUrlRaw === undefined || String(avatarUrlRaw).trim() === ""
        ? null
        : String(avatarUrlRaw).trim();
    const nextAdminImageUrl = nextImageUrl ?? fallbackImageUrl;
    const currentAdminImagePath = getPrimaryPlayerImagePath(existingPlayer.images);
    const shouldSwitchAdminImage =
      typeof nextAdminImageUrl === "string" &&
      nextAdminImageUrl.length > 0 &&
      nextAdminImageUrl !== currentAdminImagePath;

    const updatedPlayer = await prisma.player.update({
      where: { id },
      data: {
        fullName,
        ...(clubId ? { clubId } : {}),
        jerseyNumber:
          jerseyNumberRaw === null || jerseyNumberRaw === undefined || jerseyNumberRaw === ""
            ? null
            : String(jerseyNumberRaw),
        teamGroup,
        birthDate,
        ...(shouldSwitchAdminImage
          ? {
              images: {
                updateMany: {
                  where: { isAdminView: true },
                  data: { isAdminView: false },
                },
                create: {
                  imageUrl: nextAdminImageUrl,
                  isAdminView: true,
                },
              },
            }
          : {}),
        ...(status ? { status } : {}),
      },
      include: {
        cards: { orderBy: { createdAt: "desc" } },
        club: true,
        images: true,
      },
    });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
    const imagePath = getPrimaryPlayerImagePath(updatedPlayer.images);
    const activeCardCode =
      updatedPlayer.cards.find((card) => card.isActive)?.cardCode ??
      updatedPlayer.cards[0]?.cardCode;

    if (activeCardCode && status) {
      publishMemberUpdated(activeCardCode, "status-updated");
    }

    return NextResponse.json({
      ...updatedPlayer,
      imageUrl: imagePath,
      avatarUrl: buildAvatarUrlFromPath(imagePath, cloudName),
      imagePublicId: null,
    });
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

    if (
      action !== "assign_new_card" &&
      action !== "reactivate" &&
      action !== "delete_permanently" &&
      action !== "manage_pause_months"
    ) {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const playerExists = await withPrismaPoolRetry(() =>
      prisma.player.findUnique({
        where: { id },
        select: { id: true },
      }),
    );

    if (!playerExists) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    if (action === "reactivate") {
      const reactivatedPlayer = await withPrismaPoolRetry(() => prisma.$transaction(async (tx) => {
        await tx.player.update({
          where: { id },
          data: { isActive: true },
        });

        const latestCard = await tx.card.findFirst({
          where: { playerId: id },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        if (latestCard) {
          await tx.card.updateMany({
            where: { playerId: id },
            data: { isActive: false },
          });

          await tx.card.update({
            where: { id: latestCard.id },
            data: { isActive: true },
          });
        }

        return tx.player.findUnique({
          where: { id },
          include: {
            cards: { orderBy: { createdAt: "desc" } },
            club: true,
            images: true,
          },
        });
      }));

      if (!reactivatedPlayer) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 });
      }

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
      const imagePath = getPrimaryPlayerImagePath(reactivatedPlayer.images);
      return NextResponse.json({
        ...reactivatedPlayer,
        imageUrl: imagePath,
        avatarUrl: buildAvatarUrlFromPath(imagePath, cloudName),
        imagePublicId: null,
      });
    }

    if (action === "delete_permanently") {
      await withPrismaPoolRetry(() => prisma.$transaction([
        prisma.card.deleteMany({
          where: { playerId: id },
        }),
        prisma.player.delete({
          where: { id },
        }),
      ]));

      return NextResponse.json({ success: true, id });
    }

    if (action === "manage_pause_months") {
      const modeRaw = String((body as { mode?: unknown }).mode ?? "").trim().toLowerCase();
      const reasonRaw = String((body as { reason?: unknown }).reason ?? "").trim();
      const monthsRaw = Array.isArray((body as { months?: unknown }).months)
        ? ((body as { months?: unknown[] }).months ?? [])
        : [];

      if (modeRaw !== "pause" && modeRaw !== "remove") {
        return NextResponse.json({ error: "mode must be pause or remove" }, { status: 400 });
      }

      if (monthsRaw.length === 0) {
        return NextResponse.json({ error: "At least one month is required" }, { status: 400 });
      }

      const normalizedMonths: Date[] = [];
      for (const item of monthsRaw) {
        const parsed = new Date(String(item));
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Invalid month value" }, { status: 400 });
        }
        normalizedMonths.push(normalizeToMonthStart(parsed));
      }

      const uniqueByIso = Array.from(
        new Map(normalizedMonths.map((date) => [date.toISOString(), date])).values(),
      );

      const tokenPayload = await verifyAdminToken(token);
      const createdBy = tokenPayload?.roles.includes("coach") ? "coach" : "admin";

      await withPrismaPoolRetry(() => prisma.$transaction(async (tx) => {
        if (modeRaw === "pause") {
          await tx.paymentWaiver.createMany({
            data: uniqueByIso.map((waivedFor) => ({
              playerId: id,
              waivedFor,
              reason: reasonRaw || null,
              createdBy,
            })),
            skipDuplicates: true,
          });
        } else {
          await tx.paymentWaiver.deleteMany({
            where: {
              playerId: id,
              waivedFor: { in: uniqueByIso },
            },
          });
        }

        const [allPaid, allWaived] = await Promise.all([
          tx.paymentLog.findMany({
            where: { playerId: id },
            select: { paidFor: true },
          }),
          tx.paymentWaiver.findMany({
            where: { playerId: id },
            select: { waivedFor: true },
          }),
        ]);

        await tx.player.update({
          where: { id },
          data: {
            status: resolveStatusFromSettledMonths({
              paidDates: allPaid.map((row) => row.paidFor),
              waivedDates: allWaived.map((row) => row.waivedFor),
            }),
          },
        });
      }));

      const [paymentWaivers, paymentLogs, cards] = await withPrismaPoolRetry(() =>
        Promise.all([
          prisma.paymentWaiver.findMany({
            where: { playerId: id },
            orderBy: { waivedFor: "desc" },
          }),
          prisma.paymentLog.findMany({
            where: { playerId: id },
            select: { paidFor: true },
          }),
          prisma.card.findMany({
            where: { playerId: id, isActive: true },
            select: { cardCode: true },
            take: 1,
          }),
        ]),
      );

      const pausedThisMonth = isCurrentMonthWaived(paymentWaivers.map((row) => row.waivedFor));
      const targetCardCode = cards[0]?.cardCode;
      if (targetCardCode) {
        publishMemberUpdated(targetCardCode, "status-updated");
      }

      return NextResponse.json({
        success: true,
        status: pausedThisMonth
          ? "paused"
          : resolveStatusFromSettledMonths({
              paidDates: paymentLogs.map((row) => row.paidFor),
              waivedDates: paymentWaivers.map((row) => row.waivedFor),
            }),
        isPausedThisMonth: pausedThisMonth,
        paymentWaivers,
      });
    }

    let updatedPlayer = null;
    let lastError: unknown = null;

    for (let i = 0; i < 5; i++) {
      const cardCode = randomBytes(4).toString("hex").toUpperCase();
      try {
        updatedPlayer = await withPrismaPoolRetry(() => prisma.$transaction(async (tx) => {
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
        }));
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
    console.error("Member patch error:", error);
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
        const player = await withPrismaPoolRetry(() => prisma.player.findUnique({
            where: { id },
            select: { id: true },
        }));

        if (!player) {
            return NextResponse.json({ error: "Player not found" }, { status: 404 });
        }

        await withPrismaPoolRetry(() => prisma.$transaction([
            prisma.card.updateMany({
                where: { playerId: id },
                data: { isActive: false },
            }),
            prisma.player.update({
                where: { id },
                data: { isActive: false },
            }),
        ]));

        return NextResponse.json({ message: "Player removed successfully" });
    } catch (error) {
        console.error("Member remove error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
