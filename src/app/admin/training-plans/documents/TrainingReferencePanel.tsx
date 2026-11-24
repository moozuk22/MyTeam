"use client";

import { useId, useState } from "react";
import { ChevronDown, ClipboardList, RefreshCw } from "lucide-react";
import { cycleColumns } from "@/lib/exercise/microcycle";
import type { TrainingReference } from "@/lib/exercise/trainingSession";

/** Short marks for the tiles: "З" for the warm-up, the phase number, and "ФП" for the physical preparation. */
const MARKS = ["З", "1", "2", "3", "ФП"];

/** The instructions of another checked group. `reference` is undefined while it loads or when the group has no training. */
export type GroupReference = { group: string; reference?: TrainingReference; error?: string; missing?: boolean };
type Entry = { groups: string[]; reference?: TrainingReference; error?: string; missing?: boolean; labels: string[] };

const trainingLabel = (reference: TrainingReference) => `Микроцикъл ${reference.microcycle || "—"}, тренировка №${reference.sessionNumber || "—"}`;

/** Puts the groups with the same instructions together. Groups that load or have an error stay separate. */
export function mergeReferences(entries: GroupReference[]): Entry[] {
  const merged: Entry[] = [];
  const byCells = new Map<string, Entry>();
  for (const { group, reference, error, missing } of entries) {
    if (!reference) { merged.push({ groups: [group], error, missing, labels: [] }); continue; }
    const key = JSON.stringify(reference.cells.map(cell => cell.trim()));
    const same = byCells.get(key);
    if (same) { same.groups.push(group); same.labels.push(trainingLabel(reference)); continue; }
    const entry = { groups: [group], reference, labels: [trainingLabel(reference)] };
    byCells.set(key, entry);
    merged.push(entry);
  }
  return merged;
}

function ReferenceList({ reference }: { reference: TrainingReference }) {
  return <ol className="td-reference-list">{cycleColumns.map((label, index) => {
    const text = reference.cells[index]?.trim();
    return <li key={label} className={index === 0 || index === cycleColumns.length - 1 ? "td-reference-item td-reference-item--extra" : "td-reference-item"}>
      <span className="td-reference-mark" aria-hidden="true">{MARKS[index]}</span>
      <div>
        <h3>{label}</h3>
        {text ? <p>{text}</p> : <p className="td-reference-empty">Няма указания</p>}
      </div>
    </li>;
  })}</ol>;
}

function ReferenceSkeleton() {
  return <ol className="td-reference-list" role="status" aria-label="Зареждане" aria-busy="true">
    {cycleColumns.map((label) => <li key={label} className="td-reference-item" aria-hidden="true">
      <span className="td-reference-mark td-skeleton" />
      <div><span className="td-skeleton td-skeleton--meta" /><span className="td-skeleton td-skeleton--title" /></div>
    </li>)}
  </ol>;
}

/** The methodist's instructions for the training from the weekly microcycle. They help the coach to fill in the plan. */
export default function TrainingReferencePanel({ reference, error, refresh, changed, note, group, missing, others = [] }: {
  reference?: TrainingReference; error: string; refresh: () => void; changed: boolean;
  /** Tells the coach that the plan will be linked to another training. */
  note?: string;
  /** The group of `reference`. It is necessary only when other groups are checked. */
  group?: string;
  /** True when the group of `reference` has no chosen training. Only the other groups then have instructions. */
  missing?: boolean;
  /** The instructions of the other checked groups. */
  others?: GroupReference[];
}) {
  const [open, setOpen] = useState(true);
  const body = useId();
  const title = useId();
  const entries = others.length ? mergeReferences([{ group: group ?? "", reference, error: error || undefined, missing }, ...others]) : [];
  const shared = entries.length === 1 && !!entries[0].reference;
  return <section className="td-reference" aria-labelledby={title}>
    <header className="td-reference-header">
      <h2 className="td-reference-title"><button type="button" className="td-reference-toggle" aria-expanded={open} aria-controls={body} onClick={() => setOpen(value => !value)}>
        <span className="td-reference-icon" aria-hidden="true"><ClipboardList size={20} /></span>
        <span className="td-reference-heading">
          <span id={title} className="td-reference-name">Указания от методиста</span>
          {others.length
            ? <span className="td-reference-chips"><span>{shared ? `Общи за ${entries[0].groups.length} групи` : `${entries.length} различни указания`}</span></span>
            : reference
              ? <span className="td-reference-chips">
                  <span>Микроцикъл {reference.microcycle || "—"}</span>
                  <span>Тренировка №{reference.sessionNumber || "—"}</span>
                </span>
              : !error && <span className="td-skeleton td-skeleton--meta" aria-hidden="true" />}
        </span>
        <ChevronDown className="td-reference-chevron" size={20} aria-hidden="true" />
      </button></h2>
      <button type="button" className="tp-icon-btn td-reference-refresh" onClick={refresh}
        aria-label="Обнови указанията" title="Обнови указанията"><RefreshCw size={18} aria-hidden="true" /></button>
    </header>
    <div id={body} className="td-reference-body" hidden={!open}>
      {note && <p role="status" className="td-reference-note">{note}</p>}
      {changed && <p role="status" className="td-reference-changed">Методистът промени указанията. Показани са новите.</p>}
      {others.length > 0 ? entries.map((entry, index) => <section key={`${index}-${entry.groups.join(",")}`} className="td-reference-group">
        <h3 className="td-reference-group-title">
          {shared ? "Еднакви указания за: " : ""}<strong>{entry.groups.join(", ")}</strong>
          {entry.labels.length > 0 && <small>{[...new Set(entry.labels)].join(" · ")}</small>}
        </h3>
        {entry.reference ? <ReferenceList reference={entry.reference} />
          : entry.missing ? <p className="td-reference-empty">Няма избрана тренировка за групата.</p>
          : entry.error ? <div role="alert" className="td-feedback">{entry.error}
              <button type="button" className="tp-secondary-btn" onClick={refresh}>Опитай отново</button></div>
          : <ReferenceSkeleton />}
      </section>) : <>
        {error && <div role="alert" className="td-feedback">{error}
          <button type="button" className="tp-secondary-btn" onClick={refresh}>Опитай отново</button></div>}
        {reference ? <ReferenceList reference={reference} /> : !error && <ReferenceSkeleton />}
      </>}
    </div>
  </section>;
}
