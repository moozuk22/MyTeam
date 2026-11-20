import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { verifyAdminToken } from "@/lib/adminAuth";
import { canAccessTrainingClub, findTrainingPlanCoachGroup, UUID_RE } from "@/lib/exercise/access";
import { getTodayIsoDateInTimeZone } from "@/lib/training";
import { monday } from "@/lib/exercise/microcycle";
import { prisma } from "@/lib/db";
import { applyCloudinaryTransformToUrl, buildCloudinaryUrlFromUploadPath } from "@/lib/cloudinaryImagePath";
import { currentCompetitionSeason } from "@/lib/exercise/document";
import { sessionTarget } from "@/lib/exercise/trainingSession";
import Workspace from "./workspace";
import "../page.css";
export default async function Page({ searchParams }: { searchParams: Promise<{ clubId?: string; coachGroupId?: string }> }) {
  const p = await searchParams;
  const token = (await cookies()).get("admin_session")?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) redirect("/admin/login");
  if (!p.clubId || !UUID_RE.test(p.clubId) || !canAccessTrainingClub(session, p.clubId)) notFound();
  if (p.coachGroupId !== undefined && !await findTrainingPlanCoachGroup(p.clubId, p.coachGroupId)) notFound();
  const club = await prisma.club.findUnique({ where: { id: p.clubId }, select: { imageUrl: true, emblemUrl: true } });
  const storedLogo = (club?.imageUrl || club?.emblemUrl)?.trim();
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const clubLogoUrl = storedLogo && /^https?:\/\//i.test(storedLogo)
    ? applyCloudinaryTransformToUrl(storedLogo, "w_240,h_240,c_limit,f_auto,q_auto:eco")
    : storedLogo && cloudName ? buildCloudinaryUrlFromUploadPath(storedLogo, cloudName, "w_240,h_240,c_limit,f_auto,q_auto:eco") : storedLogo;
  return <Workspace restore={sessionTarget(p) ?? undefined} competitionSeason={currentCompetitionSeason()} clubId={p.clubId} coachGroupId={p.coachGroupId} clubLogoUrl={clubLogoUrl || undefined} initialWeek={monday(getTodayIsoDateInTimeZone("Europe/Sofia"))} />;
}
