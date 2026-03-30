import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { inferDeviceLabel } from "@/lib/push/device";
import {
  deactivateAdminPushSubscription,
  isAdminPushSubscriptionActive,
  saveAdminPushSubscription,
} from "@/lib/push/adminService";
import { parseBrowserPushSubscription } from "@/lib/push/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifySession(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  return token ? await verifyAdminToken(token) : null;
}

async function ensureClubExists(clubId: string) {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { id: true },
  });
  return Boolean(club);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clubId } = await params;
  if (!(await ensureClubExists(clubId))) {
    return NextResponse.json({ error: "Club not found." }, { status: 404 });
  }

  const endpoint = request.nextUrl.searchParams.get("endpoint")?.trim() ?? "";
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  try {
    const isActive = await isAdminPushSubscriptionActive(clubId, endpoint);
    return NextResponse.json({ success: true, isActive });
  } catch (error) {
    console.error("Admin push subscription GET error:", error);
    return NextResponse.json({ error: "Failed to fetch push subscription state." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clubId } = await params;
  if (!(await ensureClubExists(clubId))) {
    return NextResponse.json({ error: "Club not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as { subscription?: unknown };
  const subscription = parseBrowserPushSubscription(payload.subscription);
  if (!subscription) {
    return NextResponse.json({ error: "Invalid push subscription payload" }, { status: 400 });
  }

  try {
    const userAgent = request.headers.get("user-agent");
    const device = inferDeviceLabel(userAgent);
    const saved = await saveAdminPushSubscription({
      clubId,
      subscription,
      userAgent,
      device,
    });

    return NextResponse.json({
      success: true,
      id: saved.id,
      isActive: saved.isActive,
    });
  } catch (error) {
    console.error("Admin push subscription save error:", error);
    return NextResponse.json({ error: "Failed to save push subscription" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clubId } = await params;
  if (!(await ensureClubExists(clubId))) {
    return NextResponse.json({ error: "Club not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const endpoint = String((body as { endpoint?: unknown }).endpoint ?? "").trim();
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  try {
    await deactivateAdminPushSubscription(clubId, endpoint);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin push subscription deactivate error:", error);
    return NextResponse.json({ error: "Failed to deactivate push subscription" }, { status: 500 });
  }
}
