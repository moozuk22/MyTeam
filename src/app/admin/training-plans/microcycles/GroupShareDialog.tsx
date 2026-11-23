"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { filterGroups, matchesQuery, type FilterGroup } from "@/lib/exercise/microcycleGroupFilter";

/** Lets the methodist choose more groups that use the same microcycle in this week. */
export default function GroupShareDialog({ groups, chosen, hasCycle, onConfirm, onClose }: {
  /** The groups that the methodist can add. */
  groups: FilterGroup[];
  chosen: string[];
  /** True when the group already has another microcycle in this week. */
  hasCycle: (key: string) => boolean;
  onConfirm: (keys: string[]) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(() => new Set(chosen));
  const [query, setQuery] = useState("");

  useEffect(() => {
    const element = dialog.current;
    const trigger = globalThis.document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  const visible = filterGroups(groups, "").filter(g => matchesQuery(g.name, query) || (g.coach && matchesQuery(g.coach.name, query)));
  const toggle = (key: string) => setSelected(current => { const next = new Set(current); if (!next.delete(key)) next.add(key); return next; });
  const allVisible = visible.length > 0 && visible.every(g => selected.has(g.key));

  return <dialog ref={dialog} className="tp-modal mc-print-dialog" aria-labelledby="mc-share-dialog-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="tp-modal-header">
      <h2 id="mc-share-dialog-title">Използвай и за други групи</h2>
      <button type="button" className="tp-icon-btn" aria-label="Затвори" onClick={onClose}><X size={20} aria-hidden="true" /></button>
    </div>
    <p className="mc-print-note">Избраните групи получават същия микроцикъл след запазване.</p>
    <label className="tp-field mc-search mc-dialog-search">
      <span><Search size={16} aria-hidden="true" />Търсене</span>
      <input type="search" maxLength={200} value={query} placeholder="Търси група или треньор" onChange={e => setQuery(e.target.value)} />
    </label>
    {visible.length > 0 && <button type="button" className="tp-secondary-btn mc-print-all"
      onClick={() => setSelected(current => { const next = new Set(current); for (const g of visible) if (allVisible) next.delete(g.key); else next.add(g.key); return next; })}>
      {allVisible ? "Премахни избора" : "Избери всички"}
    </button>}
    <fieldset className="mc-print-options">
      <legend className="td-sr-only">Групи</legend>
      {visible.length === 0 && <p className="tp-empty">{groups.length ? "Няма групи, които отговарят на търсенето." : "Няма други групи."}</p>}
      {visible.map(g => <label className="mc-print-option" key={g.key}>
        <input type="checkbox" checked={selected.has(g.key)} onChange={() => toggle(g.key)} />
        <span>
          <strong>{g.name}</strong>
          {(g.coach || hasCycle(g.key)) && <small>
            {g.coach?.name}{g.coach && hasCycle(g.key) && " · "}{hasCycle(g.key) && "Има микроцикъл – ще бъде заменен"}
          </small>}
        </span>
      </label>)}
    </fieldset>
    <div className="mc-print-actions">
      <button type="button" className="tp-secondary-btn" onClick={onClose}>Отказ</button>
      <button type="button" className="tp-primary-btn" onClick={() => onConfirm(groups.filter(g => selected.has(g.key)).map(g => g.key))}>
        <Users size={16} aria-hidden="true" /> Избери{selected.size > 0 && ` (${selected.size})`}
      </button>
    </div>
  </dialog>;
}
