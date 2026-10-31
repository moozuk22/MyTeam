'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import type { getClubFinance } from '@/lib/clubFinance';
import { lockCategoryPageScroll } from './categoryModalScroll';
import styles from './FinanceDashboard.module.css';

type Debt = Awaited<ReturnType<typeof getClubFinance>>['debts'][number];
export default function FinanceDebtsDialog({ debts, renderDebt, onClose }: {
  debts: Debt[]; renderDebt: (debt: Debt) => ReactNode; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const searchId = useId();
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('bg');
  const filtered = debts.filter(debt => debt.name.toLocaleLowerCase('bg').includes(query));
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    searchInput.current?.focus();
    const unlock = lockCategoryPageScroll(document.body, document.documentElement, window);
    return () => {
      element?.close();
      unlock();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({preventScroll:true});
    };
  }, []);
  return <dialog ref={dialog} className={`${styles.categoriesDialog} ${styles.debtsDialog}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <header className={styles.dialogHeader}><h2 id={titleId}>Задължения към клуба</h2><button type="button" aria-label="Затвори списъка" onClick={onClose}><X size={18} /></button></header>
    <label className={styles.debtSearch} htmlFor={searchId}><span>Търси състезател</span><span><Search size={18} aria-hidden="true" /><input ref={searchInput} id={searchId} type="search" placeholder="Име на състезател…" value={search} onChange={event => setSearch(event.target.value)} /></span></label>
    <p className={styles.debtResults} role="status">{filtered.length} от {debts.length} състезатели · По азбучен ред</p>
    <ul className={`${styles.debtList} ${styles.debtsDialogList}`}>{filtered.map(renderDebt)}</ul>
    {!filtered.length && <p className={styles.empty}>Няма намерени състезатели.</p>}
  </dialog>;
}
