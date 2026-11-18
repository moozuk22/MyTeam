import type { MetadataRoute } from "next";

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    ""
  );
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  const base: MetadataRoute.Robots = {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/zashto", "/funkcii", "/privacy", "/terms"],
        disallow: ["/admin/", "/member/", "/api/"],
      },
    ],
  };

  if (siteUrl) {
    base.sitemap = `${siteUrl}/sitemap.xml`;
    base.host = siteUrl;
  }

  return base;
}
