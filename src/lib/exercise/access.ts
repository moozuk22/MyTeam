import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, type AdminSessionPayload } from "@/lib/adminAuth";
import { hasTrustedOrigin } from "@/lib/requestOrigin";
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function canAccessTrainingClub(
  session: AdminSessionPayload,
  clubId: string,
) {
  return (
    session.roles.includes("admin") ||
    (session.roles.includes("coach") &&
      (!session.defaultClubId || session.defaultClubId === clubId))
  );
}
export async function authorizeTraining(request: NextRequest, clubId: string) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session)
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  if (!UUID_RE.test(clubId))
    return NextResponse.json({ error: "Невалиден клуб." }, { status: 400 });
  if (!canAccessTrainingClub(session, clubId))
    return NextResponse.json(
      { error: "Нямате достъп до този клуб." },
      { status: 403 },
    );
  if (!["GET", "HEAD"].includes(request.method) && !hasTrustedOrigin(request))
    return NextResponse.json(
      { error: "Невалиден източник на заявката." },
      { status: 403 },
    );
  return session;
}
