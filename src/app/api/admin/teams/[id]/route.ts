import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  applyCloudinaryTransformToUrl,
  buildCloudinaryUrlFromUploadPath,
} from "@/lib/cloudinaryImagePath";
import { verifyAdminToken } from "@/lib/adminAuth";
import { cloudinary } from "@/lib/cloudinary";

type Params = { params: Promise<{ id: string }> };

type TeamDeletePayload = {
  teamImagePublicId: string | null;
  playerImageUrls: string[];
};

function getCloudinaryPublicIdFromImagePath(imagePath: string): string | null {
  const trimmed = imagePath.trim();
  if (!trimmed) {
    return null;
  }

  const uploadMarker = "/upload/";
  const uploadIndex = trimmed.indexOf(uploadMarker);
  const pathWithTransforms = uploadIndex >= 0
    ? trimmed.slice(uploadIndex + uploadMarker.length)
    : trimmed;

  const pathWithoutTransforms = pathWithTransforms.replace(/^v\d+\//, "");
  const pathWithoutExtension = pathWithoutTransforms.replace(/\.[a-z0-9]+$/i, "");
  return pathWithoutExtension || null;
}

async function deleteCloudinaryImages(publicIds: string[]) {
  for (const publicId of publicIds) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        invalidate: true,
      });
      if (result.result !== "ok" && result.result !== "not found") {
        console.warn("Unexpected Cloudinary destroy result:", result);
      }
    } catch (cloudinaryError) {
      console.error("Cloudinary deletion error during team deletion:", cloudinaryError);
    }
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const team = await prisma.club.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        sports: true,
        emblemUrl: true,
        imageUrl: true,
        imagePublicId: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
    const clubLogoTransform = "w_96,h_96,c_limit,f_auto,q_auto:eco";
    const normalizedTeam =
      team.imageUrl && cloudName && !team.imageUrl.startsWith("http")
        ? {
            ...team,
            imagePath: team.imageUrl,
            imageUrl: buildCloudinaryUrlFromUploadPath(team.imageUrl, cloudName, clubLogoTransform),
          }
        : team.imageUrl && team.imageUrl.startsWith("http")
          ? {
              ...team,
              imagePath: team.imageUrl,
              imageUrl: applyCloudinaryTransformToUrl(team.imageUrl, clubLogoTransform),
            }
        : {
            ...team,
            imagePath: team.imageUrl,
          };

    return NextResponse.json(normalizedTeam);
  } catch (error) {
    console.error("Team fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const sportsRaw = body.sports;
    const imageUrlRaw = body.imageUrl;
    const imagePublicIdRaw = body.imagePublicId;

    if (!name) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }

    const existingTeam = await prisma.club.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingTeam) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const imageUrl =
      imageUrlRaw === null || imageUrlRaw === undefined || String(imageUrlRaw).trim() === ""
        ? null
        : String(imageUrlRaw).trim();
    const imagePublicId =
      imagePublicIdRaw === null ||
      imagePublicIdRaw === undefined ||
      String(imagePublicIdRaw).trim() === ""
        ? null
        : String(imagePublicIdRaw).trim();
    const sports =
      sportsRaw === null || sportsRaw === undefined || String(sportsRaw).trim() === ""
        ? null
        : String(sportsRaw).trim();

    const updated = await prisma.club.update({
      where: { id },
      data: {
        name,
        sports,
        imageUrl,
        imagePublicId,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Team update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const token = request.cookies.get("admin_session")?.value;
  const { id } = await params;

  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deletePayload = await prisma.$transaction(async (tx) => {
      const team = await tx.club.findUnique({
        where: { id },
        select: {
          id: true,
          imagePublicId: true,
          players: {
            select: {
              id: true,
              images: {
                select: {
                  imageUrl: true,
                },
              },
            },
          },
        },
      });

      if (!team) {
        return null;
      }

      const playerIds = team.players.map((player) => player.id);
      const playerImageUrls = team.players.flatMap((player) =>
        player.images.map((image) => image.imageUrl),
      );

      if (playerIds.length > 0) {
        await tx.card.deleteMany({
          where: {
            playerId: {
              in: playerIds,
            },
          },
        });
      }

      await tx.club.delete({
        where: { id },
      });

      return {
        teamImagePublicId: team.imagePublicId,
        playerImageUrls,
      } satisfies TeamDeletePayload;
    });

    if (!deletePayload) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const playerImagePublicIds = deletePayload.playerImageUrls
      .map((url) => getCloudinaryPublicIdFromImagePath(url))
      .filter((publicId): publicId is string => Boolean(publicId));
    const allPublicIds = Array.from(
      new Set(
        [
          deletePayload.teamImagePublicId,
          ...playerImagePublicIds,
        ].filter((publicId): publicId is string => Boolean(publicId)),
      ),
    );

    await deleteCloudinaryImages(allPublicIds);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Team delete error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
