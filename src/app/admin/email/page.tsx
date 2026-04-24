import type { Metadata } from "next";
import AdminEmailPageClient from "./page.client";

export const metadata: Metadata = {
  title: "Изпрати имейл | My Team Admin",
  applicationName: "My Team Admin",
  manifest: "/api/manifest/admin/players",
  appleWebApp: { title: "My Team Admin" },
  icons: {
    apple: [{ url: "/myteam-logo.png" }],
    shortcut: [{ url: "/myteam-logo.png", sizes: "192x192", type: "image/png" }],
    icon: [
      { url: "/myteam-logo.png", sizes: "192x192", type: "image/png" },
      { url: "/myteam-logo.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export default function AdminEmailPage() {
  return <AdminEmailPageClient />;
}
