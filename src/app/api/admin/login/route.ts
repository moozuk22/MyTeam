import { NextRequest, NextResponse } from "next/server";
import { createAdminToken, verifyPassword } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const inputPassword = String(password ?? "");

    if (!inputPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        password: true,
        roles: true,
      },
    });

    const matchedUser = users.find((user) => verifyPassword(inputPassword, user.password));
    if (!matchedUser) {
      // Transitional fallback: keep current single-password flow if users are not seeded yet.
      if (users.length === 0 && inputPassword === process.env.ADMIN_PASSWORD) {
        const token = await createAdminToken({
          userId: "env-admin",
          roles: ["admin", "coach"],
          defaultClubId: null,
        });

        const response = NextResponse.json({ success: true });
        response.cookies.set({
          name: "admin_session",
          value: token,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
        return response;
      }

      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const defaultClub =
      matchedUser.roles.includes("coach") && !matchedUser.roles.includes("admin")
        ? await prisma.club.findFirst({
            select: { id: true },
            orderBy: { createdAt: "asc" },
          })
        : null;

    const token = await createAdminToken({
      userId: matchedUser.id,
      roles: matchedUser.roles,
      defaultClubId: defaultClub?.id ?? null,
    });

    const response = NextResponse.json({ success: true });

    response.cookies.set({
      name: "admin_session",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
