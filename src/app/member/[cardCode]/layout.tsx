import type { Metadata } from "next";
import { prisma } from "@/lib/db";

async function getPlayerShortcutName(cardCodeRaw: string): Promise<string> {
  const cardCode = cardCodeRaw.trim().toUpperCase();
  if (!cardCode) {
    return "My Team";
  }

  try {
    const card = await prisma.card.findFirst({
      where: {
        cardCode,
        isActive: true,
      },
      select: {
        player: {
          select: {
            fullName: true,
          },
        },
      },
    });

    const fullName = card?.player.fullName?.trim();
    return fullName || "My Team";
  } catch (error) {
    console.error("Member layout metadata lookup error:", error);
    return "My Team";
  }
}

export async function generateMetadata(
    { params }: { params: Promise<{ cardCode: string }> }
): Promise<Metadata> {
  const { cardCode } = await params;
  const normalizedCardCode = cardCode.trim().toUpperCase();
  const playerName = await getPlayerShortcutName(cardCode);

  return {
    title: playerName,
    applicationName: playerName,
    manifest: `/api/manifest/${encodeURIComponent(normalizedCardCode)}`,
    appleWebApp: {
      title: playerName,
    },
    icons: {
      apple: [
        {
          url: `/api/manifest/${encodeURIComponent(normalizedCardCode)}/icon/180`,
          sizes: "180x180",
        },
      ],
      shortcut: [
        {
          url: `/api/manifest/${encodeURIComponent(normalizedCardCode)}/icon/192`,
          sizes: "192x192",
          type: "image/png",
        },
      ],
      icon: [
        {
          url: `/api/manifest/${encodeURIComponent(normalizedCardCode)}/icon/192`,
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: `/api/manifest/${encodeURIComponent(normalizedCardCode)}/icon/512`,
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
  };
}

export default function MemberLayout({
                                       children,
                                     }: {
  children: React.ReactNode;
}) {
  return children;
}
