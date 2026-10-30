'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { getClubFinanceAnalysis } from '@/lib/clubFinance';
import styles from './FinanceDashboard.module.css';
import FinanceSkeleton from './FinanceSkeleton';

type Analysis = Awaited<ReturnType<typeof getClubFinanceAnalysis>>;
const money = (amount: string, currency: string) => new Intl.NumberFormat('bg-BG',{style:'currency',currency}).format(Number(amount));

const cents = (amount: string) => {
 const [whole,fraction = ''] = amount.split('.');
 return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2,'0'));
};

export function FinanceAnalysisTable({ data }: { data: Analysis }) {
 const drag = useRef<{pointerId:number; x:number; scrollLeft:number} | null>(null);
 function startDrag(event: PointerEvent<HTMLDivElement>) {
  const table = event.currentTarget;
  if (event.pointerType === 'touch' || event.button !== 0 || table.scrollWidth <= table.clientWidth) return;
  const bounds = table.getBoundingClientRect();
  // Keep the native scrollbar available for dragging its thumb.
  if (event.clientY >= bounds.top+table.clientHeight || event.clientX >= bounds.left+table.clientWidth) return;
  event.preventDefault();
  drag.current = {pointerId:event.pointerId,x:event.clientX,scrollLeft:table.scrollLeft};
  table.setPointerCapture(event.pointerId);
  table.dataset.dragging = 'true';
 }
 function moveDrag(event: PointerEvent<HTMLDivElement>) {
  if (!drag.current || drag.current.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.currentTarget.scrollLeft = drag.current.scrollLeft + drag.current.x-event.clientX;
 }
 function endDrag(event: PointerEvent<HTMLDivElement>) {
  if (!drag.current || drag.current.pointerId !== event.pointerId) return;
  drag.current = null;
  delete event.currentTarget.dataset.dragging;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
 }
 const categoryCurrencies = new Map(data.categories.map(category => {
  const currencies = [...new Set(data.rows.flatMap(row => row.values.filter(value => value.categoryId === category.id).map(value => value.currency)))].sort();
  return [category.id,currencies.length ? currencies : ['EUR']];
 }));
 return <div className={styles.analysisTableWrap} role="region" aria-label="Финансов анализ по категории" tabIndex={0} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
  <table className={styles.analysisTable}>
   <caption>Приходи и разходи по категории · {data.year} · януари – {new Intl.DateTimeFormat('bg-BG',{month:'long'}).format(new Date(`${data.currentMonth}-15T12:00:00`))}</caption>
   <thead><tr><th scope="col">Период</th>{data.categories.map(category => <th key={category.id} scope="col">{category.name}</th>)}</tr></thead>
   {data.rows.map(row => <tbody key={row.key} aria-label={row.label}>
    {(['net','revenue','expense'] as const).map(kind => <tr key={kind} className={kind === 'net' ? row.key === 'year' ? styles.analysisYear : styles.analysisMonth : styles.analysisDetail}>
     <th scope="row">{kind === 'net' ? `${row.label}${row.key === 'year' ? '' : ' (Общо)'}` : kind === 'revenue' ? 'Приход' : 'Разход'}</th>
     {data.categories.map(category => <td key={category.id}>
      {categoryCurrencies.get(category.id)!.map(currency => {
       const values = row.values.filter(value => value.categoryId === category.id && value.currency === currency);
       const revenue = values.filter(value => value.kind === 'revenue').reduce((sum,value) => sum+cents(value.amount),BigInt(0));
       const expense = values.filter(value => value.kind === 'expense').reduce((sum,value) => sum+cents(value.amount),BigInt(0));
       const amount = kind === 'net' ? revenue-expense : kind === 'revenue' ? revenue : expense;
       const tone = kind === 'net' ? amount < BigInt(0) ? styles.analysisNegative : amount > BigInt(0) ? styles.analysisRevenue : styles.analysisZero : kind === 'revenue' ? styles.analysisRevenue : styles.analysisExpense;
       return <span key={currency} className={tone}>{money(String(Number(amount)/100),currency)}</span>;
      })}
     </td>)}
    </tr>)}
   </tbody>)}
  </table>
 </div>;
}

export default function FinanceAnalysis({ clubId, revision }: { clubId:string; revision:unknown }) {
 const [data,setData] = useState<Analysis | null>(null);
 const [error,setError] = useState('');
 const [retry,setRetry] = useState(0);
 useEffect(() => {
  const controller = new AbortController();
  setData(null); setError('');
  async function load() {
   try {
    const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/finance?view=analysis`,{cache:'no-store',signal:controller.signal});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Неуспешно зареждане на анализа.');
    if (!controller.signal.aborted) setData(result);
   } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Неуспешно зареждане на анализа.'); }
  }
  void load();
  return () => controller.abort();
 },[clubId,revision,retry]);
 if (error) return <p role="alert" className={styles.error}>{error} <button type="button" onClick={() => setRetry(value => value+1)}>Опитай отново</button></p>;
 if (!data) return <FinanceSkeleton variant="analysis" />;
 return <FinanceAnalysisTable data={data} />;
}
