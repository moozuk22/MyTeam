import type { Metadata } from "next";
import { after } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { fireN8nWebhook } from "@/lib/n8nWebhook";
import AdminMembersPageClient from "./page.client";

type MembersPageSearchParams = {
  clubId?: string | string[];
};

async function getClubData(clubIdRaw: string): Promise<{ name: string; notifyOnCoachVisit: boolean } | null> {
  const clubId = clubIdRaw.trim();
  if (!clubId) {
    return null;
  }

  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { name: true, notifyOnCoachVisit: true },
    });
    const name = club?.name?.trim();
    if (!name) return null;
    return { name, notifyOnCoachVisit: club?.notifyOnCoachVisit ?? false };
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
  const clubData = await getClubData(clubId);
  const appName = clubData?.name ? `${clubData.name} Members` : "My Team Members";

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

export default async function AdminMembersPage(
  { searchParams }: { searchParams: Promise<MembersPageSearchParams> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (token) {
    const session = await verifyAdminToken(token);
    if (session?.roles.includes("coach") && !session.roles.includes("admin")) {
      const resolvedSearchParams = await searchParams;
      const clubIdValue = resolvedSearchParams.clubId;
      const clubId = (Array.isArray(clubIdValue) ? clubIdValue[0] : clubIdValue ?? "").trim();
      if (clubId) {
        const club = await getClubData(clubId);
        if (club?.notifyOnCoachVisit) {
          after(async () => {
            const now = new Date();
            const час = new Intl.DateTimeFormat("bg-BG", {
              timeZone: "Europe/Sofia",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }).format(now);
            await fireN8nWebhook({
              "Отбор": club.name,
              "Час": час,
            });
          });
        }
      }
    }
  }
  return <AdminMembersPageClient />;
}
