import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaClientBootstrap } from "@/components/pwa/PwaClientBootstrap";

export const metadata: Metadata = {
  applicationName: "My Team",
  title: "My Team",
  description: "NFC member management and attendance tracking.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "My Team",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bg">
      <body>
        <PwaClientBootstrap />
        {children}
      </body>
    </html>
  );
}
