import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { isUuid, listSentMessageFilterOptions, sentMessageViewer } from "@/lib/sentMessages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = sentMessageViewer(session);
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const clubId = params.get("clubId") || null;
  const coachGroupId = params.get("coachGroupId") || null;
  if ((clubId && !isUuid(clubId)) || (coachGroupId && !isUuid(coachGroupId))) {
    return NextResponse.json({ error: "Невалиден филтър." }, { status: 400 });
  }
  const search = (params.get("q") ?? "").trim().slice(0, 100);

  try {
    const options = await listSentMessageFilterOptions(viewer, { clubId, coachGroupId }, search);
    return NextResponse.json({ view: viewer.view, ...options });
  } catch (error) {
    console.error("Sent message filter load error:", error);
    return NextResponse.json({ error: "Неуспешно зареждане на филтрите." }, { status: 500 });
  }
}
