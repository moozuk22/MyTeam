import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildCloudinaryUrlFromUploadPath } from "@/lib/cloudinaryImagePath";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const team = await prisma.club.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        emblemUrl: true,
        imageUrl: true,
        imagePublicId: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
    const normalizedTeam =
      team.imageUrl && cloudName && !team.imageUrl.startsWith("http")
        ? {
            ...team,
            imagePath: team.imageUrl,
            imageUrl: buildCloudinaryUrlFromUploadPath(team.imageUrl, cloudName),
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
    const slug = String(body.slug ?? "").trim();
    const imageUrlRaw = body.imageUrl;
    const imagePublicIdRaw = body.imagePublicId;

    if (!name) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }

    if (!slug) {
      return NextResponse.json({ error: "Team slug is required" }, { status: 400 });
    }

    const existingTeam = await prisma.club.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingTeam) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const duplicateSlug = await prisma.club.findFirst({
      where: {
        slug,
        NOT: { id },
      },
      select: { id: true },
    });

    if (duplicateSlug) {
      return NextResponse.json(
        { error: "Team with this slug already exists" },
        { status: 409 },
      );
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

    const updated = await prisma.club.update({
      where: { id },
      data: {
        name,
        slug,
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
