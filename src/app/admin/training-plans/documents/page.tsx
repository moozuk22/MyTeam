import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";
import { canAccessTrainingClub, findTrainingPlanCoachGroup, UUID_RE } from "@/lib/exercise/access";
import { trainingPlanSearch } from "@/lib/exercise/planLocation";
import { currentCompetitionSeason } from "@/lib/exercise/document";
import { applyCloudinaryTransformToUrl, buildCloudinaryUrlFromUploadPath } from "@/lib/cloudinaryImagePath";
import { sessionTarget, sessionOrigin } from "@/lib/exercise/trainingSession";
import DocumentWorkspace from "./DocumentWorkspace";
import "../page.css";
import "./documents.css";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string; coachGroupId?: string; document?: string; link?: string; replace?: string }>;
}) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const token = cookieStore.get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) redirect("/admin/login");
  const clubId = params.clubId;
  if (typeof clubId !== "string" || !UUID_RE.test(clubId) || !canAccessTrainingClub(session, clubId)) notFound();
  const target = sessionTarget(params);
  if (["rowId", "cycleId", "groupKey", "week"].some(key => key in params) && (!target || !params.coachGroupId || !params.document)) notFound();
  const selected = params.document;
  if (selected === "choose" && !target) notFound();
  if (selected !== undefined && (typeof selected !== "string" || (selected !== "new" && selected !== "choose" && !UUID_RE.test(selected)))) notFound();
  // "link=1" opens an unlinked plan for a training. The plan is linked when the coach saves it.
  const link = params.link !== undefined;
  if (link && (params.link !== "1" || !target || !selected || !UUID_RE.test(selected))) notFound();
  // "replace=<id>" chooses another plan for a training. The server replaces the plan only while the training still uses it.
  const replace = params.replace;
  if (replace !== undefined && (typeof replace !== "string" || !UUID_RE.test(replace) || !target
    || !(selected === "choose" || selected === "new" || link))) notFound();
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
    key={`${clubId}:${coachGroup?.id ?? ""}:${selected ?? ""}:${target ? sessionOrigin(target) : ""}:${link}:${replace ?? ""}`}
    target={target ?? undefined}
    clubId={clubId}
    clubName={club.name}
    clubLogoUrl={clubLogoUrl}
    groupName={coachGroup?.name}
    competitionSeason={currentCompetitionSeason()}
    location={trainingPlanSearch(clubId, coachGroup?.id).toString()}
    selected={selected}
    link={link}
    replace={replace}
  />;
}
