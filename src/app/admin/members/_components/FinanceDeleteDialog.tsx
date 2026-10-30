'use client';
import { useEffect, useId, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import type { getClubFinance } from '@/lib/clubFinance';
import styles from './FinanceDeleteDialog.module.css';

type Entry = Awaited<ReturnType<typeof getClubFinance>>['entries'][number];
export default function FinanceDeleteDialog({ entry, saving, error, onClose, onConfirm }: {
 entry:Entry; saving:boolean; error:string; onClose:()=>void; onConfirm:()=>void;
}) {
 const dialog = useRef<HTMLDialogElement>(null);
 const titleId = useId();
 const descriptionId = useId();
 useEffect(() => {
  const trigger = document.activeElement;
  dialog.current?.showModal();
  return () => { if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({preventScroll:true}); };
 },[]);
 const revenue = entry.kind === 'revenue';
 return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} onClick={event => {
  if (saving || event.target !== event.currentTarget) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
 }}>
  <header className={styles.header}><span className={styles.icon}><Trash2 size={22} aria-hidden="true" /></span><h2 id={titleId}>Изтриване на {revenue ? 'приход' : 'разход'}</h2><button type="button" aria-label="Затвори" disabled={saving} onClick={onClose}><X size={20} /></button></header>
  <p id={descriptionId} className={styles.prompt}>Да се изтрие ли този запис?</p>
  <div className={styles.entry}>
   <div className={styles.amount} data-kind={entry.kind}><span>{revenue ? 'Приход' : 'Разход'}</span><strong>{new Intl.NumberFormat('bg-BG',{style:'currency',currency:entry.currency}).format(Number(entry.amount))}</strong></div>
   <dl><div><dt>Категория</dt><dd>{entry.category}</dd></div><div><dt>Дата</dt><dd>{entry.date.split('-').reverse().join('.')}</dd></div>{entry.playerName && <div><dt>Състезател</dt><dd>{entry.playerName}</dd></div>}</dl>
   <div className={styles.description}><h3>Описание</h3><p>{entry.description || 'Няма добавено описание.'}</p></div>
  </div>
  {error && <p role="alert" className={styles.error}>{error}</p>}
  <footer className={styles.actions}><button type="button" autoFocus disabled={saving} onClick={onClose}>Отказ</button><button type="button" className={styles.delete} disabled={saving} onClick={onConfirm}><Trash2 size={16} aria-hidden="true" />{saving ? 'Изтриване…' : revenue ? 'Изтрий прихода' : 'Изтрий разхода'}</button></footer>
 </dialog>;
}
