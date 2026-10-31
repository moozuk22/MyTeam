import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { getClubSubscriptionSummary } from "@/lib/clubSubscriptionSummary";
import { calculatorAccess } from "@/lib/calculatorSubscriptions";
import { UUID_PATTERN } from "@/lib/clubSubscriptionDomain";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Same club-level coach session model as the members page; group views omit this panel.
  if (request.nextUrl.searchParams.has("coachGroupId")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Invalid club" }, { status: 400 });
  if (!session.roles.includes("admin") && session.defaultClubId && session.defaultClubId !== id) {
    return NextResponse.json({ error: "Профилът ви няма достъп до този клуб." }, { status: 403 });
  }
  try {
    const [summary, calculator] = await Promise.all([getClubSubscriptionSummary(id), calculatorAccess(id)]);
    return NextResponse.json(summary ? {...summary, calculator} : null);
  }
  catch (error) { console.error("Club subscription summary failed:", error); return NextResponse.json({ error: "Абонаментът не може да бъде зареден." }, { status: 500 }); }
}
