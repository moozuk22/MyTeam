import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { isUuid, listSentMessages, sentMessageViewer } from "@/lib/sentMessages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function optionalUuid(value: string | null) {
  if (value === null || value === "") return { ok: true as const, value: null };
  return isUuid(value) ? { ok: true as const, value } : { ok: false as const };
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = sentMessageViewer(session);
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const clubId = optionalUuid(params.get("clubId"));
  const coachGroupId = optionalUuid(params.get("coachGroupId"));
  const playerId = optionalUuid(params.get("playerId"));
  const cursor = optionalUuid(params.get("cursor"));
  if (!clubId.ok || !coachGroupId.ok || !playerId.ok || !cursor.ok) {
    return NextResponse.json({ error: "Невалиден филтър." }, { status: 400 });
  }

  try {
    const result = await listSentMessages(
      viewer,
      { clubId: clubId.value, coachGroupId: coachGroupId.value, playerId: playerId.value },
      cursor.value,
    );
    return NextResponse.json({ view: viewer.view, ...result });
  } catch (error) {
    console.error("Sent message history load error:", error);
    return NextResponse.json({ error: "Неуспешно зареждане на историята." }, { status: 500 });
  }
}
