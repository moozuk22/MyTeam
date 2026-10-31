import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { verifyAdminToken } from '@/lib/adminAuth';
import { prisma } from '@/lib/db';
import ClubFinancePanel from '@/app/admin/members/_components/ClubFinancePanel';
import styles from './page.module.css';
import { applyCloudinaryTransformToUrl, buildCloudinaryUrlFromUploadPath } from '@/lib/cloudinaryImagePath';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Финанси на клуба | My Team' };
export default async function ClubFinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const token = (await cookies()).get('admin_session')?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) redirect('/admin/login');
  if (!session.roles.includes('admin') && session.defaultClubId && session.defaultClubId !== id) notFound();
  const club = await prisma.club.findUnique({ where: { id }, select: { name: true, imageUrl: true, emblemUrl: true } });
  if (!club) notFound();
  const storedLogo = (club.imageUrl || club.emblemUrl)?.trim();
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const logoTransform = 'w_120,h_120,c_limit,f_auto,q_auto:eco';
  const clubLogoUrl = storedLogo && /^https?:\/\//i.test(storedLogo)
    ? applyCloudinaryTransformToUrl(storedLogo, logoTransform)
    : storedLogo && cloudName
      ? buildCloudinaryUrlFromUploadPath(storedLogo, cloudName, logoTransform)
      : storedLogo;
  return <main className={styles.page}>
    <Link className={styles.back} href={`/admin/members?clubId=${encodeURIComponent(id)}`}><ArrowLeft size={16} aria-hidden="true" /><span>Назад</span></Link>
    <ClubFinancePanel clubId={id} clubName={club.name} clubLogoUrl={clubLogoUrl} />
  </main>;
}
