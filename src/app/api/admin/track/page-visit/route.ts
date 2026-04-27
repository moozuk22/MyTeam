import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { fireN8nWebhook } from "@/lib/n8nWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifyAdminToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.roles.includes("coach") || session.roles.includes("admin")) {
    return NextResponse.json({ success: true });
  }

  let clubId: string | undefined;
  try {
    const body = (await request.json()) as { clubId?: string };
    clubId = body.clubId;
  } catch {
    // no body is fine
  }

  let clubName: string | null = null;
  if (clubId) {
    try {
      const club = await prisma.club.findUnique({ where: { id: clubId }, select: { name: true } });
      clubName = club?.name ?? null;
    } catch {
      // non-fatal — proceed without club name
    }
  }

  await fireN8nWebhook({
    event: "coach_page_visit",
    page: "/admin/members",
    clubId: clubId ?? null,
    clubName,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
