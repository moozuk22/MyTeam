import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    id: "/app/admin/players",
    name: "My Team Admin",
    short_name: "Admin",
    start_url: "/admin/players",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/myteam-logo.webp",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/myteam-logo.webp",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  });
}
