'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { calculatorHasAccess, calculatorPrice, calculatorPurchase, type CalculatorMode, type CalculatorPrice } from '@/lib/calculatorSubscriptionDomain';
import { localToday, nextMonth, type ClubSubscriptionView } from '@/lib/clubSubscriptionDomain';
import type { CalculatorAdminView } from '@/lib/calculatorSubscriptions';
import styles from './subscriptions.module.css';
const labels = {
  monthly: 'Месечно',
  yearly: 'Годишно',
  lifetime: 'Еднократно — безсрочно'
};
const modes = Object.keys(labels) as CalculatorMode[];
export type CalculatorClub = ClubSubscriptionView & {
  calculator?: CalculatorAdminView;
};
type PriceData = {
  prices: CalculatorPrice[];
  revision: string | null;
};
async function json<T>(url: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, body ? {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  } : {
    cache: 'no-store'
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Промяната не е запазена.');
  return result;
}
export function SharedCalculatorPrices({
  onSaved,
  onLoaded
}: {
  onSaved: () => void;
  onLoaded: (prices: CalculatorPrice[]) => void;
}) {
  const [billingMode, setBillingMode] = useState<CalculatorMode>('monthly');
  const [data, setData] = useState<PriceData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await json<PriceData>('/api/admin/subscriptions/calculator-prices');
    setData(result);
    onLoaded(result.prices);
  }, [onLoaded]);
  useEffect(() => {
    void load().catch(e => setError(e.message));
  }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await json('/api/admin/subscriptions/calculator-prices', {
        ...Object.fromEntries(fields),
        expectedRevision: data?.revision ?? null
      });
      await load();
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <section className={`${styles.card} ${styles.sharedPrices}`} aria-label="Общи цени за калкулатора"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ЦЕНОВА ПОЛИТИКА</span><h2>Финансов калкулатор — общи цени</h2></div><span className={styles.badge}>EUR</span></div>
    <p>Изберете период на плащане и задайте цена за него. Клубовете използват общата цена, освен когато имат индивидуална цена.</p>
    {data && <form onSubmit={e => void submit(e)}><fieldset disabled={busy} className={`${styles.formFields} ${styles.priceFields}`}>
      <label>Период на плащане<select name="billingMode" value={billingMode} onChange={event => setBillingMode(event.target.value as CalculatorMode)}>{modes.map(mode => <option key={mode} value={mode}>{labels[mode]}</option>)}</select></label>
      <label key={`amount-${billingMode}`}>Цена (EUR)<input name="amount" inputMode="decimal" required pattern="[0-9]+([.,][0-9]{1,2})?" /></label>
      <label>В сила от месец<input key={`month-${billingMode}`} name="effectiveMonth" type="month" onClick={event => { try { event.currentTarget.showPicker?.(); } catch { /* Native keyboard entry remains available. */ } }} required min={data.prices.some(price => price[billingMode] !== null) ? nextMonth(localToday().slice(0, 7)) : '2000-01'} max="2199-12" defaultValue={data.prices.some(price => price[billingMode] !== null) ? nextMonth(localToday().slice(0, 7)) : localToday().slice(0, 7)} /></label>
      <button type="submit" className={styles.primary}>Запази общата цена</button>
    </fieldset></form>}
    {!data && !error && <p role="status">Зареждане…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <ul className={styles.priceRevisions}>{data?.prices.flatMap(price => modes.filter(mode => price[mode] !== null).map(mode => <li key={`${price.id}-${mode}`}>От {price.effectiveMonth}: {labels[mode]} — {price[mode]} EUR</li>))}</ul>
  </section>;
}
export default function CalculatorSubscription({
  club,
  revision = 0,
  paymentOnly = false,
  sharedPrices,
  onSaved
}: {
  club: CalculatorClub;
  revision?: number;
  paymentOnly?: boolean;
  sharedPrices?: CalculatorPrice[];
  onSaved?: () => void;
}) {
  const [data, setData] = useState<CalculatorAdminView | null>(club.calculator ?? null);
  const [prices, setPrices] = useState<CalculatorPrice[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState(paymentOnly);
  const [confirmation, setConfirmation] = useState<{action: 'restore' | 'void'; paymentId: string} | null>(null);
  const base = `/api/admin/subscriptions/${club.id}/calculator`;
  const load = useCallback(async () => {
    const [value, shared] = await Promise.all([json<CalculatorAdminView>(base), sharedPrices ? Promise.resolve({
      prices: sharedPrices
    }) : json<PriceData>('/api/admin/subscriptions/calculator-prices')]);
    setData(value);
    setPrices(shared.prices);
  }, [base, sharedPrices]);
  useEffect(() => {
    if (club.calculator) {
      setData(club.calculator);
      if (sharedPrices) setPrices(sharedPrices);
      else void json<PriceData>('/api/admin/subscriptions/calculator-prices').then(result => setPrices(result.prices)).catch(e => setError(e.message));
    } else {
      void load().catch(e => setError(e.message));
    }
  }, [load, revision, club.subscription?.version, club.calculator, sharedPrices]);
  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await json<{
        warning?: string;
      }>(base, {
        ...body,
        expectedVersion: data?.version ?? 0
      });
      setMessage(result.warning ?? 'Промяната е запазена.');
      await load();
      setPayment(false);
      onSaved?.();
    } catch (e) {
      setError((e as Error).message);
      await load().catch(() => {});
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const contract = club.subscription?.mode === 'contract';
  const active = data ? calculatorHasAccess(data.grants) : false;
  return <section className={styles.editor} aria-label="Абонамент за финансов калкулатор">
    <h3>Финансов калкулатор</h3>
    {error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status">{message}</p>}
    {!data && <p role="status">Зареждане…</p>}
    {data && <>
      <p><strong>{active ? 'Активен' : 'Заключен'}</strong> · {labels[data.billingMode]} · {calculatorPrice(prices, data.prices, data.billingMode, localToday().slice(0, 7)) ?? 'Няма зададена цена'} EUR</p>
      {!paymentOnly && <>
        {!contract && <label>Период на плащане<select disabled={busy} value={data.billingMode} onChange={e => void save({
            action: 'configure',
            billingMode: e.target.value
          }).catch(() => {})}>{modes.map(m => <option key={m} value={m}>{labels[m]}</option>)}</select></label>}
        {(contract || club.subscription?.mode === 'trial' || data.freeEnabled) && <button type="button" disabled={busy} onClick={() => void save({
          action: 'grant',
          enabled: !data.freeEnabled
        }).catch(() => {})}>{data.freeEnabled ? 'Спри безплатния достъп' : contract ? 'Включи по договор' : 'Включи за пробния период'}</button>}
        {!contract && <CalculatorPriceForm key={`${data.version}-${data.billingMode}`} data={data} busy={busy} save={save} />}
        {!contract && <button type="button" disabled={busy} className={styles.primary} onClick={() => setPayment(p => !p)}>Маркирай калкулатора като платен</button>}
      </>}
      {(payment || paymentOnly) && !contract && <CalculatorPayment key={`${data.version}-${data.billingMode}`} data={data} prices={prices} busy={busy} save={save} />}
      {!paymentOnly && <CalculatorHistory data={data} busy={busy} onVoid={paymentId => setConfirmation({action: 'void', paymentId})} onRestore={contract ? undefined : paymentId => setConfirmation({action: 'restore', paymentId})} />}
      {confirmation && <CalculatorPaymentConfirmation action={confirmation.action} busy={busy} onClose={() => setConfirmation(null)} onConfirm={async () => {
        await save(confirmation);
        setConfirmation(null);
      }} />}


    </>}
  </section>;
}
export function CalculatorPaymentConfirmation({action, busy, onClose, onConfirm}: {action: 'restore' | 'void'; busy: boolean; onClose: () => void; onConfirm: () => Promise<void>}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [error, setError] = useState('');
  const restoring = action === 'restore';
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className={styles.confirmDialog} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => {event.preventDefault(); if (!busy) onClose();}} onClick={event => {if (event.target === event.currentTarget && !busy) onClose();}}>
    <span className={styles.eyebrow}>ФИНАНСОВ КАЛКУЛАТОР</span>
    <h2 id={titleId}>{restoring ? 'Възстановяване на плащане' : 'Анулиране на плащане'}</h2>
    <p id={descriptionId}>{restoring ? 'Възстановявате оригиналното плащане и всички негови периоди на достъп. Сумата и датата се запазват. Не се записва второ плащане.' : 'Достъпът за периодите в това плащане ще бъде отнет. Записаните приходи и разходи се запазват. Можете да възстановите плащането по-късно.'}</p>
    <div className={styles.confirmNote}>Действието се запазва в административната история.</div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.confirmActions}><button ref={cancelRef} type="button" disabled={busy} onClick={onClose}>Отказ</button><button type="button" className={restoring ? styles.primary : styles.voidButton} disabled={busy} onClick={() => {setError(''); void onConfirm().catch(e => setError((e as Error).message));}}>{busy ? 'Запазване…' : restoring ? 'Възстанови плащането' : 'Анулирай плащането'}</button></div>
  </dialog>;
}

const historyDate = (value: string) => new Intl.DateTimeFormat('bg-BG', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Sofia'}).format(new Date(value));
const historyMonth = (value: string) => new Intl.DateTimeFormat('bg-BG', {month: 'long', year: 'numeric', timeZone: 'Europe/Sofia'}).format(new Date(`${value}-15T12:00:00Z`));
const historyPeriod = (start: string, end: string | null) => `${historyDate(start)} → ${end ? historyDate(new Date(new Date(end).getTime() - 1).toISOString()) : 'Безсрочно'}`;
const historyActions: Record<string, string> = {configure: 'Период на плащане', price: 'Промяна на цена', grant: 'Безплатен достъп', payment: 'Получено плащане', void: 'Анулирано плащане', restore: 'Възстановено плащане'};

export function CalculatorHistory({data, busy, onVoid, onRestore}: {data: CalculatorAdminView; busy: boolean; onVoid: (id: string) => void; onRestore?: (id: string) => void}) {
  return <details className={styles.calculatorHistory}>
    <summary>История на калкулатора<span>Цени, достъп и плащания</span></summary>
    <div className={styles.historyContent}>
      <div className={styles.historyColumns}>
        <section className={styles.historySection}><h4>Индивидуални цени <span>{data.prices.length}</span></h4>
          {!data.prices.length ? <p className={styles.historyEmpty}>Няма индивидуални промени. Използват се общите цени.</p> : <ul className={styles.historyRows}>{data.prices.map(p => <li key={p.id}><div><strong>{labels[p.billingMode as CalculatorMode]}</strong><small>В сила от {historyMonth(p.effectiveMonth)}</small></div><span>{p.amount === null ? 'Обща цена' : `${p.amount} EUR`}</span></li>)}</ul>}
        </section>
        <section className={styles.historySection}><h4>Периоди на достъп <span>{data.grants.length}</span></h4>
          {!data.grants.length ? <p className={styles.historyEmpty}>Все още няма предоставен достъп.</p> : <ul className={styles.historyRows}>{data.grants.map(g => <li key={g.id}><div><strong>{historyPeriod(g.startsAt, g.endsAt)}</strong><small>{g.kind === 'trial' ? 'Пробен период' : g.kind === 'contract' ? 'По договор' : 'Платен достъп'}</small></div>{g.revokedAt && <span className={styles.badge} data-status="trial_expired">Анулиран</span>}</li>)}</ul>}
        </section>
      </div>
      <section className={styles.historySection}><h4>Плащания <span>{data.payments.length}</span></h4>
        {!data.payments.length && <p className={styles.historyEmpty}>Все още няма записани плащания.</p>}
        <div className={styles.paymentHistory}>{data.payments.map(p => <article className={styles.payment} data-voided={!!p.voidedAt} key={p.id}>
          <div className={styles.paymentHeader}><div><span className={styles.historyLabel}>{labels[p.billingMode as CalculatorMode]}</span><time dateTime={p.paidOn}>{historyDate(`${p.paidOn.slice(0, 10)}T12:00:00Z`)}</time></div><strong className={styles.paymentAmount}>{p.total} <small>EUR</small></strong></div>
          <div className={styles.paymentStatus}><span className={styles.badge} data-status={p.voidedAt ? 'trial_expired' : 'active'}>{p.voidedAt ? 'Анулирано' : 'Платено'}</span>{p.voidedAt && <span>Запазено за справка · не предоставя достъп</span>}</div>
          <ul className={styles.historyRows}>{data.grants.filter(g => g.paymentId === p.id).map(g => <li key={g.id}><span>{historyPeriod(g.startsAt, g.endsAt)}</span><strong>{g.amount} EUR</strong></li>)}</ul>
          {p.note && <div className={styles.paymentNote}><span className={styles.historyLabel}>Бележка</span><p>{p.note}</p></div>}
          {p.voidedAt && onRestore && <div className={styles.paymentFooter}><button className={styles.primary} type="button" disabled={busy} onClick={() => onRestore(p.id)}>Възстанови плащането и достъпа</button></div>}
          {!p.voidedAt && <div className={styles.paymentFooter}><button className={styles.voidButton} type="button" disabled={busy} onClick={() => onVoid(p.id)}>Анулирай плащането</button></div>}
        </article>)}</div>
      </section>
      <section className={styles.historySection}><h4>Административна история <span>{data.changes.length}</span></h4>
        {!data.changes.length && <p className={styles.historyEmpty}>Няма записани промени.</p>}
        <ol className={styles.calculatorTimeline}>{data.changes.map(c => <li key={c.id} data-action={c.action}><div className={styles.timelineHeading}><strong>{historyActions[c.action] ?? c.action}</strong><time dateTime={c.createdAt}>{new Intl.DateTimeFormat('bg-BG', {dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Sofia'}).format(new Date(c.createdAt))}</time></div><p>{calculatorAuditDescription(c.action, c.details)}</p><small className={styles.actor}>Акаунт: <span>{c.actorId === 'env-admin' ? 'Системен администратор' : c.actorId}</span></small></li>)}</ol>
      </section>
    </div>
  </details>;
}

function CalculatorPriceForm({
  data,
  busy,
  save
}: {
  data: CalculatorAdminView;
  busy: boolean;
  save: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [shared, setShared] = useState(false);
  const [error, setError] = useState('');
  return <form onSubmit={e => {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    void save({
      action: 'price',
      billingMode: data.billingMode,
      effectiveMonth: fields.get('effectiveMonth'),
      amount: shared ? null : fields.get('amount')
    }).catch(e => setError(e.message));
  }}>
    <fieldset className={styles.formFields} disabled={busy}><legend>Цена за този клуб — {labels[data.billingMode]}</legend>
      <label className={styles.inlineChoice}><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />Използвай общата цена</label>
      {!shared && <label>Индивидуална цена (EUR)<input name="amount" inputMode="decimal" required pattern="[0-9]+([.,][0-9]{1,2})?" /></label>}
      <label>В сила от месец<input name="effectiveMonth" type="month" onClick={event => { try { event.currentTarget.showPicker?.(); } catch { /* Native keyboard entry remains available. */ } }} min={data.prices.some(p => p.billingMode === data.billingMode) ? nextMonth(localToday().slice(0, 7)) : '2000-01'} max="2199-12" defaultValue={data.prices.some(p => p.billingMode === data.billingMode) ? nextMonth(localToday().slice(0, 7)) : localToday().slice(0, 7)} required /></label>
      <button type="submit">Запази цената</button>
    </fieldset>{error && <p role="alert">{error}</p>}
  </form>;
}
function CalculatorPayment({
  data,
  prices,
  busy,
  save
}: {
  data: CalculatorAdminView;
  prices: CalculatorPrice[];
  busy: boolean;
  save: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [year, setYear] = useState(Number(localToday().slice(0, 4)));
  const [selected, setSelected] = useState<string[]>([]);
  const [start, setStart] = useState(localToday().slice(0, 7));
  const [paidOn, setPaidOn] = useState(localToday);
  const [note, setNote] = useState('');
  const [paymentId, setPaymentId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const id = useId();
  const months = data.billingMode === 'monthly' ? selected : [start];
  let total = '0.00';
  let quoteError = '';
  try {
    if (months.length) total = calculatorPurchase(data.billingMode, months, prices, data.prices).total;
  } catch (e) {
    quoteError = (e as Error).message;
  }
  return <form onSubmit={e => {
    e.preventDefault();
    void save({
      action: 'payment',
      months,
      paidOn,
      note,
      paymentId,
      expectedTotal: total
    }).then(() => {
      setSelected([]);
      setPaymentId(crypto.randomUUID());
    }).catch(e => setError(e.message));
  }}>
    <fieldset disabled={busy} className={styles.formFields}><legend>Плащане за финансов калкулатор — {labels[data.billingMode]}</legend>
      {data.billingMode === 'monthly' ? <><label>Година<select value={year} onChange={e => setYear(Number(e.target.value))}>{Array.from({
              length: 200
            }, (_, i) => 2000 + i).map(y => <option key={y}>{y}</option>)}</select></label>
        <div className={styles.monthGrid}>{Array.from({
            length: 12
          }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`).map(month => {
            const date = new Date(`${month}-15T12:00:00Z`);
            const paid = data.grants.some(g => g.kind === 'paid' && !g.revokedAt && new Date(g.startsAt) <= date && (!g.endsAt || new Date(g.endsAt) > date));
            return <label key={month} className={styles.monthOption}><input type="checkbox" checked={selected.includes(month)} disabled={paid || !selected.includes(month) && selected.length >= 120} onChange={e => setSelected(p => e.target.checked ? [...p, month].sort() : p.filter(m => m !== month))} /><span>{new Intl.DateTimeFormat('bg-BG', {
                  month: 'long'
                }).format(date)}<small>{paid ? 'Платено' : `${calculatorPrice(prices, data.prices, data.billingMode, month) ?? '—'} EUR`}</small></span></label>;
          })}</div><p>Избрани месеци: {selected.join(', ') || 'няма'}. Може да избирате от повече от една година.</p></> : <label htmlFor={`${id}-start`}>Начален месец<input id={`${id}-start`} type="month" min="2000-01" max={data.billingMode === 'yearly' ? '2199-01' : '2199-12'} required value={start} onChange={e => setStart(e.target.value)} /></label>}
      <p>{data.billingMode === 'yearly' ? 'Покрива 12 последователни календарни месеца.' : data.billingMode === 'lifetime' ? 'Безсрочен достъп от избрания месец.' : 'Избраните месеци се записват отделно.'} Автоматичните приходи за покритите периоди се възстановяват. Неплатените периоди остават празни.</p>
      <label>Дата на плащане<input type="date" required min="2000-01-01" max={localToday()} value={paidOn} onChange={e => setPaidOn(e.target.value)} /></label>
      <label>Бележка<textarea maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
      <strong>Общо: {total} EUR</strong><button type="submit" className={styles.primary} disabled={!months.length || !!quoteError}>Потвърди плащане — {total} EUR</button>
    </fieldset>{(error || quoteError) && <p role="alert" className={styles.error}>{error || quoteError}</p>}
  </form>;
}

function calculatorAuditDescription(action: string, details: unknown): string {
  const value = details && typeof details === 'object' && !Array.isArray(details) ? details as Record<string, unknown> : {};
  const modeLabel = (mode: unknown) => labels[mode as CalculatorMode] ?? '—';
  if (action === 'configure') return `${modeLabel(value.before)} → ${modeLabel(value.billingMode)}`;
  if (action === 'price') return `${modeLabel(value.billingMode)} от ${String(value.effectiveMonth)}: ${value.amount === null ? 'Обща цена' : `${String(value.amount)} EUR`}`;
  if (action === 'grant') return value.enabled ? (value.kind === 'contract' ? 'Включен по договор' : 'Включен за пробния период на клуба') : 'Безплатният достъп е спрян';
  if (action === 'payment') return `${String(value.expectedTotal)} EUR · ${String(value.paidOn)} · ${modeLabel(value.billingMode)} · ${Array.isArray(value.months) ? value.months.join(', ') : ''}`;
  if (action === 'restore') return `Възстановени ${String(value.total)} EUR от ${String(value.paidOn)}. Оригиналното плащане и периодите са запазени, без второ плащане.`;
  if (action === 'void') return `Анулирани ${String(value.total)} EUR от ${String(value.paidOn)}. Финансовата история е запазена.`;
  return 'Промяната е записана.';
}
