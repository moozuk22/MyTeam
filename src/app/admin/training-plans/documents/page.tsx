import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { canAccessTrainingClub, findTrainingPlanCoachGroup, UUID_RE } from "@/lib/exercise/access";
import { trainingPlanSearch } from "@/lib/exercise/planLocation";
import DocumentWorkspace from "./DocumentWorkspace";
import "../page.css";
import "./documents.css";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string; coachGroupId?: string; document?: string }>;
}) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const token = cookieStore.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) redirect("/admin/login");
  const clubId = params.clubId;
  if (typeof clubId !== "string" || !UUID_RE.test(clubId) || !canAccessTrainingClub(session, clubId)) notFound();
  const selected = params.document;
  if (selected !== undefined && (typeof selected !== "string" || (selected !== "new" && !UUID_RE.test(selected)))) notFound();
  const [club, coachGroup] = await Promise.all([
    prisma.club.findUnique({ where: { id: clubId }, select: { name: true } }),
    findTrainingPlanCoachGroup(clubId, params.coachGroupId),
  ]);
  if (!club || (params.coachGroupId && !coachGroup)) notFound();
  return <DocumentWorkspace
    key={`${clubId}:${coachGroup?.id ?? ""}:${selected ?? ""}`}
    clubId={clubId}
    clubName={club.name}
    groupName={coachGroup?.name}
    location={trainingPlanSearch(clubId, coachGroup?.id).toString()}
    selected={selected}
  />;
}
