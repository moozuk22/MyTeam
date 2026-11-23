"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Users, X } from "lucide-react";

/** The list shows this number of groups until the user selects „Покажи всички“. */
const VISIBLE_GROUPS = 5;

/** Asks where a change of a shared microcycle applies: only to the open group (a copy) or to all its groups. */
export default function SaveScopeDialog({ groupName, groups, onChoose, onClose }: {
  groupName: string;
  /** The names of all groups that use the microcycle, the open group first. */
  groups: string[];
  onChoose: (scope: "group" | "all") => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);
  const groupCount = groups.length;
  const shown = expanded ? groups : groups.slice(0, VISIBLE_GROUPS);
  useEffect(() => {
    const element = dialog.current;
    const trigger = globalThis.document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialog} className="tp-modal mc-print-dialog" aria-labelledby="mc-scope-dialog-title" aria-describedby="mc-scope-dialog-note"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="tp-modal-header">
      <h2 id="mc-scope-dialog-title">Къде да запазим промените?</h2>
      <button type="button" className="tp-icon-btn" aria-label="Затвори" onClick={onClose}><X size={20} aria-hidden="true" /></button>
    </div>
    <p id="mc-scope-dialog-note" className="mc-print-note">Този микроцикъл се използва от {groupCount} групи.</p>
    <div className="mc-print-options">
      <button type="button" className="mc-print-option mc-past-option" autoFocus onClick={() => onChoose("group")}>
        <Copy size={20} aria-hidden="true" />
        <span><strong>Само за {groupName}</strong><small>Групата получава свое копие. Другите групи запазват досегашния текст.</small></span>
      </button>
      {/* The card holds two buttons, so the group list can open without choosing this option. */}
      <div className="mc-print-option mc-scope-all">
        <button type="button" className="mc-scope-choice" aria-describedby="mc-scope-groups" onClick={() => onChoose("all")}>
          <Users size={20} aria-hidden="true" />
          <span><strong>За всички групи ({groupCount})</strong><small>Промяната важи за всяка група с този микроцикъл.</small></span>
        </button>
        <ul id="mc-scope-groups" className="mc-scope-groups" aria-label="Групи с този микроцикъл">
          {shown.map((name, index) => <li key={`${index}-${name}`} className="mc-chip mc-chip--saved">{name}</li>)}
        </ul>
        {groupCount > VISIBLE_GROUPS && <button type="button" className="tp-secondary-btn mc-scope-more" aria-expanded={expanded}
          aria-controls="mc-scope-groups" onClick={() => setExpanded(value => !value)}>
          {expanded ? "Покажи по-малко" : `Покажи всички (${groupCount})`}
        </button>}
      </div>
    </div>
    <div className="mc-print-actions">
      <button type="button" className="tp-secondary-btn" onClick={onClose}>Отказ</button>
    </div>
  </dialog>;
}
