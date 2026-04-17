import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { getGoogleServiceAccountToken } from "@/lib/googleAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId") || "root";
  const mode = searchParams.get("mode");
  const fileTypeFilter =
    mode === "photos"
      ? "(mimeType='application/vnd.google-apps.folder' or mimeType contains 'image/')"
      : "(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.folder')";
  const query =
    folderId === "root"
      ? `trashed=false and ${fileTypeFilter} and ('root' in parents or sharedWithMe=true)`
      : `'${folderId}' in parents and trashed=false and ${fileTypeFilter}`;

  let accessToken: string;
  try {
    accessToken = await getGoogleServiceAccountToken();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Google credentials error" },
      { status: 503 },
    );
  }

  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name,mimeType)",
    pageSize: "200",
    orderBy: "folder,name",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
    corpora: "allDrives",
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Google Drive API error (${res.status}): ${body.slice(0, 200)}` },
      { status: 502 },
    );
  }

  const data = (await res.json()) as { files?: DriveItem[] };
  const files = data.files ?? [];

  const folders = files
    .filter((f) => f.mimeType === "application/vnd.google-apps.folder")
    .sort((a, b) => a.name.localeCompare(b.name, "bg"));

  const sheets = files
    .filter((f) => f.mimeType === "application/vnd.google-apps.spreadsheet")
    .sort((a, b) => a.name.localeCompare(b.name, "bg"));

  const images = files
    .filter((f) => f.mimeType.startsWith("image/"))
    .sort((a, b) => a.name.localeCompare(b.name, "bg"));

  return NextResponse.json({ folders, sheets, images });
}
