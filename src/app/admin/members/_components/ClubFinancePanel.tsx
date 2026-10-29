'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { getClubFinance } from '@/lib/clubFinance';
import { financeDateKey } from '@/lib/clubFinanceDomain';
import styles from './ClubFinancePanel.module.css';
import FinanceDashboard from './FinanceDashboard';
import { CalendarDays, ChevronDown } from 'lucide-react';
type View = Awaited<ReturnType<typeof getClubFinance>>;
const money = (amount: string, currency = 'EUR') => new Intl.NumberFormat('bg-BG', { style: 'currency', currency }).format(Number(amount));
export default function ClubFinancePanel({ clubId, revision, compact = false, clubName }: { clubName?: string; clubId: string; revision?: unknown; compact?: boolean }) {
  const [data,setData] = useState<View | null>(null);
  const [monthlyData,setMonthlyData] = useState<View | null>(null);
  const [period,setPeriod] = useState<'month' | 'all'>('month');
  const [selectedMonth,setSelectedMonth] = useState(financeDateKey().slice(0,7));
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
      const [result,monthly] = await Promise.all([load('all'), compact ? Promise.resolve(null) : load(selectedMonth)]);
      if (current === requestId.current) { setData(result); setMonthlyData(monthly); setError(''); }
    } catch (err) { if (current === requestId.current) setError(err instanceof Error ? err.message : 'Грешка при зареждане.'); }
    finally { if (current === requestId.current) setLoading(false); }
  }, [base,compact,selectedMonth]);
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
          <div><span>Баланс · от началото</span><span className={styles.skeletonAmount} /></div>
          <div><span>Задължения към клуба · общо</span><span className={styles.skeletonAmount} /><span className={styles.skeletonDetail} /></div>
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
    <FinanceDashboard clubName={clubName} clubId={clubId} data={data} report={period === 'all' ? data : monthlyData} month={period === 'all' ? 'all' : selectedMonth} onSaved={refresh} filters={<div className={styles.periodFilters} role="group" aria-label="Период за приходите и разходите">
      <label className={styles.monthControl} data-active={period === 'month'}>
        <CalendarDays size={16} aria-hidden="true" /><span>{new Intl.DateTimeFormat('bg-BG', { month: 'long', year: 'numeric' }).format(new Date(`${selectedMonth}-15T12:00:00`))}</span><ChevronDown size={14} aria-hidden="true" />
      <input className={styles.monthPicker} data-active={period === 'month'} type="month" aria-label="Месец за приходите и разходите" value={selectedMonth} max={financeDateKey().slice(0,7)} onClick={event => {
        setPeriod('month');
        try { event.currentTarget.showPicker(); } catch { /* The native field remains editable when a picker is unavailable. */ }
      }} onChange={event => {
        const month = event.target.value;
        if (/^\d{4}-\d{2}$/.test(month) && month <= financeDateKey().slice(0,7) && month !== selectedMonth) {
          setPeriod('month');
          setMonthlyData(null);
          setSelectedMonth(month);
        }
      }} /></label>
      <button type="button" aria-pressed={period === 'all'} onClick={() => setPeriod('all')}>От началото</button>
    </div>
    } />
  </section>;
}
