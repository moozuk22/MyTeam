"use client";

import { cycleColumns } from "@/lib/exercise/microcycle";
import type { TrainingReference } from "@/lib/exercise/trainingSession";
import FinanceSkeleton from "../../members/_components/FinanceSkeleton";

export default function TrainingReferencePanel({ reference, error, refresh, changed, note }: {
  reference?: TrainingReference; error: string; refresh: () => void; changed: boolean;
  /** Tells the coach that the plan will be linked to another training. */
  note?: string;
}) {
  return <details className="td-reference" open>
    <summary>Указания от методиста{reference && <span className="td-reference-training"> · Микроцикъл {reference.microcycle || "—"}, тренировка №{reference.sessionNumber}</span>}</summary>
    {note && <p role="status" className="td-reference-note">{note}</p>}
    {changed && <p role="status">Указанията са обновени.</p>}
    {error && <p role="alert">{error}</p>}
    {reference ? <dl>{cycleColumns.map((label, index) => <div key={label}>
      <dt>{label}</dt><dd>{reference.cells[index]}</dd>
    </div>)}</dl> : !error && <FinanceSkeleton variant="form" />}
    <button type="button" className="tp-secondary-btn" onClick={refresh}>Обнови указанията</button>
  </details>;
}
