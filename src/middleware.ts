import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminSession = request.cookies.get("admin_session")?.value;

  const SECRET = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET || "default_secret_for_safety");
  const COACH_ALLOWED_ADMIN_PAGE_PREFIXES = ["/admin/members"];
  const COACH_ALLOWED_ADMIN_API_PREFIXES = ["/api/admin/members", "/api/admin/clubs"];
  const COACH_ALLOWED_ADMIN_API_EXACT = new Set(["/api/admin/check-session", "/api/admin/logout"]);

  // Protect admin routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    // Exception for login page and login API
    if (
      pathname === "/admin/login" ||
      pathname === "/api/admin/login" ||
      pathname === "/api/admin/check-session"
    ) {
      if (adminSession && pathname === "/admin/login") {
        try {
          const { payload } = await jwtVerify(adminSession, SECRET);
          const roles = Array.isArray(payload.roles)
            ? payload.roles.filter((role): role is "admin" | "coach" => role === "admin" || role === "coach")
            : [];

          if (roles.includes("admin")) {
            return NextResponse.redirect(new URL("/admin/players", request.url));
          }

          if (roles.includes("coach")) {
            const defaultClubId =
              typeof payload.defaultClubId === "string" && payload.defaultClubId.trim()
                ? payload.defaultClubId.trim()
                : "";
            const coachPath = defaultClubId
              ? `/admin/members?clubId=${encodeURIComponent(defaultClubId)}`
              : "/admin/members";
            return NextResponse.redirect(new URL(coachPath, request.url));
          }

          const response = NextResponse.next();
          response.cookies.delete("admin_session");
          return response;
        } catch {
          // Invalid token, allow access to login
        }
      }
      return NextResponse.next();
    }

    if (!adminSession) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    try {
      const { payload } = await jwtVerify(adminSession, SECRET);
      const roles = Array.isArray(payload.roles)
        ? payload.roles.filter((role): role is "admin" | "coach" => role === "admin" || role === "coach")
        : [];

      if (roles.length === 0) {
        const response = pathname.startsWith("/api/")
          ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
          : NextResponse.redirect(new URL("/admin/login", request.url));
        response.cookies.delete("admin_session");
        return response;
      }

      if (roles.includes("admin")) {
        return NextResponse.next();
      }

      if (roles.includes("coach")) {
        const defaultClubId =
          typeof payload.defaultClubId === "string" && payload.defaultClubId.trim()
            ? payload.defaultClubId.trim()
            : "";
        const coachHomePath = defaultClubId
          ? `/admin/members?clubId=${encodeURIComponent(defaultClubId)}`
          : "/admin/members";

        if (pathname.startsWith("/api/admin")) {
          if (COACH_ALLOWED_ADMIN_API_EXACT.has(pathname)) {
            return NextResponse.next();
          }
          if (COACH_ALLOWED_ADMIN_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
            return NextResponse.next();
          }
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (COACH_ALLOWED_ADMIN_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
          return NextResponse.next();
        }

        return NextResponse.redirect(new URL(coachHomePath, request.url));
      }

      return NextResponse.next();
    } catch {
      const response = pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL("/admin/login", request.url));
      
      response.cookies.delete("admin_session");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
