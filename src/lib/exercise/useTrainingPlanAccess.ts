"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TrainingPlanAccess } from "@/lib/trainingPlanSubscriptionDomain";

export const trainingSubscriptionInactiveMessage = "Плановете за тренировки не са активирани. Можете да рисувате и да редактирате формулярите. За запазване и печат е необходим активен абонамент. Свържете се с администратора за активиране.";

export const trainingSubscriptionMessage = "Не можете да запазвате или печатате, защото нямате активен абонамент за планове за тренировки.";
export function useTrainingPlanAccess(clubId: string) {
  const latest = useRef(0);
  const [access, setAccess] = useState<TrainingPlanAccess | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++latest.current;
    try {
      const response = await fetch(`/api/admin/clubs/${clubId}/training-plans/access`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("Достъпът до абонамента не може да се провери.");
      const value: TrainingPlanAccess = await response.json();
      if (!signal?.aborted && requestId === latest.current) { setAccess(value); setError(""); }
      return value;
    } catch (failure) {
      if (!signal?.aborted && requestId === latest.current) { setAccess(null); setError("Достъпът до абонамента не може да се провери."); }
      throw failure;
    }
  }, [clubId]);
  useEffect(() => {
    if (!clubId) return;
    const abort = new AbortController();
    const reload = () => { void refresh(abort.signal).catch(() => {}); };
    reload();
    window.addEventListener("focus", reload);
    return () => { abort.abort(); window.removeEventListener("focus", reload); };
  }, [clubId, refresh]);
  return { access, error, refresh };
}
