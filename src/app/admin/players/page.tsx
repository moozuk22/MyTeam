import type { Metadata } from "next";
import AdminPlayersPageClient from "./page.client";

export const metadata: Metadata = {
  title: "Admin Players | My Team",
  applicationName: "My Team Admin",
  manifest: "/api/manifest/admin/players",
  appleWebApp: {
    title: "My Team Admin",
  },
  icons: {
    apple: [
      {
        url: "/apple-touch-icon.png",
      },
    ],
    shortcut: [
      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    icon: [
      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
};

export default function AdminPlayersPage() {
  return <AdminPlayersPageClient />;
}
