import type { NextRequest } from "next/server";

// In production, use the configured public address rather than the proxy's internal URL.
export function hasTrustedOrigin(request: NextRequest, requireOrigin = false): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return !requireOrigin;
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!baseUrl) return origin === request.nextUrl.origin;
  try {
    const configured = new URL(baseUrl);
    if (!["http:", "https:"].includes(configured.protocol)) return false;
    if (origin === configured.origin) return true;
    // Local development may keep the production URL for existing integrations.
    // Match the actual request URL; never add forwarded headers to the allowlist.
    return process.env.NODE_ENV === "development" && origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export function hasTrustedSchedule2Origin(request: NextRequest): boolean {
  if (hasTrustedOrigin(request)) return true;

  const { hostname, origin } = request.nextUrl;
  return process.env.NODE_ENV === "development" &&
    (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") &&
    request.headers.get("origin") === origin;
}
