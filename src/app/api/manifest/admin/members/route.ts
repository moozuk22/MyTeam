import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function getClubName(clubIdRaw: string): Promise<string | null> {
  const clubId = clubIdRaw.trim();
  if (!clubId) {
    return null;
  }

  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { name: true },
    });
    const name = club?.name?.trim();
    return name || null;
  } catch (error) {
    console.error("Admin members manifest club lookup error:", error);
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clubId = (url.searchParams.get("clubId") ?? "").trim();
  const encodedClubId = encodeURIComponent(clubId);
  const manifestQuery = clubId ? `?clubId=${encodedClubId}` : "";
  const startUrl = clubId ? `/admin/members?clubId=${encodedClubId}` : "/admin/members";
  const clubName = await getClubName(clubId);
  const appName = clubName ? `${clubName} Members` : "My Team Members";

  return NextResponse.json({
    id: `/app/admin/members${manifestQuery}`,
    name: appName,
    short_name: clubName || "Members",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: `/api/manifest/admin/members/icon/192${manifestQuery}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: `/api/manifest/admin/members/icon/512${manifestQuery}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  });
}
