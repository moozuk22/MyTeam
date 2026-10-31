'use client';
import Link from 'next/link';
import type { CalculatorAccess } from '@/lib/calculatorSubscriptionDomain';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { getClubFinance } from '@/lib/clubFinance';
import { financeDateKey } from '@/lib/clubFinanceDomain';
import styles from './ClubFinancePanel.module.css';
import FinanceDashboard from './FinanceDashboard';
import { FinanceMetricSkeleton, SkeletonLine } from './FinanceSkeleton';
import { CalendarDays, ChevronDown, Wallet, Users, ArrowUpRight } from 'lucide-react';
type View = Awaited<ReturnType<typeof getClubFinance>>;
const money = (amount: string, currency = 'EUR') => new Intl.NumberFormat('bg-BG', { style: 'currency', currency }).format(Number(amount));
type PanelProps = { clubLogoUrl?: string | null; clubName?: string; clubId: string; revision?: unknown; compact?: boolean };
export default function ClubFinancePanel(props: PanelProps) {
  const [access,setAccess] = useState<(CalculatorAccess & {debtSummary?: {outstanding:string;count:number;incomplete:boolean}}) | null>(null);
  const [accessClub,setAccessClub] = useState('');
  const [accessError,setAccessError] = useState('');
  const accessRequest = useRef(0);
  const { clubId, revision } = props;
  useEffect(() => {
    let cancelled=false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      const current=++accessRequest.current;
      try {
        const response=await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/calculator-access`,{cache:'no-store'});
        const result=await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!cancelled && current===accessRequest.current) {
          setAccess(result); setAccessClub(clubId); setAccessError('');
          clearTimeout(expiryTimer);
          const nextBoundary=(result as CalculatorAccess).periods.flatMap(p=>[p.startsAt,p.endsAt]).filter((p):p is string=>!!p).map(p=>new Date(p).getTime()).filter(t=>t>Date.now()).sort((a,b)=>a-b)[0];
          if(nextBoundary) expiryTimer=setTimeout(()=>void check(),Math.min(nextBoundary-Date.now()+50,2147483647));
        }
      } catch(error) { if (!cancelled && current===accessRequest.current) { setAccess(null); setAccessError(error instanceof Error?error.message:'Достъпът не може да бъде проверен.'); } }
    };
    const refresh = () => { if(!document.hidden) void check(); };
    void check();
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    const timer=setInterval(refresh,60000);
    return () => { cancelled=true; clearInterval(timer); clearTimeout(expiryTimer); window.removeEventListener('focus',refresh); document.removeEventListener('visibilitychange',refresh); };
  },[clubId,revision]);
  if(accessError) return <section className={styles.panel}><p role="alert">{accessError}</p></section>;
  const currentAccess = accessClub === clubId ? access : null;
  if(props.compact && !currentAccess) return <section className={styles.panel} aria-label="Финанси на клуба">
    <div className={styles.content} aria-busy="true"><div role="status" aria-label="Зареждане на финансите">
      <div className={`${styles.metrics} ${styles.widgetMetrics}`} aria-hidden="true">
        <div><span><Wallet size={22} aria-hidden="true" />Баланс</span><FinanceMetricSkeleton /><small>От началото</small></div>
        <div><span><Users size={22} aria-hidden="true" />Задължения</span><FinanceMetricSkeleton /><SkeletonLine /></div>
      </div>
    </div></div>
    <Link className={styles.link} aria-label="Виж финансите" href={`/admin/clubs/${encodeURIComponent(clubId)}/finance`}><ArrowUpRight size={21} aria-hidden="true" /></Link>
  </section>;
  if(props.compact && !currentAccess?.canView) return <section className={styles.panel} aria-label="Финанси на клуба — заключено">
    <div className={styles.content}><div className={`${styles.metrics} ${styles.widgetMetrics}`}>
      <div><span><Wallet size={22} aria-hidden="true" />Баланс</span><strong className={styles.blurredBalance} aria-hidden="true">•••,•• €</strong><small>Балансът е заключен 🔒</small></div>
      <div><span><Users size={22} aria-hidden="true" />Задължения</span>{currentAccess?.debtSummary ? <><strong className={styles.negative}>{currentAccess.debtSummary.incomplete ? '≥ ' : ''}{money(currentAccess.debtSummary.outstanding)}</strong><small>{currentAccess.debtSummary.count} състезатели{currentAccess.debtSummary.incomplete ? ' · неуточнени такси' : ''}</small></> : <FinanceMetricSkeleton />}</div>
    </div>{currentAccess && <small>Финансовият калкулатор не е активиран. Свържете се с администратора за активиране.</small>}</div>
    <Link className={styles.link} aria-label="Виж финансите" href={`/admin/clubs/${encodeURIComponent(clubId)}/finance`}><ArrowUpRight size={21} aria-hidden="true" /></Link>
  </section>;
  if(!currentAccess || !access) return null;

  return <>
    {!props.compact && !access.enabled && <p className={styles.inactiveNotice}>Калкулаторът е неактивен. {access.canView ? 'Администраторският преглед не включва записване на данни.' : 'Свържете се с администратора за активиране.'}</p>}
    {!props.compact && <details className={styles.coverage}><summary>Периоди на финансово отчитане</summary><p>Балансът включва запазените приходи и разходи от активните периоди, както и запазената история преди въвеждането на абонамента или анулиране на плащане. Пропуските между изброените периоди не са включени. Ново плащане за минал период възстановява автоматичните приходи за него.</p><ul>{access.periods.map((p,i)=><li key={`${p.startsAt}-${i}`}>{new Intl.DateTimeFormat('bg-BG',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Sofia'}).format(new Date(p.startsAt))} → {p.endsAt?new Intl.DateTimeFormat('bg-BG',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Sofia'}).format(new Date(p.endsAt)):'безсрочно'}{p.endsAt?' (краят не е включен)':''}</li>)}</ul></details>}
    <FinancePanel {...props} calculatorCanView={access.canView} calculatorEnabled={access.enabled} />
  </>;
}
export function FinancePanel({ clubId, revision, compact = false, clubName, clubLogoUrl, calculatorEnabled = true, calculatorCanView = calculatorEnabled }: { calculatorCanView?: boolean; calculatorEnabled?: boolean; clubLogoUrl?: string | null; clubName?: string; clubId: string; revision?: unknown; compact?: boolean }) {
  const [data,setData] = useState<View | null>(null);
  const [monthlyData,setMonthlyData] = useState<View | null>(null);
  const [period,setPeriod] = useState<'range' | 'all'>('range');
  const [rangeOpen,setRangeOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const rangeButtonRef = useRef<HTMLButtonElement>(null);
  const rangeId = useId();
  useEffect(() => {
    if (!rangeOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !filtersRef.current?.contains(event.target)) setRangeOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRangeOpen(false);
        rangeButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown',dismiss);
    document.addEventListener('keydown',escape);
    return () => { document.removeEventListener('pointerdown',dismiss); document.removeEventListener('keydown',escape); };
  }, [rangeOpen]);
  const [rangeStart,setRangeStart] = useState(financeDateKey().slice(0,7));
  const [rangeEnd,setRangeEnd] = useState(financeDateKey().slice(0,7));
  const reportPeriod = `${rangeStart}..${rangeEnd}`;
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const requestId = useRef(0);
  const base = `/api/admin/clubs/${encodeURIComponent(clubId)}/finance`;
  const refresh = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    try {
      const load = async (month: string): Promise<View> => {
        const response = await fetch(`${base}?month=${month}${!calculatorCanView ? '&view=dues' : ''}`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        return result;
      };
      const [result,monthly] = await Promise.all([load('all'), compact || !calculatorCanView ? Promise.resolve(null) : load(reportPeriod)]);
      if (current === requestId.current) { setData(result); setMonthlyData(monthly); setError(''); }
    } catch (err) { if (current === requestId.current) { setData(null); setMonthlyData(null); setError(err instanceof Error ? err.message : 'Грешка при зареждане.'); } }
    finally { if (current === requestId.current) setLoading(false); }
  }, [base,compact,reportPeriod,calculatorCanView]);
  useEffect(() => {
    void refresh();
    if (!compact) {
      // Ignore responses from a report that has been replaced or unmounted.
      return () => { requestId.current++; };
    }
    const update = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('focus',update);
    document.addEventListener('visibilitychange',update);
    const timer = window.setInterval(update,60000);
    // Invalidate pending responses when the selected report changes or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { requestId.current++; clearInterval(timer); window.removeEventListener('focus',update); document.removeEventListener('visibilitychange',update); };
  }, [refresh,revision,compact]);
  if (compact) return <section className={styles.panel} aria-label="Финанси на клуба">
    <div className={styles.content} aria-busy={loading || (!data && !error)}>
      {error && <p className={styles.error} role="alert">{error} <button type="button" onClick={() => void refresh()}>Опитай отново</button></p>}
      {!data && !error && <div role="status" aria-label="Зареждане на финансите">
        <div className={`${styles.metrics} ${styles.widgetMetrics}`} aria-hidden="true">
          <div><span><Wallet size={22} aria-hidden="true" />Баланс</span><FinanceMetricSkeleton /><small>От началото</small></div>
          <div><span><Users size={22} aria-hidden="true" />Задължения</span><FinanceMetricSkeleton /><SkeletonLine /></div>
        </div>
      </div>}
      {data && <div className={`${styles.metrics} ${styles.widgetMetrics}`}>
        <div><span><Wallet size={22} aria-hidden="true" />Баланс</span>{data.totals.map(t => <strong key={t.currency} className={Number(t.balance) < 0 ? styles.negative : styles.positive}>{money(t.balance,t.currency)}</strong>)}<small>От началото</small></div>
        <div><span><Users size={22} aria-hidden="true" />Задължения</span><strong className={styles.negative}>{data.incomplete ? '≥ ' : ''}{money(data.outstanding)}</strong><small>{data.debts.length} състезатели{data.incomplete ? ' · неуточнени такси' : ''}</small></div>
      </div>}
    </div>
    <Link className={styles.link} aria-label="Виж финансите" href={`/admin/clubs/${encodeURIComponent(clubId)}/finance`}><ArrowUpRight size={21} aria-hidden="true" /></Link>
  </section>;
  return <section className={styles.overview} aria-label="Финанси на клуба" aria-busy={loading || (!data && !error)}>
    {error && <p role="alert" className={styles.error}>{error} <button type="button" onClick={() => void refresh()}>Опитай отново</button></p>}
    <FinanceDashboard calculatorCanView={calculatorCanView} calculatorEnabled={calculatorEnabled} clubLogoUrl={clubLogoUrl} clubName={clubName} clubId={clubId} data={data} report={period === 'all' ? data : monthlyData?.month === reportPeriod ? monthlyData : null} month={period === 'all' ? 'all' : reportPeriod} onSaved={refresh} filters={<div ref={filtersRef} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setRangeOpen(false); }} className={styles.periodFilters} role="group" aria-label="Период за приходите и разходите">
      <button ref={rangeButtonRef} type="button" disabled={!calculatorCanView} aria-pressed={period === 'range'} aria-expanded={calculatorCanView && rangeOpen} aria-controls={rangeId} onClick={() => { setPeriod('range'); setRangeOpen(open => !open); }}><span className={styles.desktopPeriodLabel}>Период</span><span className={styles.mobilePeriodLabel}><CalendarDays size={16} aria-hidden="true" />{rangeStart === rangeEnd ? new Intl.DateTimeFormat('bg-BG',{month:'long',year:'numeric'}).format(new Date(`${rangeStart}-15T12:00:00`)) : 'Период'}</span><ChevronDown size={15} aria-hidden="true" className={rangeOpen ? styles.chevronOpen : undefined} /></button>
      <button type="button" disabled={!calculatorCanView} aria-pressed={period === 'all'} onClick={() => { setPeriod('all'); setRangeOpen(false); }}>От началото</button>
      <div id={rangeId} hidden={!calculatorCanView || !rangeOpen} className={styles.rangeControls}>
        <label>От месец<input type="month" disabled={!calculatorCanView} aria-label="От месец" min="1900-01" max={financeDateKey().slice(0,7)} value={rangeStart} onChange={event => {
          const value = event.target.value;
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value < '1900-01' || value > financeDateKey().slice(0,7)) return;
          setRangeStart(value);
          if (value > rangeEnd) setRangeEnd(value);
        }} /></label>
        <label>До месец<input type="month" disabled={!calculatorCanView} aria-label="До месец" min={rangeStart} max={financeDateKey().slice(0,7)} value={rangeEnd} onChange={event => {
          const value = event.target.value;
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value < rangeStart || value > financeDateKey().slice(0,7)) return;
          setRangeEnd(value);
        }} /></label>
      </div>
    </div>
    } />
  </section>;
}
