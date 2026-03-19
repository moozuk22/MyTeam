import { NextResponse } from "next/server";
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
    console.error("Manifest player lookup error:", error);
    return "My Team";
  }
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ cardCode: string }> }
) {
  const { cardCode } = await params;
  const playerName = await getPlayerShortcutName(cardCode);

  return NextResponse.json({
    id: "/app",
    name: playerName,
    short_name: playerName,
    start_url: `/member/${cardCode}`,
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  });
}
