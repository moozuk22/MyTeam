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

async function getClubLogoUrl(clubIdRaw: string): Promise<string | null> {
  const clubId = clubIdRaw.trim();
  if (!clubId) {
    return null;
  }

  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: {
        imageUrl: true,
        emblemUrl: true,
      },
    });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
    const imagePath = club?.imageUrl ?? null;
    if (imagePath) {
      if (imagePath.startsWith("http")) {
        return imagePath;
      }
      if (cloudName) {
        return buildCloudinaryUrlFromUploadPath(imagePath, cloudName);
      }
    }

    return club?.emblemUrl ?? null;
  } catch (error) {
    console.error("Admin members manifest icon club lookup error:", error);
    return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: sizeRaw } = await params;
  const parsedSize = Number.parseInt(sizeRaw, 10);
  const size = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 192;
  const url = new URL(req.url);
  const clubId = url.searchParams.get("clubId") ?? "";
  void url.origin;

  try {
    const baseLogoUrl = await getClubLogoUrl(clubId);
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
    console.error("Admin members manifest icon route error:", error);
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
