'use client';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { getClubFinance } from '@/lib/clubFinance';
import { financeDateKey } from '@/lib/clubFinanceDomain';
import styles from './ClubFinancePanel.module.css';
import FinanceDashboard from './FinanceDashboard';
import { FinanceMetricSkeleton, SkeletonLine } from './FinanceSkeleton';
import { CalendarDays, ChevronDown } from 'lucide-react';
type View = Awaited<ReturnType<typeof getClubFinance>>;
const money = (amount: string, currency = 'EUR') => new Intl.NumberFormat('bg-BG', { style: 'currency', currency }).format(Number(amount));
export default function ClubFinancePanel({ clubId, revision, compact = false, clubName, clubLogoUrl }: { clubLogoUrl?: string | null; clubName?: string; clubId: string; revision?: unknown; compact?: boolean }) {
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
        const response = await fetch(`${base}?month=${month}`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        return result;
      };
      const [result,monthly] = await Promise.all([load('all'), compact ? Promise.resolve(null) : load(reportPeriod)]);
      if (current === requestId.current) { setData(result); setMonthlyData(monthly); setError(''); }
    } catch (err) { if (current === requestId.current) setError(err instanceof Error ? err.message : 'Грешка при зареждане.'); }
    finally { if (current === requestId.current) setLoading(false); }
  }, [base,compact,reportPeriod]);
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
    <div className={styles.heading}><h2>Финанси</h2><Link className={styles.link} href={`/admin/clubs/${encodeURIComponent(clubId)}/finance`}>Виж финансите →</Link></div>
    <div className={styles.content} aria-busy={loading || (!data && !error)}>
      {error && <p className={styles.error} role="alert">{error} <button type="button" onClick={() => void refresh()}>Опитай отново</button></p>}
      {!data && !error && <div role="status" aria-label="Зареждане на финансите">
        <div className={`${styles.metrics} ${styles.widgetMetrics}`} aria-hidden="true">
          <div><span>Баланс · от началото</span><FinanceMetricSkeleton /></div>
          <div><span>Задължения към клуба · общо</span><FinanceMetricSkeleton /><SkeletonLine /></div>
        </div>
      </div>}
      {data && <div className={`${styles.metrics} ${styles.widgetMetrics}`}>
        <div><span>Баланс · от началото</span>{data.totals.map(t => <strong key={t.currency} className={Number(t.balance) < 0 ? styles.negative : styles.positive}>{money(t.balance,t.currency)}</strong>)}</div>
        <div><span>Задължения към клуба · общо</span><strong className={styles.negative}>{data.incomplete ? '≥ ' : ''}{money(data.outstanding)}</strong><small>{data.debts.length} състезатели{data.incomplete ? ' · неуточнени такси' : ''}</small></div>
      </div>}
    </div>
  </section>;
  return <section className={styles.overview} aria-label="Финанси на клуба" aria-busy={loading || (!data && !error)}>
    {error && <p role="alert" className={styles.error}>{error} <button type="button" onClick={() => void refresh()}>Опитай отново</button></p>}
    <FinanceDashboard clubLogoUrl={clubLogoUrl} clubName={clubName} clubId={clubId} data={data} report={period === 'all' ? data : monthlyData?.month === reportPeriod ? monthlyData : null} month={period === 'all' ? 'all' : reportPeriod} onSaved={refresh} filters={<div ref={filtersRef} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setRangeOpen(false); }} className={styles.periodFilters} role="group" aria-label="Период за приходите и разходите">
      <button ref={rangeButtonRef} type="button" aria-pressed={period === 'range'} aria-expanded={rangeOpen} aria-controls={rangeId} onClick={() => { setPeriod('range'); setRangeOpen(open => !open); }}><span className={styles.desktopPeriodLabel}>Период</span><span className={styles.mobilePeriodLabel}><CalendarDays size={16} aria-hidden="true" />{rangeStart === rangeEnd ? new Intl.DateTimeFormat('bg-BG',{month:'long',year:'numeric'}).format(new Date(`${rangeStart}-15T12:00:00`)) : 'Период'}</span><ChevronDown size={15} aria-hidden="true" className={rangeOpen ? styles.chevronOpen : undefined} /></button>
      <button type="button" aria-pressed={period === 'all'} onClick={() => { setPeriod('all'); setRangeOpen(false); }}>От началото</button>
      <div id={rangeId} hidden={!rangeOpen} className={styles.rangeControls}>
        <label>От месец<input type="month" aria-label="От месец" min="1900-01" max={financeDateKey().slice(0,7)} value={rangeStart} onChange={event => {
          const value = event.target.value;
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value < '1900-01' || value > financeDateKey().slice(0,7)) return;
          setRangeStart(value);
          if (value > rangeEnd) setRangeEnd(value);
        }} /></label>
        <label>До месец<input type="month" aria-label="До месец" min={rangeStart} max={financeDateKey().slice(0,7)} value={rangeEnd} onChange={event => {
          const value = event.target.value;
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value < rangeStart || value > financeDateKey().slice(0,7)) return;
          setRangeEnd(value);
        }} /></label>
      </div>
    </div>
    } />
  </section>;
}
