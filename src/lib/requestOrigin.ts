import type { NextRequest } from "next/server";

// In production, use the configured public address rather than the proxy's internal URL.
export function hasTrustedOrigin(request: NextRequest, requireOrigin = false): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return !requireOrigin;
  const host = request.headers.get("host");
  // Next.js development URLs can use an internal hostname. Compare the direct
  // Host header with the browser origin. Do not trust forwarded host headers.
  const matchesRequest = origin === request.nextUrl.origin || (
    process.env.NODE_ENV === "development" && !!host &&
    origin === `${request.nextUrl.protocol}//${host}`
  );
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!baseUrl) return matchesRequest;
  try {
    const configured = new URL(baseUrl);
    if (!["http:", "https:"].includes(configured.protocol)) return false;
    if (origin === configured.origin) return true;
    // Local development may keep the production URL for existing integrations.
    return process.env.NODE_ENV === "development" && matchesRequest;
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
