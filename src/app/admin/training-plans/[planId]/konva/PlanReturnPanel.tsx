"use client";

import { useEffect, useState } from "react";
import { sectionTitles } from "@/lib/exercise/document";
import { trainingPlanSearch } from "@/lib/exercise/planLocation";
import type { PlanReturn } from "@/lib/exercise/planReturn";
import type { TrainingReference } from "@/lib/exercise/trainingSession";
import TrainingReferencePanel from "../../documents/TrainingReferencePanel";
import { documentRequest } from "../../documents/documentRequest";
import "../../documents/documents.css";

/** Shows the methodist's instructions of the training of the plan, while the coach creates an exercise for the plan. */
export default function PlanReturnPanel({ planReturn, clubId, coachGroupId, compact }: {
  planReturn: PlanReturn & { target: NonNullable<PlanReturn["target"]> }; clubId: string; coachGroupId?: string;
  /** On a phone the instructions start closed, so that the pitch stays near the top. */
  compact: boolean;
}) {
  const [reference, setReference] = useState<TrainingReference>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { target } = planReturn;

  useEffect(() => {
    const controller = new AbortController();
    const params = trainingPlanSearch(clubId, coachGroupId);
    for (const [key, value] of Object.entries(target)) params.set(key, value);
    void documentRequest<TrainingReference>(`/api/admin/clubs/${clubId}/training-plans/microcycles/session?${params}`,
      "Указанията не могат да се заредят.", { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setReference(value); setError(""); } })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [clubId, coachGroupId, target, attempt]);

  return <div className="ke-plan-reference">
    <TrainingReferencePanel reference={reference} error={error} changed={false} defaultOpen={!compact}
      refresh={() => { setError(""); setAttempt(value => value + 1); }}
      note={`Упражнението е за „${sectionTitles[planReturn.section]}“. Когато е готово, натиснете „Запази и добави в план-конспекта“.`} />
  </div>;
}
