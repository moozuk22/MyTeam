"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";

export type ComboOption = { key: string; value: string; label: string; hint?: string };

/** A text field with suggestions. The coach can pick a suggestion or type a value that is not in the list. */
export default function TrainingCombobox({ label, value, max, options, warning, empty, onChange, onPick }: {
  label: string; value: string; max: number; options: ComboOption[]; warning?: string;
  /** Text in the list when there are no suggestions. */
  empty: string;
  onChange: (value: string) => void; onPick: (option: ComboOption) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const warningId = `${id}-warning`;
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState(false);
  const [active, setActive] = useState(-1);
  const text = value.trim();
  const visible = filter && text ? options.filter(option => option.value.startsWith(text)) : options;
  const shown = visible.length ? visible : options;

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  function show(filtered: boolean) {
    setFilter(filtered);
    setOpen(true);
    setActive(-1);
  }

  function pick(option: ComboOption) {
    onPick(option);
    setOpen(false);
    input.current?.focus();
  }

  return <div className="td-field td-combo" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id}>{label}</label>
    <div className="td-combo-control">
      <input ref={input} id={id} type="text" inputMode="numeric" autoComplete="off" maxLength={max} value={value}
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={warning ? true : undefined} aria-describedby={warning ? warningId : undefined}
        onClick={() => { if (!open) show(false); }}
        onChange={(event) => { onChange(event.target.value); show(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); return; }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) { show(false); return; }
            if (!shown.length) return;
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive(current => (current + step + shown.length) % shown.length);
          } else if (event.key === "Enter" && open && shown[active]) {
            event.preventDefault();
            pick(shown[active]);
          }
        }} />
      <button type="button" className="td-combo-toggle" tabIndex={-1} aria-label={`Покажи ${label.toLocaleLowerCase("bg")}`}
        aria-controls={listId} aria-expanded={open}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => { if (open) setOpen(false); else { show(false); input.current?.focus(); } }}>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <ul id={listId} role="listbox" aria-label={label} className="td-combo-options" hidden={!open}>
        {shown.length
          ? shown.map((option, index) => <li key={option.key} id={`${listId}-${index}`} role="option" aria-selected={index === active}
              className={option.value === text ? "td-combo-option td-combo-option--current" : "td-combo-option"}
              onPointerDown={(event) => event.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => pick(option)}>
              <span>{option.label}</span>{option.hint && <small>{option.hint}</small>}
            </li>)
          : <li className="td-combo-empty" role="presentation">{empty}</li>}
      </ul>
    </div>
    {warning && <p id={warningId} className="td-field-warning" role="status"><TriangleAlert size={16} aria-hidden="true" />{warning}</p>}
  </div>;
}
