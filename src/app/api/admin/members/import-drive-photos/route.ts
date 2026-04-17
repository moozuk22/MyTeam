import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { getGoogleServiceAccountToken } from "@/lib/googleAuth";
import { randomUUID } from "crypto";
import { cloudinary } from "@/lib/cloudinary";
import { transliterateBG } from "@/lib/transliterate";
import { extractUploadPathFromCloudinaryUrl } from "@/lib/cloudinaryImagePath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DriveFile = {
  id: string;
  name: string;
  mimeType?: string;
};

type PlayerWithImages = {
  id: string;
  fullName: string;
  images: Array<{
    imageUrl: string;
    isAdminView: boolean;
  }>;
};

function normalizePlayerName(value: string): string {
  return value
    .replace(/\.[^/.]+$/u, "")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("bg-BG");
}

function getPlayerUploadPublicId(name: string): string {
  const slug = transliterateBG(name);
  const folder = "players";
  const fallbackSlug = `${folder}-${Date.now()}`;
  const shortId = randomUUID().replace(/-/g, "").slice(0, 8);
  return `${folder}/${slug || fallbackSlug}-${shortId}`;
}

async function fetchDriveFileBuffer(fileId: string, accessToken: string): Promise<Buffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    redirect: "follow",
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Google Drive file download failed (${response.status}): ${errorBody || "no details"}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Google Drive download returned non-image content (${contentType || "unknown"}): ${errorBody.slice(0, 200) || "no details"}`);
  }

  const bytes = await response.arrayBuffer();
  return Buffer.from(bytes);
}

async function uploadPlayerImageToCloudinary(buffer: Buffer, playerName: string): Promise<string> {
  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: getPlayerUploadPublicId(playerName),
        format: "webp",
        transformation: [
          {
            width: 640,
            height: 800,
            crop: "fill",
            gravity: "face",
            quality: "auto:good",
          },
        ],
      },
      (error, uploadResult) => {
        if (error) {
          reject(error);
          return;
        }
        if (!uploadResult?.secure_url) {
          reject(new Error("Cloudinary upload failed"));
          return;
        }
        resolve({ secure_url: uploadResult.secure_url });
      },
    );

    stream.end(buffer);
  });

  return extractUploadPathFromCloudinaryUrl(result.secure_url);
}

async function fetchDriveFilesFromFolder(folderId: string, accessToken: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
      fields: "nextPageToken,files(id,name,mimeType)",
      pageSize: "1000",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Google Drive API request failed (${response.status}): ${errorBody || "no details"}`);
    }

    const payload = (await response.json()) as {
      nextPageToken?: string;
      files?: DriveFile[];
    };
    if (Array.isArray(payload.files)) {
      files.push(...payload.files);
    }
    pageToken = payload.nextPageToken ?? "";
  } while (pageToken);

  return files;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleServiceAccountToken();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Google credentials error" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      folderId?: unknown;
      clubId?: unknown;
      overwrite?: unknown;
    };

    const folderId = String(body.folderId ?? "").trim();
    const clubId = String(body.clubId ?? "").trim();
    const overwrite = Boolean(body.overwrite);

    if (!folderId) {
      return NextResponse.json({ error: "folderId is required" }, { status: 400 });
    }

    const driveFiles = await fetchDriveFilesFromFolder(folderId, accessToken);
    const players = (await prisma.player.findMany({
      where: {
        ...(clubId ? { clubId } : {}),
      },
      select: {
        id: true,
        fullName: true,
        images: {
          select: {
            imageUrl: true,
            isAdminView: true,
          },
        },
      },
    })) as PlayerWithImages[];

    const playersByNormalizedName = new Map<string, PlayerWithImages[]>();
    for (const player of players) {
      const normalized = normalizePlayerName(player.fullName);
      const bucket = playersByNormalizedName.get(normalized) ?? [];
      bucket.push(player);
      playersByNormalizedName.set(normalized, bucket);
    }

    let updated = 0;
    let unchanged = 0;
    let skippedAmbiguous = 0;
    let skippedExisting = 0;
    let unmatched = 0;
    let failedUploads = 0;

    const unmatchedFiles: string[] = [];
    const ambiguousFiles: string[] = [];
    const failedFiles: Array<{ fileName: string; reason: string }> = [];
    const updatedPlayers: Array<{ playerId: string; playerName: string; fileName: string }> = [];

    for (const file of driveFiles) {
      const normalizedFileName = normalizePlayerName(file.name);
      if (!normalizedFileName) {
        unmatched += 1;
        unmatchedFiles.push(file.name);
        continue;
      }

      const candidates = playersByNormalizedName.get(normalizedFileName) ?? [];
      if (candidates.length === 0) {
        unmatched += 1;
        unmatchedFiles.push(file.name);
        continue;
      }
      if (candidates.length > 1) {
        skippedAmbiguous += 1;
        ambiguousFiles.push(file.name);
        continue;
      }

      const player = candidates[0];
      const currentAdminImage = player.images.find((image) => image.isAdminView)?.imageUrl ?? null;

      if (currentAdminImage && !overwrite) {
        skippedExisting += 1;
        continue;
      }

      let nextImagePath = "";
      try {
        const fileBuffer = await fetchDriveFileBuffer(file.id, accessToken);
        const cloudinaryName = player.fullName.trim() || file.name;
        nextImagePath = await uploadPlayerImageToCloudinary(fileBuffer, cloudinaryName);
      } catch (uploadError) {
        failedUploads += 1;
        failedFiles.push({
          fileName: file.name,
          reason: uploadError instanceof Error ? uploadError.message : "Unknown upload error",
        });
        continue;
      }

      if (currentAdminImage === nextImagePath) {
        unchanged += 1;
        continue;
      }

      await prisma.$transaction([
        prisma.image.updateMany({
          where: { playerId: player.id, isAdminView: true },
          data: { isAdminView: false },
        }),
        prisma.image.create({
          data: {
            playerId: player.id,
            imageUrl: nextImagePath,
            isAdminView: true,
          },
        }),
      ]);

      updated += 1;
      updatedPlayers.push({
        playerId: player.id,
        playerName: player.fullName,
        fileName: file.name,
      });
    }

    return NextResponse.json({
      success: true,
      folderId,
      totalFiles: driveFiles.length,
      totalPlayersScanned: players.length,
      updated,
      unchanged,
      skippedExisting,
      skippedAmbiguous,
      unmatched,
      failedUploads,
      details: {
        updatedPlayers,
        unmatchedFiles: unmatchedFiles.slice(0, 100),
        ambiguousFiles: ambiguousFiles.slice(0, 100),
        failedFiles: failedFiles.slice(0, 100),
      },
    });
  } catch (error) {
    console.error("Drive photo import error:", error);
    return NextResponse.json(
      { error: "Failed to import photos from Google Drive" },
      { status: 500 },
    );
  }
}
