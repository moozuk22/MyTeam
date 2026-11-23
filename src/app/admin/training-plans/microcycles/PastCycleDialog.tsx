"use client";

import { useEffect, useRef, useState } from "react";
import { History, Search, X } from "lucide-react";
import { formatWeekRange, type CycleContent, type PastCycle } from "@/lib/exercise/microcycle";

const trainingCount = (n: number) => `${n} ${n === 1 ? "тренировка" : "тренировки"}`;

async function read<T>(url: string, fallback: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(value?.error ?? fallback);
  return value as T;
}

/** Lists the microcycles of earlier weeks. The chosen one fills the editor. */
export default function PastCycleDialog({ endpoint, week, groupKey, onPick, onClose }: {
  /** The history endpoint with the club location. */
  endpoint: string; week: string; groupKey: string;
  onPick: (content: CycleContent) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [cycles, setCycles] = useState<PastCycle[]>();
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [picking, setPicking] = useState("");

  useEffect(() => {
    const element = dialog.current;
    const trigger = globalThis.document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const listUrl = (offset: number) => `${endpoint}&${new URLSearchParams({ week, groupKey, q: search, offset: String(offset) })}`;
  useEffect(() => {
    const abort = new AbortController();
    setCycles(undefined); setError("");
    read<{ cycles: PastCycle[]; more: boolean }>(listUrl(0), "Предишните микроцикли не могат да бъдат заредени.", abort.signal)
      .then(value => { if (!abort.signal.aborted) { setCycles(value.cycles); setMore(value.more); } })
      .catch((failure: Error) => { if (!abort.signal.aborted) setError(failure.message); });
    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listUrl depends only on these values.
  }, [endpoint, week, groupKey, search, attempt]);

  async function loadMore() {
    setLoadingMore(true); setError("");
    try {
      const value = await read<{ cycles: PastCycle[]; more: boolean }>(listUrl(cycles?.length ?? 0), "Предишните микроцикли не могат да бъдат заредени.");
      setCycles(current => [...current ?? [], ...value.cycles.filter(c => !current?.some(item => item.id === c.id))]); setMore(value.more);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Грешка при зареждане."); } finally { setLoadingMore(false); }
  }

  async function pick(id: string) {
    setPicking(id); setError("");
    try {
      const { content } = await read<{ content: CycleContent }>(`${endpoint}&${new URLSearchParams({ cycleId: id })}`, "Микроцикълът не може да бъде зареден.");
      onPick(content);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Грешка при зареждане."); setPicking(""); }
  }

  return <dialog ref={dialog} className="tp-modal mc-print-dialog" aria-labelledby="mc-past-dialog-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="tp-modal-header">
      <h2 id="mc-past-dialog-title">Избери предишен микроцикъл</h2>
      <button type="button" className="tp-icon-btn" aria-label="Затвори" onClick={onClose}><X size={20} aria-hidden="true" /></button>
    </div>
    <p className="mc-print-note">Съдържанието се зарежда в редактора. Запазва се, когато изберете „Запази“.</p>
    <label className="tp-field mc-search mc-dialog-search">
      <span><Search size={16} aria-hidden="true" />Търсене</span>
      <input type="search" maxLength={200} value={query} placeholder="Търси група" onChange={e => setQuery(e.target.value)} />
    </label>
    {error && <div role="alert" className="td-feedback mc-print-error">{error}
      <button type="button" className="tp-secondary-btn" onClick={() => cycles ? void loadMore() : setAttempt(v => v + 1)}>Опитай отново</button>
    </div>}
    {!cycles && !error && <div className="mc-print-options" role="status" aria-label="Зареждане" aria-busy="true">
      {[0, 1, 2].map(i => <div key={i} className="mc-print-option" aria-hidden="true">
        <span><span className="td-skeleton td-skeleton--meta" /><span className="td-skeleton td-skeleton--meta" /></span>
      </div>)}
    </div>}
    {cycles && <div className="mc-print-options">
      {cycles.length === 0 && <p className="tp-empty">{search ? "Няма микроцикли, които отговарят на търсенето." : "Няма микроцикли от предишни седмици."}</p>}
      {cycles.map(cycle => <button type="button" key={cycle.id} className="mc-print-option mc-past-option" disabled={!!picking}
        aria-busy={picking === cycle.id || undefined} onClick={() => void pick(cycle.id)}>
        <span>
          <strong>{formatWeekRange(cycle.week)}</strong>
          <small>{cycle.groups.join(", ")}</small>
          <small>
            {[cycle.own && "Тази група", cycle.number && `Микроцикъл №${cycle.number}`, [cycle.format, cycle.age].filter(Boolean).join(" · "), trainingCount(cycle.trainings)]
              .filter(Boolean).join(" · ")}
          </small>
        </span>
      </button>)}
      {more && <button type="button" className="tp-secondary-btn" disabled={loadingMore} aria-busy={loadingMore || undefined} onClick={() => void loadMore()}>
        <History size={16} aria-hidden="true" /> Покажи още
      </button>}
    </div>}
    <div className="mc-print-actions">
      <button type="button" className="tp-secondary-btn" onClick={onClose}>Отказ</button>
    </div>
  </dialog>;
}
