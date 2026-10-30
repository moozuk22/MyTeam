'use client';
import { lazy, Suspense, useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { Eye, EyeOff, GripVertical, ArrowUp, ArrowDown, ArrowUpRight, CreditCard, Wallet, Users, Plus, List, Save, Pencil, Trash2, X, MoreVertical, UserRound, ReceiptText, ChevronDown, CalendarDays, ChartPie, House, Bus, Trophy, Shirt, FileText } from 'lucide-react';
import type { getClubFinance } from '@/lib/clubFinance';
import { financeCategoryChartColor } from '@/lib/financeCategoryChartColor';
import { financeDateKey, financePeriodLabel } from '@/lib/clubFinanceDomain';
import styles from './FinanceDashboard.module.css';
import { CUSTOM_TRAINING_GROUP_COLOR_PALETTE, customTrainingGroupAccentRgba, customTrainingGroupReadableOnAccent } from '@/lib/customTrainingGroupColors';
import { lockCategoryPageScroll } from './categoryModalScroll';
import { categoryDragScrollSpeed } from './categoryDragScroll';
import FinanceActionDropdown from './FinanceActionDropdown';
import FinanceDeleteDialog from './FinanceDeleteDialog';
import FinanceSkeleton, { FinanceMetricSkeleton, SkeletonLine } from './FinanceSkeleton';
import FinancePlayerSkeleton from './FinancePlayerSkeleton';
const FinanceAnalysis = lazy(() => import('./FinanceAnalysis'));
const FinancePlayerDetails = lazy(() => import('./FinancePlayerDetails'));
type View = Awaited<ReturnType<typeof getClubFinance>>;
type Draft = { id?: string; categoryId: string; amount: string; date: string; description: string };
const money = (value: string, currency = 'EUR') => new Intl.NumberFormat('bg-BG', { style: 'currency', currency }).format(Number(value));
export default function FinanceDashboard({ clubId, data, report, month, filters, onSaved, clubName, clubLogoUrl }: { clubLogoUrl?: string | null; clubName?: string; clubId: string; data: View | null; report: View | null; month: string; filters: ReactNode; onSaved: () => Promise<void> }) {
  const [failedClubLogo,setFailedClubLogo] = useState<string | null>(null);
  const [selectedPlayerId,setSelectedPlayerId] = useState<string | null>(null);
  const [ledgerView,setLedgerView] = useState<'history' | 'analysis' | 'chart'>('history');
  const ledgerId = useId();
  const [actionDropdown,setActionDropdown] = useState<'revenue' | 'expense' | 'debts' | null>(null);
  const analysisActionsRef = useRef<HTMLDivElement>(null);
  const actionTriggerRef = useRef<HTMLButtonElement>(null);
  const actionPanelRef = useRef<HTMLDivElement>(null);
  const [entryKind,setEntryKind] = useState<'all' | 'expense' | 'revenue'>('all');
  const [formKind,setFormKind] = useState<'expense' | 'revenue'>('expense');
  const [list,setList] = useState<View | null>(null);
  const [category,setCategory] = useState('');
  const [pagination,setPagination] = useState({ month, page: 1 });
  const page = pagination.month === month ? pagination.page : 1;
  function setPage(next: number | ((page: number) => number)) {
    setPagination({ month, page: typeof next === 'function' ? next(page) : next });
  }
  const [revision,setRevision] = useState(0);
  const [saving,setSaving] = useState(false);
  useEffect(() => {
    if (!actionDropdown || selectedPlayerId) return;
    const dismiss = (event: globalThis.PointerEvent) => {
      if (!saving && event.target instanceof Node && !analysisActionsRef.current?.contains(event.target) && !actionPanelRef.current?.contains(event.target)) setActionDropdown(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || saving) return;
      analysisActionsRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus();
      setActionDropdown(null);
    };
    document.addEventListener('pointerdown',dismiss);
    document.addEventListener('keydown',escape);
    return () => { document.removeEventListener('pointerdown',dismiss); document.removeEventListener('keydown',escape); };
  },[actionDropdown,selectedPlayerId,saving]);
  const [error,setError] = useState('');
  const [listError,setListError] = useState('');
  const [draft,setDraft] = useState<Draft | null>({ categoryId: '', amount: '', date: financeDateKey(), description: '' });
  const [remove,setRemove] = useState<View['entries'][number] | null>(null);
  const [categoryEdit,setCategoryEdit] = useState<{ id?: string; name: string; color?: string | null } | null>(null);
  const [categoryStatus,setCategoryStatus] = useState<{id:string;name:string;isActive:boolean} | null>(null);
  const categoryConfirmRef = useRef<HTMLDialogElement>(null);
  const [ordering,setOrdering] = useState(false);
  const [categoryVisibility,setCategoryVisibility] = useState<'all' | 'active' | 'hidden'>('all');
  const [allDebts,setAllDebts] = useState(false);
  const [allExpenses,setAllExpenses] = useState(false);
  const [formOpen,setFormOpen] = useState(false);
  const categoriesDialogRef = useRef<HTMLDialogElement>(null);
  function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (saving || event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
  }
  useEffect(() => {
    const dialog = categoriesDialogRef.current;
    if (!dialog) return;
    let unlock: (() => void) | undefined;
    const syncScrollLock = () => {
      if (dialog.open && !unlock) unlock = lockCategoryPageScroll(document.body, document.documentElement, window);
      if (!dialog.open && unlock) { unlock(); unlock = undefined; }
    };
    const observer = new MutationObserver(syncScrollLock);
    observer.observe(dialog, {attributes:true,attributeFilter:['open']});
    syncScrollLock();
    return () => { observer.disconnect(); unlock?.(); };
  }, []);
  const pointerDrag = useRef<{id:string;startX:number;startY:number;left:number;top:number;width:number;row:HTMLLIElement;preview:HTMLLIElement | null;target:string | null} | null>(null);
  const dragFrame = useRef<number | null>(null);
  const dragPosition = useRef({x:0,y:0});
  const dragScrollTime = useRef<number | null>(null);
  function clearDragPreview() {
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
    dragFrame.current = null;
    dragScrollTime.current = null;
    pointerDrag.current?.preview?.remove();
    pointerDrag.current?.row.removeAttribute('data-dragging');
    categoriesDialogRef.current?.querySelectorAll('[data-drop-target]').forEach(row => row.removeAttribute('data-drop-target'));
    categoriesDialogRef.current?.removeAttribute('data-dragging');
    pointerDrag.current = null;
  }
  useEffect(() => () => clearDragPreview(), []);
  function startCategoryDrag(event: PointerEvent<HTMLLIElement>, id: string) {
    if (saving || event.button !== 0 || event.pointerType === 'touch' || window.matchMedia('(max-width:700px), (pointer:coarse)').matches || (event.target as Element).closest('button')) return;
    const row = event.currentTarget;
    const bounds = row.getBoundingClientRect();
    dragPosition.current = {x:event.clientX,y:event.clientY};
    dragScrollTime.current = null;
    pointerDrag.current = {id,startX:event.clientX,startY:event.clientY,left:bounds.left,top:bounds.top,width:bounds.width,row,preview:null,target:null};
    row.setPointerCapture(event.pointerId);
  }
  function moveCategoryDrag(event: PointerEvent<HTMLLIElement>) {
    dragPosition.current = {x:event.clientX,y:event.clientY};
    if (!pointerDrag.current || dragFrame.current !== null) return;
    dragFrame.current = requestAnimationFrame(() => { dragFrame.current = null; renderCategoryDrag(); });
  }
  function renderCategoryDrag() {
    const {x,y} = dragPosition.current;
    const drag = pointerDrag.current;
    if (!drag) return;
    const dx = x - drag.startX, dy = y - drag.startY;
    if (!drag.preview && Math.hypot(dx,dy) < 5) return;
    if (!drag.preview) {
      const preview = drag.row.cloneNode(true) as HTMLLIElement;
      preview.setAttribute('aria-hidden','true');
      preview.classList.add(styles.categoryDragPreview);
      preview.style.width = `${drag.width}px`;
      preview.style.left = `${drag.left}px`;
      preview.style.top = `${drag.top}px`;
      drag.row.parentElement?.appendChild(preview);
      drag.preview = preview;
      drag.row.setAttribute('data-dragging','true');
      categoriesDialogRef.current?.setAttribute('data-dragging','true');
    }
    const list = drag.row.parentElement;
    const modal = categoriesDialogRef.current;
    const now = performance.now();
    const elapsed = Math.min(32,now - (dragScrollTime.current ?? now - 16));
    dragScrollTime.current = now;
    let scrolling = false;
    if (list && modal) {
      const bounds = list.getBoundingClientRect();
      const modalBounds = modal.getBoundingClientRect();
      if (x >= modalBounds.left && x <= modalBounds.right && y >= modalBounds.top && y <= modalBounds.bottom) {
        const speed = categoryDragScrollSpeed(y,Math.max(bounds.top,modalBounds.top + 16),Math.min(bounds.bottom,modalBounds.bottom - 16));
        const before = list.scrollTop;
        list.scrollTop += speed * elapsed / 1000;
        scrolling = list.scrollTop !== before;
        if (speed && !scrolling) {
          const modalBefore = modal.scrollTop;
          modal.scrollTop += speed * elapsed / 1000;
          scrolling = modal.scrollTop !== modalBefore;
        }
      }
    }
    drag.preview.style.transform = `translate3d(${dx}px,${dy}px,0)`;
    const target = document.elementFromPoint(x,y)?.closest<HTMLLIElement>('li[data-category-id]');
    const targetId = target && categoriesDialogRef.current?.contains(target) && target.dataset.categoryId !== drag.id ? target.dataset.categoryId ?? null : null;
    if (drag.target !== targetId) { categoriesDialogRef.current?.querySelector('[data-drop-target]')?.removeAttribute('data-drop-target'); drag.target = targetId; if (targetId) target?.setAttribute('data-drop-target','true'); }
    if (scrolling && dragFrame.current === null) dragFrame.current = requestAnimationFrame(() => { dragFrame.current = null; renderCategoryDrag(); });
  }
  function finishCategoryDrag(cancelled = false) {
    if (!cancelled && pointerDrag.current) renderCategoryDrag();
    const drag = pointerDrag.current;
    if (!cancelled && drag?.preview && drag.target) void moveCategory(drag.id,0,drag.target);
    clearDragPreview();
  }
  const debtsRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const expenseDetailsRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const dashboard = dashboardRef.current;
    const form = formRef.current;
    const ledger = expenseDetailsRef.current;
    const debts = debtsRef.current;
    if (!dashboard || !form || !ledger || !debts) return;
    const updateNotch = () => {
      const top = debts.getBoundingClientRect().top - ledger.getBoundingClientRect().top - 7;
      dashboard.style.setProperty('--debt-notch-top', `${Math.max(0,top)}px`);
    };
    const observer = new ResizeObserver(updateNotch);
    observer.observe(form);
    observer.observe(dashboard);
    observer.observe(ledger);
    observer.observe(debts);
    if (cardsRef.current) observer.observe(cardsRef.current);
    window.addEventListener('resize', updateNotch);
    updateNotch();
    return () => { observer.disconnect(); window.removeEventListener('resize', updateNotch); };
  });
  const base = `/api/admin/clubs/${encodeURIComponent(clubId)}/finance`;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`${base}?${new URLSearchParams({ month, ...(entryKind === 'all' ? {} : { kind: entryKind }), category, page: String(page) })}`, { signal: controller.signal, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!controller.signal.aborted) { setList(result); setListError(''); }
      } catch (err) { if (!controller.signal.aborted) setListError(err instanceof Error ? err.message : 'Грешка при зареждане.'); }
    }
    void load();
    return () => controller.abort();
  }, [base,month,category,page,revision,entryKind]);
  const categories = data?.categories ?? [];
  const formCategories = data?.categories.filter(c => (!c.isMembership && c.isActive) || (draft?.id && draft.categoryId === c.id)) ?? [];
  const listCategories = categories;
  function selectKind(kind: 'all' | 'expense' | 'revenue') { setRemove(null); setEntryKind(kind); setPage(1); setList(null); }
  function newEntry(kind: 'expense' | 'revenue') {
    setFormKind(kind);
    setFormOpen(true);
    setDraft({ categoryId: data?.categories.find(c => c.isActive && !c.isMembership)?.id ?? '', amount: '', date: financeDateKey(), description: '' });
    setRemove(null);
    requestAnimationFrame(() => { if (ledgerView !== 'analysis') formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); formRef.current?.querySelector('select')?.focus({ preventScroll: true }); });
  }
  async function moveCategory(id: string, direction: number, targetId?: string) {
    const index = categories.findIndex(c => c.id === id);
    const target = targetId ? categories.findIndex(c => c.id === targetId) : index + direction;
    if (saving || index < 0 || target === index || !categories[target]) return;
    const ids = categories.map(c => c.id);
    ids.splice(target,0,ids.splice(index,1)[0]);
    setSaving(true); setOrdering(true); setError('');
    try {
      const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reorderCategories', ids }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Грешка при запазване.'); }
    finally { setSaving(false); setOrdering(false); }
  }
  async function saveCategoryStatus() {
    if (!categoryStatus) return;
    setSaving(true); setError('');
    try {
      const response = await fetch(base, { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'setCategoryActive',id:categoryStatus.id,isActive:!categoryStatus.isActive}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await onSaved();
      if (categoryStatus.isActive) setDraft(current => current?.categoryId === categoryStatus.id && !current.id ? {...current,categoryId:''} : current);
      categoryConfirmRef.current?.close(); setCategoryStatus(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Грешка при запазване.'); }
    finally { setSaving(false); }
  }
  async function mutate(body: Record<string,unknown>) {
    setSaving(true); setError('');
    try {
      const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setDraft({ categoryId: '', amount: '', date: financeDateKey(), description: '' }); setFormOpen(false); setRemove(null); setCategoryEdit(null); setList(null); setPage(1); setRevision(v => v+1); setActionDropdown(null);
      await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Грешка при запис.'); }
    finally { setSaving(false); }
  }
  const categoryEditorRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (categoryEdit) categoryEditorRef.current?.showModal();
    else categoryEditorRef.current?.close();
  }, [categoryEdit]);
  const [showCategoryColors,setShowCategoryColors] = useState(true);
  useEffect(() => {
    try {
      // Restore this browser's display preference after hydration.
      setShowCategoryColors(localStorage.getItem('finance-category-colors') !== 'hidden');
    } catch { /* Storage may be unavailable; keep colors visible. */ }
  }, []);
  function toggleCategoryColors() {
    const visible = !showCategoryColors;
    setShowCategoryColors(visible);
    try { localStorage.setItem('finance-category-colors',visible ? 'visible' : 'hidden'); } catch { /* The toggle still works for this visit. */ }
  }
  const [mobileDebtsOpen,setMobileDebtsOpen] = useState(false);
  const [chartSelection,setChartSelection] = useState<{ currency:string; categoryId:string } | null>(null);
  function selectChartCategory(currency:string, categoryId:string) {
    setChartSelection(current => current?.currency === currency && current.categoryId === categoryId ? null : {currency,categoryId});
  }
  const categoryCharts = (report?.totals ?? []).map(total => {
    const rows = categories.map(category => ({
      id: category.id, name: category.name, color: financeCategoryChartColor(category),
      amount: Number(report?.subtotals.find(row => row.categoryId === category.id && row.currency === total.currency && row.kind === 'expense')?.amount ?? 0),
    })).filter(row => row.amount > 0).sort((a,b) => b.amount - a.amount);
    const sum = rows.reduce((value,row) => value + row.amount,0);
    let end = 0;
    const segments = rows.map(row => {
      const start = end;
      const size = sum ? row.amount / sum * 100 : 0;
      end += size;
      return { ...row, start, size };
    });
    const selectedId = chartSelection?.currency === total.currency && rows.some(row => row.id === chartSelection.categoryId) ? chartSelection.categoryId : null;
    return { currency: total.currency, rows: segments, sum, selectedId };
  });
  const periodList = list?.month === month && list.page === page ? list : null;
  const entryForm = (<form ref={formRef} className={`${styles.box} ${styles.expenseForm} ${draft?.id ? styles.editingForm : ''} ${formKind === 'revenue' ? styles.revenueForm : ''} ${formOpen ? '' : styles.mobileFormClosed}`} onSubmit={event => { event.preventDefault(); if (draft) void mutate({ ...draft, action: `${draft.id ? 'update' : 'create'}${formKind === 'revenue' ? 'Revenue' : 'Expense'}` }); }}>
          <h2>{draft?.id ? (formKind === 'revenue' ? 'Редактирай приход' : 'Редактирай разход') : (formKind === 'revenue' ? 'Добави приход' : 'Добави разход')}</h2>
          {draft?.id && error && <p className={styles.error} role="alert">{error}</p>}
          {!data ? <FinanceSkeleton variant="form" /> : !draft ? <><p className={styles.empty}>Въведете разход за вашия клуб.</p><button type="button" className={styles.primary} disabled={!data} onClick={() => newEntry('expense')}><Plus size={18} />Нов разход</button></> : <>
            <label>Категория <span>*</span><span className={styles.selectWrap}><select required value={draft.categoryId} onChange={e => setDraft({ ...draft,categoryId:e.target.value })}><option value="" disabled>Изберете категория</option>{formCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></span></label>
            <label>Сума <span>*</span><span className={styles.amountField}><input required inputMode="decimal" placeholder="0,00" value={draft.amount} onChange={e => setDraft({ ...draft,amount:e.target.value })} /><span aria-hidden="true">€</span></span></label>
            <label>Дата <span>*</span><span className={styles.dateField}><span aria-hidden="true">{draft.date ? draft.date.split('-').reverse().join('.') : 'дд.мм.гггг'}</span><input required type="date" value={draft.date} onClick={event => { try { event.currentTarget.showPicker(); } catch { /* Keep the native field editable where showPicker is unavailable. */ } }} onChange={e => setDraft({ ...draft,date:e.target.value })} /><CalendarDays size={16} aria-hidden="true" /></span></label>
            <label>Описание (незадължително)<textarea placeholder={formKind === 'revenue' ? 'Добави описание на прихода…' : 'Добави описание на разхода…'} maxLength={2000} value={draft.description} onChange={e => setDraft({ ...draft,description:e.target.value })} /><small className={styles.counter}>{draft.description.length}/2000</small></label>
            <div className={styles.formActions}>{draft?.id && <button type="button" disabled={saving} onClick={() => { setError(''); setDraft({categoryId:'',amount:'',date:financeDateKey(),description:''}); setFormOpen(false); }}>Отказ</button>}<button type="submit" className={styles.primary} disabled={saving}><Save size={16} />{saving ? 'Записване…' : formKind === 'revenue' ? 'Запази прихода' : 'Запази разхода'}</button></div>
          </>}
        </form>);
  const debtsPanel = (<section ref={debtsRef} data-mobile-open={mobileDebtsOpen} tabIndex={-1} data-empty={Boolean(data && !data.incomplete && data.debts.length === 0 && Number(data.outstanding) === 0)} className={`${styles.box} ${styles.debts}`}><h2 className={styles.panelHeading}><Users size={22} />Задължения към клуба</h2>
          <div className={styles.debtTotal}><strong>{data?.incomplete ? '≥ ' : ''}{data ? money(data.outstanding) : '—'}</strong><small>{data?.debts.length ?? '—'} състезатели</small></div>
          {data?.incomplete && <p className={styles.error}>Има неуточнени такси. Общата сума е непълна.</p>}
          {!data && <FinanceSkeleton variant="debts" />}<ul className={styles.debtList}>{(allDebts ? data?.debts : data?.debts.slice(0,5))?.map(debt => <li key={debt.id}><button type="button" className={styles.debtPlayer} onClick={() => setSelectedPlayerId(debt.id)} aria-label={`Детайли за ${debt.name}`}><span className={styles.avatar}><UserRound size={16} />{debt.avatarUrl && <img key={debt.avatarUrl} src={debt.avatarUrl} alt="" width={28} height={28} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} />}</span><span>{debt.name}<small>{debt.periods.map(period => /^\d{4}-\d{2}$/.test(period) ? new Intl.DateTimeFormat('bg-BG',{ month:'long',year:'numeric' }).format(new Date(`${period}-15T12:00:00`)) : period).join(' · ')}</small></span><strong>{debt.amount === null ? 'Неуточнена такса' : money(debt.amount)}</strong></button></li>)}</ul>
          {data && !data.debts.length && <p className={styles.empty}>Няма неплатени задължения.</p>}
          {data && data.debts.length > 5 && <button className={styles.wide} type="button" onClick={() => setAllDebts(v => !v)}>{allDebts ? 'Покажи по-малко' : `Виж всички ${data.debts.length} състезатели →`}</button>}
        </section>);
  return <div ref={dashboardRef} className={styles.dashboard} data-view={ledgerView} data-editing={Boolean(draft?.id)}>
    {draft?.id && <div className={styles.editBackdrop} aria-hidden="true" />}
    <header className={styles.topbar}><div className={styles.title}><span className={styles.clubLogo}><House size={25} aria-hidden="true" />{clubLogoUrl && failedClubLogo !== clubLogoUrl && <img src={clubLogoUrl} alt="" width={56} height={56} onError={() => setFailedClubLogo(clubLogoUrl)} />}</span><div className={styles.titleText}><h1>Финанси на клуба</h1>{clubName && <p>{clubName}</p>}</div></div><div className={styles.headerActions}>{filters}</div></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.layout}>
      <div className={styles.main}>
    <div ref={cardsRef} className={styles.cards}>
          {([
            { label: 'Приходи', key: 'revenue', tone: styles.green, Icon: ArrowUpRight },
            { label: 'Разходи', key: 'expense', tone: styles.gold, Icon: CreditCard },
            { label: 'Баланс', key: 'balance', tone: styles.white, Icon: Wallet },
            { label: 'Задължения към клуба', key: 'outstanding', tone: styles.red, Icon: Users },
          ] as const).map(({ label,key,tone,Icon }) => <section key={key} data-metric={key} className={`${styles.card} ${tone} ${key === 'outstanding' ? styles.mobileDebtCard : ''}`}>
            <span className={styles.icon}><Icon size={22} aria-hidden="true" /></span><h2>{label}</h2>
            {key === 'outstanding' && <button type="button" className={styles.mobileDebtTrigger} aria-label="Покажи задълженията към клуба" aria-expanded={mobileDebtsOpen} onClick={() => { setLedgerView('history'); setMobileDebtsOpen(value => !value); }}><ChevronDown size={18} aria-hidden="true" /></button>}
            {key === 'outstanding' ? (data ? <strong>{data.incomplete ? '≥ ' : ''}{money(data.outstanding)}</strong> : <FinanceMetricSkeleton />) : (key === 'balance' ? data : report)?.totals.map(t => <strong key={t.currency}>{money(t[key],t.currency)}</strong>) ?? <FinanceMetricSkeleton />}
            {key !== 'balance' && <small>{key === 'outstanding' ? `${data?.debts.length ?? '—'} състезатели${data?.incomplete ? ' · неуточнени такси' : ''}` : financePeriodLabel(month)}</small>}
          </section>)}
          {ledgerView === 'analysis' && <div ref={analysisActionsRef} className={styles.analysisActions}>
            <div className={styles.analysisAction}>
              <button type="button" disabled={!data || saving} aria-expanded={actionDropdown === 'revenue'} aria-controls={`${ledgerId}-revenue-dropdown`} onClick={event => {
                actionTriggerRef.current = event.currentTarget;
                if (actionDropdown === 'revenue') { setActionDropdown(null); return; }
                setActionDropdown('revenue'); newEntry('revenue');
              }}><Plus size={16} aria-hidden="true" />Добави приход<ChevronDown size={15} aria-hidden="true" /></button>
              {actionDropdown === 'revenue' && <FinanceActionDropdown id={`${ledgerId}-revenue-dropdown`} label="Добави приход" anchor={actionTriggerRef} panelRef={actionPanelRef}>{error && <p className={styles.error} role="alert">{error}</p>}{entryForm}</FinanceActionDropdown>}
            </div>
            <div className={styles.analysisAction}>
              <button type="button" disabled={!data || saving} aria-expanded={actionDropdown === 'expense'} aria-controls={`${ledgerId}-expense-dropdown`} onClick={event => {
                actionTriggerRef.current = event.currentTarget;
                if (actionDropdown === 'expense') { setActionDropdown(null); return; }
                setActionDropdown('expense'); newEntry('expense');
              }}><Plus size={16} aria-hidden="true" />Добави разход<ChevronDown size={15} aria-hidden="true" /></button>
              {actionDropdown === 'expense' && <FinanceActionDropdown id={`${ledgerId}-expense-dropdown`} label="Добави разход" anchor={actionTriggerRef} panelRef={actionPanelRef}>{error && <p className={styles.error} role="alert">{error}</p>}{entryForm}</FinanceActionDropdown>}
            </div>
            <div className={styles.analysisAction}>
              <button type="button" className={styles.debtActionButton} disabled={!data || saving} aria-expanded={actionDropdown === 'debts'} aria-controls={`${ledgerId}-debts-dropdown`} onClick={event => {
                actionTriggerRef.current = event.currentTarget;
                setActionDropdown(current => current === 'debts' ? null : 'debts');
                requestAnimationFrame(() => debtsRef.current?.focus({preventScroll:true}));
              }}><Users size={16} aria-hidden="true" /><span className={styles.debtActionLabel}><span>Задължения</span><small>{data?.incomplete ? '≥ ' : ''}{data ? money(data.outstanding) : '—'} · {data?.debts.length ?? '—'} {data?.debts.length === 1 ? 'състезател' : 'състезатели'}</small></span><ChevronDown size={15} aria-hidden="true" /></button>
              {actionDropdown === 'debts' && <FinanceActionDropdown id={`${ledgerId}-debts-dropdown`} label="Задължения" anchor={actionTriggerRef} panelRef={actionPanelRef}>{debtsPanel}</FinanceActionDropdown>}
            </div>
          </div>}
        </div>

        <div className={styles.mobileEntryActions}><button type="button" disabled={!data || saving} onClick={() => { setLedgerView('history'); newEntry('revenue'); }}><Plus size={18} />Приход</button><button type="button" disabled={!data || saving} onClick={() => { setLedgerView('history'); newEntry('expense'); }}><Plus size={18} />Разход</button></div>

        <section ref={expenseDetailsRef} className={`${styles.box} ${styles.ledger}`}>
          <div className={styles.ledgerViews} role="group" aria-label="Изглед на финансите">
            <button type="button" aria-pressed={ledgerView === 'history'} aria-controls={`${ledgerId}-history`} disabled={ledgerView === 'history'} onClick={() => { setActionDropdown(null); setLedgerView('history'); }}><List size={17} aria-hidden="true" />История</button>
            <button type="button" aria-pressed={ledgerView === 'analysis'} aria-controls={`${ledgerId}-analysis`} disabled={ledgerView === 'analysis'} onClick={() => setLedgerView('analysis')}><ChartPie size={17} aria-hidden="true" />Анализ</button>
            <button type="button" aria-pressed={ledgerView === 'chart'} aria-controls={`${ledgerId}-chart`} disabled={ledgerView === 'chart'} onClick={() => { setActionDropdown(null); setLedgerView('chart'); }}><ChartPie size={17} aria-hidden="true" /><span className={styles.desktopCategoryLabel}>Категории разходи</span><span className={styles.mobileCategoryLabel}>Категории</span></button>
          </div>
          <div id={`${ledgerId}-chart`} className={styles.chartView} hidden={ledgerView !== 'chart'} role="region" aria-label="Категории разходи">
          {!report && <FinanceSkeleton variant="chart" />}{categoryCharts.map(chart => <div className={styles.chart} key={chart.currency}>
            <div className={`${styles.donut} ${styles.interactiveDonut}`}>
              <svg viewBox="0 0 100 100" aria-label={`Разходи по категории: ${money(String(chart.sum),chart.currency)}`}>
                <circle cx="50" cy="50" r="43" fill="none" stroke="#30312c" strokeWidth="14" />
                {chart.rows.map(row => <circle key={row.id} className={styles.chartSegment} cx="50" cy="50" r="43" fill="none" stroke={row.color} strokeWidth="14" pathLength="100" strokeDasharray={`${row.size} ${100-row.size}`} strokeDashoffset={-row.start} transform="rotate(-90 50 50)" role="button" tabIndex={0} aria-label={`${row.name}: ${money(String(row.amount),chart.currency)}`} aria-pressed={chart.selectedId === row.id} data-dimmed={Boolean(chart.selectedId && chart.selectedId !== row.id)} onClick={() => selectChartCategory(chart.currency,row.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectChartCategory(chart.currency,row.id); } }}><title>{row.name}</title></circle>)}
              </svg>
              <span><strong>{money(String(chart.sum),chart.currency)}</strong><small>общо</small></span>
            </div>
            <ul className={styles.legend}>{chart.rows.map(row => <li key={row.id} className={styles.chartLegendItem} data-selected={chart.selectedId === row.id} data-dimmed={Boolean(chart.selectedId && chart.selectedId !== row.id)}><button type="button" className={styles.chartLegendButton} aria-pressed={chart.selectedId === row.id} onClick={() => selectChartCategory(chart.currency,row.id)}><i style={{ background: row.color }} aria-hidden="true" /><span>{row.name}</span><strong>{money(String(row.amount),chart.currency)}</strong><small>{Math.round(row.amount/chart.sum*100)}%</small></button></li>)}</ul>
            {chart.rows.length > 0 && <div className={styles.chartInsights} aria-label="Обобщение на разходите">
              <article><small>Най-голям разход</small><strong>{chart.rows[0].name}</strong><span>{money(String(chart.rows[0].amount),chart.currency)} · {Math.round(chart.rows[0].size)}% от разходите</span></article>
              <article><small>Топ {Math.min(3,chart.rows.length)} категории</small><strong>{Math.round(chart.rows.slice(0,3).reduce((sum,row) => sum + row.size,0))}%</strong><span>{money(String(chart.rows.slice(0,3).reduce((sum,row) => sum + row.amount,0)),chart.currency)} от общите разходи</span></article>
              <article><small>Категории с разходи</small><strong>{chart.rows.length}</strong><span>За избрания период</span></article>
            </div>}
            {!chart.rows.length && <p className={styles.empty}>Няма разходи за периода.</p>}
          </div>)}
          </div>
          <div id={`${ledgerId}-history`} className={styles.ledgerView} hidden={ledgerView !== 'history'} role="region" aria-label="История">
          <header className={styles.panelHeading}><div className={styles.ledgerHeading}><List size={20} />{entryKind === 'all' ? 'Всички записи' : entryKind === 'revenue' ? 'Приходи' : 'Разходи'} <span>Всички записи за избрания период</span></div></header>
          <div className={styles.ledgerToolbar}><div className={styles.entryTabs} role="group" aria-label="Вид записи"><button type="button" aria-pressed={entryKind === 'all'} onClick={() => selectKind('all')}>Всички</button><button type="button" aria-pressed={entryKind === 'expense'} onClick={() => selectKind('expense')}>Разходи</button><button type="button" aria-pressed={entryKind === 'revenue'} onClick={() => selectKind('revenue')}>Приходи</button></div><div className={styles.management}><button type="button" onClick={toggleCategoryColors}>{showCategoryColors ? 'Изключи цветовете' : 'Включи цветовете'}</button><button type="button" disabled={!data} onClick={() => { setCategoryEdit(null); setError(''); categoriesDialogRef.current?.showModal(); }}><CreditCard size={18} />Управление на категории</button></div></div>
          <div className={styles.filterChips} role="group" aria-label="Филтрирай записите по категория">
            {!data ? <FinanceSkeleton variant="categoryChips" /> : [{ id: '', name: 'Всички' }, ...listCategories].map(item => <button key={item.id} type="button" aria-pressed={category === item.id} disabled={category === item.id} onClick={() => { setCategory(item.id); setPage(1); setList(null); }}>{showCategoryColors && 'color' in item && typeof item.color === 'string' && item.color && <i className={styles.categorySwatch} style={{background:String(item.color)}} aria-hidden="true" />}{item.name}</button>)}
          </div>
          <div className={styles.categoryFilter}>
            <label htmlFor="finance-expense-category">Категория</label>
            <div className={styles.selectWrap}><select id="finance-expense-category" value={category} onChange={event => { setCategory(event.target.value); setPage(1); setList(null); }}><option value="">Всички категории</option>{listCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></div>
          </div>
          <div className={styles.ledgerContent}>
          {listError && <p role="alert" className={styles.error}>{listError} <button type="button" onClick={() => setRevision(v => v+1)}>Опитай отново</button></p>}
          {!periodList ? !listError && <FinanceSkeleton /> : <>
            {periodList.count ? <div className={styles.tableWrap}><table><thead><tr><th>Дата</th><th>Описание</th><th>Категория</th><th>Сума</th><th><span className={styles.srOnly}>Действия</span></th></tr></thead><tbody>
              {(allExpenses ? periodList.entries : periodList.entries.slice(0,5)).map(entry => <tr key={entry.id} style={(() => { const color = showCategoryColors ? data?.categories.find(c => c.id === entry.categoryId)?.color : null; return color ? {background:customTrainingGroupAccentRgba(color,0.2),boxShadow:`inset 3px 0 ${color}`} : undefined; })()}>
                <td data-label="Дата"><span className={styles.entryIcon}>{(() => { const name = entry.category.toLowerCase(); const Icon = /транспорт|гориво/.test(name) ? Bus : /състез|турнир|такс/.test(name) ? Trophy : /екип|топк/.test(name) ? Shirt : /наем|трениров/.test(name) ? House : FileText; return <Icon size={17} aria-hidden="true" />; })()}</span>{entry.date.split('-').reverse().join('.')}</td>
                <td data-label="Описание" className={styles.description}>{entry.description || entry.playerName || (entry.kind === 'revenue' ? 'Приход без описание' : 'Разход без описание')}</td>
                <td data-label="Категория"><span className={`${styles.tag} ${(!showCategoryColors ? styles.tagNeutral : /транспорт|гориво/i.test(entry.category) ? styles.tagBlue : /екип|топк/i.test(entry.category) ? styles.tagPurple : /наем|трениров/i.test(entry.category) ? styles.tagGreen : /състез|турнир/i.test(entry.category) ? styles.tagRed : styles.tagNeutral)}`} style={(() => { const color = showCategoryColors ? data?.categories.find(c => c.id === entry.categoryId)?.color : null; return color ? {background:color,color:customTrainingGroupReadableOnAccent(color)} : undefined; })()}>{entry.category}</span></td>
                <td data-label="Сума" className={`${styles.amount} ${entry.kind === 'revenue' ? styles.incomeAmount : ''}`}>{money(entry.amount,entry.currency)}</td>
                <td className={styles.actionCell}>{entry.editable && <details className={styles.rowMenu} onKeyDown={event => { if (event.key === 'Escape') event.currentTarget.open = false; }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
                  <summary aria-label={`Действия за ${entry.description || entry.category}`}><MoreVertical size={19} /></summary>
                  <div><button type="button" disabled={saving} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); setError(''); setFormOpen(true); setFormKind(entry.kind === 'revenue' ? 'revenue' : 'expense'); setDraft({ id: entry.id, categoryId: entry.categoryId, amount: entry.amount, date: entry.date, description: entry.description ?? '' }); requestAnimationFrame(() => { if (ledgerView !== 'analysis') formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); formRef.current?.querySelector('select')?.focus({ preventScroll: true }); }); }}><Pencil size={15} />Редактирай</button>{entry.deletable && <button type="button" disabled={saving} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); setError(''); setRemove(entry); }}><Trash2 size={15} />Изтрий</button>}</div>
                </details>}</td>
              </tr>)}
            </tbody></table></div> : <div className={styles.emptyState}><ReceiptText size={32} aria-hidden="true" /><h3>{entryKind === 'all' ? 'Няма записи за този период' : entryKind === 'revenue' ? 'Няма приходи за този период' : 'Няма разходи за този период'}</h3><p>{category ? 'Изберете друга категория или период.' : 'Добавените записи ще се показват тук.'}</p></div>}
            {periodList.count > 0 && <button className={styles.wide} type="button" onClick={() => setAllExpenses(value => !value)}>{allExpenses ? 'Покажи по-малко' : 'Виж всички записи →'}</button>}

            {periodList.count > 20 && <div className={styles.pagination}><button type="button" disabled={page === 1} onClick={() => { setAllExpenses(true); setPage(p => p-1); setList(null); }}>Предишна</button><span>{page} / {Math.max(1,Math.ceil(periodList.count/20))}</span><button type="button" disabled={page*20 >= periodList.count} onClick={() => { setAllExpenses(true); setPage(p => p+1); setList(null); }}>Следваща</button></div>}
          </>}
          </div>
          </div>
          <div id={`${ledgerId}-analysis`} className={styles.analysisView} hidden={ledgerView !== 'analysis'} role="region" aria-label="Анализ">
            {ledgerView === 'analysis' && <Suspense fallback={<FinanceSkeleton variant="analysis" />}><FinanceAnalysis showCategoryColors={showCategoryColors} clubId={clubId} revision={data} /></Suspense>}
          </div>
        </section>


        <dialog onClick={closeOnBackdrop} ref={categoriesDialogRef} className={styles.categoriesDialog} aria-labelledby="finance-categories-title" onCancel={event => { if (saving) event.preventDefault(); }}>
          <header className={styles.dialogHeader}><h2 id="finance-categories-title">Управление на категории</h2><button type="button" disabled={saving} aria-label="Затвори" onClick={() => categoriesDialogRef.current?.close()}><X size={18} /></button></header>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.categoryToolbar}><button type="button" disabled={saving} className={styles.primary} onClick={() => { setError(''); setCategoryEdit({ name: '', color: null }); }}><Plus size={16} />Нова категория</button></div>
          <aside className={styles.categoryHelp} aria-label="За скриването на категории">
            <EyeOff size={18} aria-hidden="true" />
            <div><strong>Скриването запазва всички записи</strong><p>„Скрий“ премахва категорията само от избора при добавяне на нов разход или приход. Категорията и записите ѝ се запазват. Можете да я активирате отново по всяко време.</p></div>
          </aside>
          <div className={`${styles.categoryKindFilters} ${styles.categoryVisibilityFilters}`} role="group" aria-label="Филтрирай категориите по видимост"><button type="button" aria-pressed={categoryVisibility === 'all'} onClick={() => setCategoryVisibility('all')}>Всички</button><button type="button" aria-pressed={categoryVisibility === 'active'} onClick={() => setCategoryVisibility('active')}>Активни</button><button type="button" aria-pressed={categoryVisibility === 'hidden'} onClick={() => setCategoryVisibility('hidden')}>Скрити</button></div>

          <div className={styles.categorySaveStatus} role="status" aria-live="polite">{ordering && <>Запазване на подредбата…</>}</div>{!data && <FinanceSkeleton variant="categories" />}<ul className={styles.categoryList} aria-busy={ordering || !data}>{data?.categories.filter(c => categoryVisibility === 'all' || (categoryVisibility === 'active' ? c.isActive : !c.isActive)).map(c => <li key={c.id} title="Плъзнете за подреждане" data-category-id={c.id} data-active={c.isActive} onPointerDown={event => startCategoryDrag(event,c.id)} onPointerMove={moveCategoryDrag} onPointerUp={() => finishCategoryDrag()} onPointerCancel={() => finishCategoryDrag(true)} onLostPointerCapture={() => finishCategoryDrag(true)}><span className={styles.categoryDragHandle} aria-hidden="true"><GripVertical size={17} /></span><span className={styles.categoryNumber} aria-label="Позиция">{(data?.categories.findIndex(item => item.id === c.id) ?? 0) + 1}</span><span className={styles.categoryName}>{showCategoryColors && c.color && <i className={styles.categorySwatch} style={{background:c.color}} aria-hidden="true" />}{c.name}{!c.isActive && <small>Неактивна</small>}</span><span className={styles.categoryTotals}>{!report && <SkeletonLine wide />}{(report?.subtotals.filter(total => total.categoryId === c.id) ?? []).map(total => <strong key={`${total.kind}-${total.currency}`}><small>{total.kind === 'revenue' ? 'Приходи' : 'Разходи'}</small>{money(total.amount,total.currency)}</strong>)}</span><span className={styles.categoryOrder}><button type="button" aria-label={`Премести ${c.name} нагоре`} disabled={saving || categories[0]?.id === c.id} onClick={() => void moveCategory(c.id,-1)}><ArrowUp size={15} /></button><button type="button" aria-label={`Премести ${c.name} надолу`} disabled={saving || categories.at(-1)?.id === c.id} onClick={() => void moveCategory(c.id,1)}><ArrowDown size={15} /></button></span><button type="button" aria-label={`Преименувай ${c.name}`} disabled={saving} onClick={() => { setError(''); setCategoryEdit({ id: c.id,name: c.name,color:c.color }); }}><Pencil size={16} /></button><button type="button" className={`${styles.categoryVisibilityButton} ${c.isActive ? styles.categoryDeactivate : styles.categoryActivate}`} title={c.isActive ? 'Скрий категорията' : 'Покажи категорията'} aria-label={`${c.isActive ? 'Скрий' : 'Покажи'} ${c.name}`} disabled={saving} onClick={() => { setError(''); setCategoryStatus({id:c.id,name:c.name,isActive:c.isActive}); categoryConfirmRef.current?.showModal(); }}>{c.isActive ? <EyeOff size={16} /> : <Eye size={16} />}</button></li>)}</ul>
        </dialog>
      </div>
      <dialog ref={categoryEditorRef} className={`${styles.categoriesDialog} ${styles.categoryConfirmation} ${styles.categoryEditor}`} aria-labelledby="finance-category-editor-title" onClose={() => setCategoryEdit(null)} onCancel={event => { if (saving) event.preventDefault(); }} onClick={event => { if (!saving && event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setCategoryEdit(null); } }}>
        <header className={styles.dialogHeader}><h2 id="finance-category-editor-title">{categoryEdit?.id ? 'Редактирай категория' : 'Нова категория'}</h2><button type="button" disabled={saving} aria-label="Затвори" onClick={() => setCategoryEdit(null)}><X size={18} /></button></header>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {categoryEdit && <form className={styles.categoryForm} onSubmit={event => { event.preventDefault(); void mutate({ ...categoryEdit, action: categoryEdit.id ? 'renameCategory' : 'createCategory' }); }}><label>Име<input autoFocus required maxLength={100} value={categoryEdit.name} onChange={e => setCategoryEdit({ ...categoryEdit,name:e.target.value })} /></label><fieldset className={styles.categoryColors}><legend>Цвят (незадължително)</legend><button type="button" aria-pressed={!categoryEdit.color} onClick={() => setCategoryEdit({...categoryEdit,color:null})}>Без цвят</button>{CUSTOM_TRAINING_GROUP_COLOR_PALETTE.filter(color => !categories.some(category => category.id !== categoryEdit.id && category.color === color)).map(color => <button key={color} type="button" aria-label={`Цвят ${color}`} aria-pressed={categoryEdit.color === color} style={{background:color,color:customTrainingGroupReadableOnAccent(color)}} onClick={() => setCategoryEdit({...categoryEdit,color})}>{categoryEdit.color === color ? '✓' : ''}</button>)}</fieldset><button type="submit" disabled={saving}>Запази</button><button type="button" disabled={saving} onClick={() => setCategoryEdit(null)}>Отказ</button></form>}
      </dialog>
      <dialog onClick={closeOnBackdrop} ref={categoryConfirmRef} className={`${styles.categoriesDialog} ${styles.categoryConfirmation}`} aria-labelledby="category-status-title" onCancel={event => { if (saving) event.preventDefault(); }}>
        <h2 id="category-status-title">{categoryStatus?.isActive ? 'Деактивиране на категория' : 'Активиране на категория'}</h2>
        <p>{categoryStatus?.isActive ? `Да деактивираме ли „${categoryStatus.name}“? Категорията и съществуващите записи се запазват. Тя няма да се предлага за нови разходи и приходи.` : `Да активираме ли „${categoryStatus?.name}“ отново? Тя ще се предлага при добавяне на нови записи.`}</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.formActions}><button type="button" disabled={saving} onClick={() => { categoryConfirmRef.current?.close(); setCategoryStatus(null); }}>Отказ</button><button type="button" className={categoryStatus?.isActive ? styles.categoryDeactivate : styles.categoryActivate} disabled={saving} onClick={() => void saveCategoryStatus()}>{saving ? 'Запазване…' : categoryStatus?.isActive ? 'Деактивирай' : 'Активирай'}</button></div>
      </dialog>
      <aside className={styles.sidebar} hidden={ledgerView === 'analysis'}>{ledgerView !== 'analysis' && <>
        <div className={styles.entryActions}><button type="button" disabled={!data || saving} onClick={() => newEntry(formKind === 'expense' ? 'revenue' : 'expense')}><Plus size={16} />{formKind === 'expense' ? 'Добави приход' : 'Добави разход'}</button></div>
        {entryForm}

        {debtsPanel}
      </>}</aside>
    </div>

          {remove && <FinanceDeleteDialog entry={remove} saving={saving} error={error} onClose={() => setRemove(null)} onConfirm={() => void mutate({action:remove.kind === 'revenue' ? 'deleteRevenue' : 'deleteExpense',id:remove.id})} />}
          {selectedPlayerId && <Suspense fallback={<FinancePlayerSkeleton onClose={() => setSelectedPlayerId(null)} />}><FinancePlayerDetails key={selectedPlayerId} playerId={selectedPlayerId} clubId={clubId} onClose={() => setSelectedPlayerId(null)} /></Suspense>}
  </div>;
}
