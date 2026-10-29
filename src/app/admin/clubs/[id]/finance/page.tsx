import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyAdminToken } from '@/lib/adminAuth';
import { prisma } from '@/lib/db';
import ClubFinancePanel from '@/app/admin/members/_components/ClubFinancePanel';
import styles from './page.module.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Финанси на клуба | My Team' };
export default async function ClubFinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const token = (await cookies()).get('admin_session')?.value;
  const session = token ? await verifyAdminToken(token) : null;
  if (!session) redirect('/admin/login');
  if (!session.roles.includes('admin') && session.defaultClubId !== id) notFound();
  const club = await prisma.club.findUnique({ where: { id }, select: { name: true } });
  if (!club) notFound();
  return <main className={styles.page}>
    <Link className={styles.back} href={`/admin/members?clubId=${encodeURIComponent(id)}`}>← Към клуба</Link>
    <ClubFinancePanel clubId={id} clubName={club.name} />
  </main>;
}
