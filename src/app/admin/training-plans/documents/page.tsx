import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { canAccessTrainingClub, findTrainingPlanCoachGroup, UUID_RE } from "@/lib/exercise/access";
import { trainingPlanSearch } from "@/lib/exercise/planLocation";
import { currentCompetitionSeason } from "@/lib/exercise/document";
import { applyCloudinaryTransformToUrl, buildCloudinaryUrlFromUploadPath } from "@/lib/cloudinaryImagePath";
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
    prisma.club.findUnique({ where: { id: clubId }, select: { name: true, imageUrl: true, emblemUrl: true } }),
    findTrainingPlanCoachGroup(clubId, params.coachGroupId),
  ]);
  if (!club || (params.coachGroupId && !coachGroup)) notFound();
  const storedLogo = (club.imageUrl || club.emblemUrl)?.trim();
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const clubLogoUrl = storedLogo && /^https?:\/\//i.test(storedLogo)
    ? applyCloudinaryTransformToUrl(storedLogo, "w_240,h_240,c_limit,f_auto,q_auto:eco")
    : storedLogo && cloudName
      ? buildCloudinaryUrlFromUploadPath(storedLogo, cloudName, "w_240,h_240,c_limit,f_auto,q_auto:eco")
      : storedLogo;
  return <DocumentWorkspace
    key={`${clubId}:${coachGroup?.id ?? ""}:${selected ?? ""}`}
    clubId={clubId}
    clubName={club.name}
    clubLogoUrl={clubLogoUrl}
    groupName={coachGroup?.name}
    competitionSeason={currentCompetitionSeason()}
    location={trainingPlanSearch(clubId, coachGroup?.id).toString()}
    selected={selected}
  />;
}
