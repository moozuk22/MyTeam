import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import AdminMembersPageClient from "./page.client";

type MembersPageSearchParams = {
  clubId?: string | string[];
};

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
    console.error("Admin members page metadata club lookup error:", error);
    return null;
  }
}

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<MembersPageSearchParams> },
): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const clubIdValue = resolvedSearchParams.clubId;
  const clubId =
    (Array.isArray(clubIdValue) ? clubIdValue[0] : clubIdValue ?? "").trim();
  const encodedClubId = encodeURIComponent(clubId);
  const manifestQuery = clubId ? `?clubId=${encodedClubId}` : "";
  const clubName = await getClubName(clubId);
  const appName = clubName ? `${clubName} Members` : "My Team Members";

  return {
    title: `${appName} | My Team`,
    applicationName: appName,
    manifest: `/api/manifest/admin/members${manifestQuery}`,
    appleWebApp: {
      title: appName,
    },
    icons: {
      apple: [
        {
          url: `/api/manifest/admin/members/icon/180${manifestQuery}`,
          sizes: "180x180",
        },
      ],
      shortcut: [
        {
          url: `/api/manifest/admin/members/icon/192${manifestQuery}`,
          sizes: "192x192",
          type: "image/png",
        },
      ],
      icon: [
        {
          url: `/api/manifest/admin/members/icon/192${manifestQuery}`,
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: `/api/manifest/admin/members/icon/512${manifestQuery}`,
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
  };
}

export default function AdminMembersPage() {
  return <AdminMembersPageClient />;
}
