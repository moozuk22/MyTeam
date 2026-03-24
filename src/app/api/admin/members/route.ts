import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaPoolRetry } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { randomBytes } from "crypto";
import {
  applyCloudinaryTransformToUrl,
  buildCloudinaryUrlFromUploadPath,
} from "@/lib/cloudinaryImagePath";
import {
  isCurrentMonthWaived,
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

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;

  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const fullNameFromBody = String(body.fullName ?? "").trim();
    const firstName = String(body.firstName ?? "").trim();
    const secondName = String(body.secondName ?? "").trim();
    const fullName = fullNameFromBody || [firstName, secondName].filter(Boolean).join(" ").trim();

    if (!fullName) {
      return NextResponse.json(
        { error: "fullName is required" },
        { status: 400 }
      );
    }

    let clubId = String(body.clubId ?? "").trim();
    if (!clubId) {
      const clubs = await prisma.club.findMany({
        select: { id: true },
        take: 2,
        orderBy: { createdAt: "asc" },
      });
      if (clubs.length === 1) {
        clubId = clubs[0].id;
      } else {
        return NextResponse.json(
          { error: "clubId is required when multiple clubs exist" },
          { status: 400 }
        );
      }
    }

    const rawStatus = String(body.status ?? "paid").trim().toLowerCase();
    const status = rawStatus === "warning" || rawStatus === "overdue" ? rawStatus : "paid";

    const jerseyNumber = body.jerseyNumber ? String(body.jerseyNumber).trim() : null;
    const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
    const avatarUrlInput = body.avatarUrl ? String(body.avatarUrl).trim() : null;
    const adminImagePath = imageUrl || avatarUrlInput || null;

    const parseDate = (value: unknown): Date | null => {
      if (value === null || value === undefined || value === "") {
        return null;
      }
      const parsed = new Date(String(value));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const birthDate = parseDate(body.birthDate);
    if (body.birthDate && !birthDate) {
      return NextResponse.json({ error: "Invalid birthDate" }, { status: 400 });
    }

    const lastPaymentDate = parseDate(body.lastPaymentDate);
    if (body.lastPaymentDate && !lastPaymentDate) {
      return NextResponse.json({ error: "Invalid lastPaymentDate" }, { status: 400 });
    }

    const teamGroup =
      body.teamGroup === null || body.teamGroup === undefined || body.teamGroup === ""
        ? null
        : Number.parseInt(String(body.teamGroup), 10);
    if (teamGroup !== null && Number.isNaN(teamGroup)) {
      return NextResponse.json({ error: "Invalid teamGroup" }, { status: 400 });
    }

    let createdPlayer = null;
    let lastError: unknown = null;

    for (let i = 0; i < 5; i++) {
      const cardCode = randomBytes(4).toString("hex").toUpperCase();

      try {
        createdPlayer = await prisma.player.create({
          data: {
            clubId,
            fullName,
            status,
            jerseyNumber,
            birthDate,
            teamGroup,
            lastPaymentDate,
            ...(adminImagePath
              ? {
                  images: {
                    create: {
                      imageUrl: adminImagePath,
                      isAdminView: true,
                    },
                  },
                }
              : {}),
            cards: {
              create: {
                cardCode,
                isActive: true,
              },
            },
          },
          include: {
            club: true,
            cards: {
              orderBy: { createdAt: "desc" },
            },
            paymentLogs: {
              orderBy: { paidAt: "desc" },
            },
            images: true,
          },
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

    if (!createdPlayer) {
      throw lastError ?? new Error("Failed to generate unique card code");
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
    const imagePath = getPrimaryPlayerImagePath(createdPlayer.images);
    const avatarUrl = buildAvatarUrlFromPath(imagePath, cloudName);

    return NextResponse.json(
      {
        ...createdPlayer,
        imageUrl: imagePath,
        avatarUrl,
        imagePublicId: null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Player creation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;

  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clubId = request.nextUrl.searchParams.get("clubId")?.trim() ?? "";
    if (clubId) {
      const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clubId);
      if (!uuidLike) {
        return NextResponse.json({ error: "Club not found" }, { status: 404 });
      }

      const clubExists = await prisma.club.findUnique({
        where: { id: clubId },
        select: { id: true },
      });

      if (!clubExists) {
        return NextResponse.json({ error: "Club not found" }, { status: 404 });
      }
    }

    const players = await withPrismaPoolRetry(() =>
      prisma.player.findMany({
      where: {
        ...(clubId ? { clubId } : {}),
      },
      include: {
        club: true,
        cards: {
          orderBy: {
            createdAt: "desc",
          },
        },
        paymentLogs: {
          orderBy: {
            paidAt: "desc",
          },
        },
        paymentWaivers: {
          orderBy: {
            waivedFor: "desc",
          },
        },
        images: true,
      },
      orderBy: {
        fullName: "asc",
      },
    }),
    );

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
    const normalizedPlayers = players.map((player) => {
      const imagePath = getPrimaryPlayerImagePath(player.images);
      const waivedDates = player.paymentWaivers.map((item) => item.waivedFor);
      const pausedThisMonth = isCurrentMonthWaived(waivedDates);
      const resolvedStatus = resolveStatusFromSettledMonths({
        paidDates: player.paymentLogs.map((item) => item.paidFor),
        waivedDates,
      });
      return {
        ...player,
        status: pausedThisMonth ? "paused" : resolvedStatus,
        imageUrl: imagePath,
        avatarUrl: buildAvatarUrlFromPath(imagePath, cloudName),
        imagePublicId: null,
      };
    });

    return NextResponse.json(normalizedPlayers);
  } catch (error) {
    console.error("Players fetch error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
