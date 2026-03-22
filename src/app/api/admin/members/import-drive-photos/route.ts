import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";

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

function buildDriveViewUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

async function fetchDriveFilesFromFolder(folderId: string, apiKey: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
      fields: "nextPageToken,files(id,name,mimeType)",
      pageSize: "1000",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
      key: apiKey,
    });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      method: "GET",
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

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_DRIVE_API_KEY is not configured" },
      { status: 500 },
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

    const driveFiles = await fetchDriveFilesFromFolder(folderId, apiKey);
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

    const unmatchedFiles: string[] = [];
    const ambiguousFiles: string[] = [];
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
      const nextDriveUrl = buildDriveViewUrl(file.id);
      const currentAdminImage = player.images.find((image) => image.isAdminView)?.imageUrl ?? null;

      if (currentAdminImage === nextDriveUrl) {
        unchanged += 1;
        continue;
      }
      if (currentAdminImage && !overwrite) {
        skippedExisting += 1;
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
            imageUrl: nextDriveUrl,
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
      details: {
        updatedPlayers,
        unmatchedFiles: unmatchedFiles.slice(0, 100),
        ambiguousFiles: ambiguousFiles.slice(0, 100),
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

