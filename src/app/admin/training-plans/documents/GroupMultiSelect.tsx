"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/** A field like a select. It opens a list of checkboxes, so the user can check more than one group. */
export default function GroupMultiSelect({ label, groups, checked, onToggle, locked = [], placeholder = "Изберете групи" }: {
  label: string;
  groups: { key: string; name: string }[];
  checked: string[];
  /** Checked groups that the user cannot uncheck, for example the group of the opened training. */
  locked?: string[];
  onToggle: (key: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const names = groups.filter(group => checked.includes(group.key)).map(group => group.name);

  useEffect(() => {
    if (!open) return;
    // A click or a touch outside the field closes the list.
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return <div ref={root} className="td-field td-multi" onKeyDown={event => {
    if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }} onBlur={event => { if (open && event.relatedTarget && !root.current?.contains(event.relatedTarget)) setOpen(false); }}>
    <span id={`${id}-label`}>{label}</span>
    <button ref={trigger} type="button" className="td-multi-trigger" aria-haspopup="true" aria-expanded={open} aria-controls={`${id}-list`}
      aria-labelledby={`${id}-label ${id}-value`} onClick={() => setOpen(value => !value)}>
      <span id={`${id}-value`} className={names.length ? undefined : "td-multi-placeholder"}>{names.length ? names.join(", ") : placeholder}</span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    {open && <fieldset id={`${id}-list`} className="td-multi-list">
      <legend className="td-sr-only">{label}</legend>
      {groups.map(group => <label key={group.key} className="td-multi-option">
        <input type="checkbox" checked={checked.includes(group.key)} disabled={locked.includes(group.key)} onChange={() => onToggle(group.key)} />
        <span>{group.name}{locked.includes(group.key) && <small> · тази тренировка</small>}</span>
      </label>)}
    </fieldset>}
  </div>;
}
