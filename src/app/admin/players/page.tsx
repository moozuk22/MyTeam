import type { Metadata } from "next";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
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
  return (
    <>
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "16px 20px 0",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <AdminLogoutButton />
      </div>
      <AdminPlayersPageClient />
    </>
  );
}
