import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingCoachNoteColumnError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("coach_note") ||
    message.includes("coachNote") ||
    message.includes("42703") || // Postgres undefined_column
    message.toLowerCase().includes("does not exist") && message.toLowerCase().includes("coach")
  );
}

async function requireCoachRole(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  const payload = token ? await verifyAdminToken(token) : null;
  if (!payload) return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  if (!payload.roles.includes("coach")) return { ok: false as const, status: 403 as const, error: "Forbidden" };
  return { ok: true as const };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCoachRole(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  let player: { id: string; coachNote: string | null; updatedAt: Date } | null = null;
  try {
    player = await prisma.player.findUnique({
      where: { id },
      select: { id: true, coachNote: true, updatedAt: true },
    });
  } catch (error) {
    if (isMissingCoachNoteColumnError(error)) {
      // DB hasn't been migrated yet; keep UI usable.
      return NextResponse.json(
        {
          id,
          note: "",
          updatedAt: new Date().toISOString(),
          warning: "Missing DB column coach_note. Apply migration to enable coach notes.",
        },
        { status: 200 },
      );
    }
    console.error("Coach note GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  if (!player) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: player.id,
    note: player.coachNote ?? "",
    updatedAt: player.updatedAt.toISOString(),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCoachRole(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawNote = (body as { note?: unknown }).note;
  const note = rawNote === null || rawNote === undefined ? "" : String(rawNote);
  if (note.length > 4000) {
    return NextResponse.json({ error: "Note is too long" }, { status: 400 });
  }

  let updated: { id: string; coachNote: string | null; updatedAt: Date } | null = null;
  try {
    updated = await prisma.player.update({
      where: { id },
      data: { coachNote: note.trim() ? note : null },
      select: { id: true, coachNote: true, updatedAt: true },
    });
  } catch (error) {
    if (isMissingCoachNoteColumnError(error)) {
      return NextResponse.json(
        { error: "Липсва поле в базата (coach_note). Пусни миграцията и опитай пак." },
        { status: 409 },
      );
    }
    console.error("Coach note PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    note: updated.coachNote ?? "",
    updatedAt: updated.updatedAt.toISOString(),
  });
}

