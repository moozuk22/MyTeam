import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildCloudinaryUrlFromUploadPath } from "@/lib/cloudinaryImagePath";
import { readFile } from "node:fs/promises";
import path from "node:path";

function buildCloudinaryPngSquare(url: string, size: number): string {
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) {
    return url;
  }

  const prefix = url.slice(0, idx + marker.length);
  const suffix = url.slice(idx + marker.length);
  return `${prefix}c_pad,w_${size},h_${size},b_black,q_auto:good,f_png/${suffix}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cardCode: string; size: string }> },
) {
  const { cardCode: cardCodeRaw, size: sizeRaw } = await params;
  const cardCode = cardCodeRaw.trim().toUpperCase();
  const parsedSize = Number.parseInt(sizeRaw, 10);
  const size = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 192;
  void req;

  try {
    const card = await prisma.card.findFirst({
      where: {
        cardCode,
        isActive: true,
      },
      select: {
        player: {
          select: {
            club: {
              select: {
                imageUrl: true,
                emblemUrl: true,
              },
            },
          },
        },
      },
    });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
    const imagePath = card?.player.club?.imageUrl ?? null;
    const baseLogoUrl = imagePath
      ? imagePath.startsWith("http")
        ? imagePath
        : cloudName
          ? buildCloudinaryUrlFromUploadPath(imagePath, cloudName)
          : null
      : card?.player.club?.emblemUrl ?? null;

    if (baseLogoUrl) {
      const iconUrl = buildCloudinaryPngSquare(baseLogoUrl, size);
      const upstream = await fetch(iconUrl, { next: { revalidate: 86400 } });
      if (upstream.ok) {
        const contentType = upstream.headers.get("content-type") || "image/png";
        const body = await upstream.arrayBuffer();
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          },
        });
      }
    }
  } catch (error) {
    console.error("Manifest icon route error:", error);
  }

  const fallback = size >= 512 ? "/icon-512.png" : "/icon-192.png";
  try {
    const filePath = path.join(process.cwd(), "public", fallback.replace(/^\/+/, ""));
    const body = await readFile(filePath);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    // fall through to 404
  }

  return new NextResponse("Icon not found", { status: 404 });
}
