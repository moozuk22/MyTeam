import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { randomBytes } from "crypto";
import {
  applyCloudinaryTransformToUrl,
  buildCloudinaryUrlFromUploadPath,
} from "@/lib/cloudinaryImagePath";

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
        images: true,
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
    const imagePath = getPrimaryPlayerImagePath(player.images);

    return NextResponse.json({
      ...player,
      imageUrl: imagePath,
      avatarUrl: buildAvatarUrlFromPath(imagePath, cloudName),
      imagePublicId: null,
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

    if (action !== "assign_new_card" && action !== "reactivate" && action !== "delete_permanently") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const playerExists = await prisma.player.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!playerExists) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    if (action === "reactivate") {
      const reactivatedPlayer = await prisma.$transaction(async (tx) => {
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
      });

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
      await prisma.$transaction([
        prisma.card.deleteMany({
          where: { playerId: id },
        }),
        prisma.player.delete({
          where: { id },
        }),
      ]);

      return NextResponse.json({ success: true, id });
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
        const player = await prisma.player.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!player) {
            return NextResponse.json({ error: "Player not found" }, { status: 404 });
        }

        await prisma.$transaction([
            prisma.card.updateMany({
                where: { playerId: id },
                data: { isActive: false },
            }),
            prisma.player.update({
                where: { id },
                data: { isActive: false },
            }),
        ]);

        return NextResponse.json({ message: "Player removed successfully" });
    } catch (error) {
        console.error("Member remove error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
