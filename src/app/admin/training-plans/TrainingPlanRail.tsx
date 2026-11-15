import Image from "next/image";
import Link from "next/link";
import { House, Users, Wallet, Waypoints } from "lucide-react";

export default function TrainingPlanRail({ search, isAdmin }: { search: string; isAdmin: boolean }) {
  const membersHref = `/admin/members?${search}`;

  return (
    <nav className="tp-rail" aria-label="Администрация">
      <Link href={membersHref} className="tp-rail-logo" aria-label="MyTeam · Клуб">
        <Image src="/myteam-logo.webp" width={42} height={42} alt="" />
      </Link>
      <Link href={isAdmin ? membersHref : "/admin/coach-home"} title="Начало" aria-label="Начало"><House size={21} /></Link>
      <Link href={`/admin/training-plans?${search}`} aria-current="page" title="Планове за тренировки" aria-label="Планове за тренировки"><Waypoints size={21} /></Link>
      {isAdmin && (
        <>
          <Link href="/admin/players" title="Състезатели" aria-label="Състезатели"><Users size={21} /></Link>
          <Link href="/admin/subscriptions" title="Абонаменти" aria-label="Абонаменти"><Wallet size={21} /></Link>
        </>
      )}
    </nav>
  );
}
