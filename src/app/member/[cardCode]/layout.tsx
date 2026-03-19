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
  const playerName = await getPlayerShortcutName(cardCode);

  return {
    title: playerName,
    applicationName: playerName,
    manifest: `/api/manifest/${cardCode}`,
    appleWebApp: {
      title: playerName,
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
