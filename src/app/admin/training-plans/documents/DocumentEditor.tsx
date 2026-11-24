"use client";

import { guardBrowserHistory } from "@/lib/browserHistoryGuard";
import { useBrowserDialogs } from "@/components/admin/BrowserDialogProvider";

import { useTrainingPlanAccess, trainingSubscriptionMessage, trainingSubscriptionInactiveMessage } from "@/lib/exercise/useTrainingPlanAccess";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sessionUrl, sessionOrigin, sessionTarget, type SessionTarget, type TrainingReference } from "@/lib/exercise/trainingSession";
import { formatWeekRange } from "@/lib/exercise/microcycle";
import { groupCycles, resolveTraining, type TrainingOptions } from "@/lib/exercise/trainingOptions";
import { usageLabel, type TrainingUsage } from "@/lib/exercise/trainingUsage";
import TrainingReferencePanel from "./TrainingReferencePanel";
import TrainingCombobox from "./TrainingCombobox";
import BackLink from "../BackLink";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, Eye, FileText, Link2, PenLine } from "lucide-react";
import {
  blankDocument,
  type CompetitionSeason, type DocumentInput, type DrawingSnapshot, type PlanContent, type SavedDocument,
} from "@/lib/exercise/document";
import FinanceSkeleton from "../../members/_components/FinanceSkeleton";
import DocumentFields from "./DocumentFields";
import { requirementsFill } from "./requirementsFill";
import { documentRequest, DocumentRequestError, withCoachImages } from "./documentRequest";
import GroupMultiSelect from "./GroupMultiSelect";

const DocumentSheet = dynamic(() => import("./DocumentSheet"), {
  ssr: false, loading: () => <FinanceSkeleton variant="form" />,
});

type Draft = {
  content: PlanContent; changes: Partial<Record<number, string | null>>; id: string;
  pending: string | null; privateDraft: boolean; saved?: Pick<SavedDocument, "id" | "revision">;
  training?: Training;
};
/** The group and microcycle that the coach chose for "Микроцикъл" and "Тренировка №". */
type Training = {
  /** `chosen` is true when the coach changed the main training. */
  groupKey?: string; cycleId?: string; chosen: boolean;
  /** True when the coach changed the extra groups or their trainings. The main training then stays as it is. */
  extraChosen?: boolean;
  /** More groups. The plan is also linked to the same microcycle number and training number of each group. */
  alsoGroups?: string[];
  /** The microcycle and training that the coach chose for an extra group. Without a choice, the group uses the numbers of the main fields. */
  extra?: Record<string, ExtraTraining>;
};
type ExtraTraining = { microcycle: string; sessionNumber: string; cycleId?: string };
type UsageInfo = { usages?: TrainingUsage[]; usageCount?: number };

const LEAVE_DIALOG = { title: "Незапазени промени", confirmLabel: "Излез" };

/** The plan content without the fields that come from the training. */
function withoutTraining(content: PlanContent) {
  const session: Partial<PlanContent["session"]> = { ...content.session };
  for (const key of ["microcycle", "sessionNumber", "group", "season", "halfSeason"] as const) delete session[key];
  return JSON.stringify({ ...content, session });
}

export default function DocumentEditor({ target, clubId, clubLogoUrl, initial, groupName, competitionSeason, context, endpoint, drawingEndpoint, location, listHref, link = false, replace }: {
  target?: SessionTarget; clubId: string; clubLogoUrl?: string; initial?: SavedDocument; groupName?: string; competitionSeason: CompetitionSeason; context: string; endpoint: string; drawingEndpoint: string; location: string; listHref: string;
  /** The plan is not linked to the training yet. Saving links it. */
  link?: boolean;
  /** The plan that this save replaces in the training. */
  replace?: string;
}) {
  const router = useRouter();
  const coach = new URLSearchParams(location).get("coachGroupId");
  const returnHref = target && sessionUrl("microcycles", location, target);
  const backHref = target && link ? `${sessionUrl("documents", location, target, "choose")}${replace ? `&replace=${replace}` : ""}` : returnHref;
  const storageKey = target && `training-document:${clubId}:${coach}:${sessionOrigin(target)}:${initial?.id ?? "new"}${link ? ":link" : ""}`;
  const [ready, setReady] = useState(!target);
  const [reference, setReference] = useState<{ key: string; value: TrainingReference }>();
  const [referenceError, setReferenceError] = useState<{ key: string; message: string }>();
  const [options, setOptions] = useState<TrainingOptions>();
  const [optionsError, setOptionsError] = useState("");
  // In the library, a plan that one training uses shows the numbers of that training.
  const onlyUsage = !target && initial?.usages?.length === 1 ? initial.usages[0] : undefined;
  const [training, setTraining] = useState<Training>({ groupKey: target?.groupKey ?? onlyUsage?.groupKey, cycleId: target?.cycleId ?? onlyUsage?.cycleId, chosen: false });
  const [usages, setUsageList] = useState<TrainingUsage[]>(initial?.usages ?? []);
  // The server gives at most 100 trainings. `usageCount` is the exact number.
  const [usageCount, setUsageCount] = useState(initial?.usageCount);
  /** Keeps the trainings and their exact number from a server response. */
  const setUsages = (value: UsageInfo) => { if (!value.usages) return; setUsageList(value.usages); setUsageCount(value.usageCount); };
  const usageTotal = Math.max(usageCount ?? 0, usages.length);
  const [referenceChanged, setReferenceChanged] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [storageError, setStorageError] = useState(false);
  const [privateOption, setPrivateOption] = useState(false);
  const [privateDraft, setPrivateDraft] = useState(false);
  // The first save created the plan, but the training was removed. The next saves go to the library only.
  const [detached, setDetached] = useState(false);
  const leaving = useRef(false);
  const pending = useRef<string | null>(null);
  const initialized = useRef(!!initial);
  const lastCells = useRef("");
  const trainingChosen = useRef(false);
  // The plan that a "Запази като нов план-конспект" copy was made from. The copy replaces it in the chosen trainings.
  const forkSource = useRef<string | undefined>(undefined);
  const dialogs = useBrowserDialogs();
  const subscription = useTrainingPlanAccess(clubId);
  const [content, setContent] = useState<PlanContent>(() => {
    const document = initial?.content ?? blankDocument(groupName);
    // The links give the numbers. Older plans can still hold numbers that are no longer correct.
    if (!target && initial?.usages?.length)
      return { ...document, session: { ...document.session, microcycle: onlyUsage?.microcycle ?? "", sessionNumber: onlyUsage?.sessionNumber ?? "" } };
    return initial ? document : { ...document, session: { ...document.session, ...competitionSeason } };
  });
  const [saved, setSaved] = useState<Pick<SavedDocument, "id" | "revision"> | undefined>(initial);
  /** The saved content. A change of only the training numbers adds a training to the plan and does not save the content. */
  const baseline = useRef(initial?.content);
  const proposedId = useRef<string>(initial?.id ?? "");
  const [changes, setChanges] = useState<Partial<Record<number, string | null>>>({});
  const saveChoice = useRef<HTMLDialogElement>(null);
  const [previewing, setPreviewing] = useState(() => Boolean(target && initial && !link));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const draft: Draft = JSON.parse(raw);
        setContent(draft.content); setChanges(draft.changes); setDirty(true);
        proposedId.current = draft.id; pending.current = draft.pending;
        initialized.current = true;
        setPrivateDraft(draft.privateDraft);
        if (draft.saved) setSaved(draft.saved);
        if (draft.training) setTraining(draft.training);
      }
    } catch { setStorageError(true); }
    setReady(true);
  }, [storageKey]);

  const initialGroup = useRef(content.session.group);
  useEffect(() => {
    if (!coach) return;
    const controller = new AbortController();
    void documentRequest<TrainingOptions>(`${drawingEndpoint}/microcycles/options?coachGroupId=${encodeURIComponent(coach)}`,
      "Микроциклите не могат да се заредят.", { signal: controller.signal }, coach)
      .then(value => {
        if (controller.signal.aborted) return;
        setOptions(value);
        // In the library, the plan text gives the group. A coach with one group uses that group.
        setTraining(current => current.groupKey ? current : {
          ...current, groupKey: (value.groups.find(group => group.name === initialGroup.current) ?? (value.groups.length === 1 ? value.groups[0] : undefined))?.key,
        });
      })
      .catch(failure => { if (!controller.signal.aborted) setOptionsError(failure.message); });
    return () => controller.abort();
  }, [coach, drawingEndpoint]);

  const choice = useMemo(() => resolveTraining(options, training.groupKey, content.session.microcycle, content.session.sessionNumber, training.cycleId),
    [options, training.groupKey, training.cycleId, content.session.microcycle, content.session.sessionNumber]);
  const alsoGroups = useMemo(() => training.alsoGroups ?? [], [training.alsoGroups]);
  // Each extra group has its own microcycle and training. A change of the main fields does not change them.
  const extraChoices = useMemo(() => alsoGroups.map(groupKey => {
    const selection: ExtraTraining = training.extra?.[groupKey] ?? { microcycle: "", sessionNumber: "" };
    return { groupKey, selection, choice: resolveTraining(options, groupKey, selection.microcycle, selection.sessionNumber, selection.cycleId) };
  }), [alsoGroups, training.extra, options]);
  const linkedOrigins = new Set(usages.map(usage => sessionOrigin(usage)));
  /** The trainings of the extra groups that do not use the plan in `linked` yet, with a label for messages. */
  const extrasChosen = training.chosen || !!training.extraChosen;
  const extraTargetsFor = (linked: Set<string>) => extrasChosen ? extraChoices.flatMap(({ choice, selection }) => choice.target && !linked.has(sessionOrigin(choice.target))
    ? [{ target: choice.target, label: `тренировка №${selection.sessionNumber.trim()} в микроцикъл ${choice.cycle?.number.trim() ?? selection.microcycle.trim()}` }] : []) : [];
  const extraTargets = extraTargetsFor(linkedOrigins);
  // The save sends all chosen trainings, also those that the loaded list shows as linked. Another tab can have changed
  // them, and the server accepts a link that exists. A new copy has no trainings yet, so it also gets all of them.
  const chosenTargets = extraTargetsFor(new Set());
  const optionGroupName = (key: string) => options?.groups.find(group => group.key === key)?.name ?? "";
  const missingGroups = extrasChosen ? extraChoices.filter(({ choice }) => !choice.target).map(({ groupKey }) => optionGroupName(groupKey)) : [];
  const extraWarning = missingGroups.length
    ? `За ${missingGroups.join(", ")} няма избрана съществуваща тренировка. Там план-конспектът няма да се свърже.`
    : undefined;
  // The plan moves to another training only after the coach changes the fields.
  const movedJson = training.chosen && choice.target && (!target || sessionOrigin(choice.target) !== sessionOrigin(target)) ? JSON.stringify(choice.target) : "";
  const moved = useMemo<SessionTarget | undefined>(() => movedJson ? JSON.parse(movedJson) : undefined, [movedJson]);
  const shownTraining = moved ?? target;
  const targetKey = target ? sessionOrigin(target) : "";
  const referenceKey = shownTraining ? sessionOrigin(shownTraining) : "";
  const currentReference = reference?.key === referenceKey ? reference.value : undefined;
  const currentReferenceError = referenceError?.key === referenceKey ? referenceError.message : "";
  useEffect(() => { trainingChosen.current = training.chosen; }, [training.chosen]);

  useEffect(() => {
    if (!referenceKey) return;
    const onFocus = () => setRefresh(value => value + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [referenceKey]);

  useEffect(() => {
    if (!shownTraining || !ready) return;
    const controller = new AbortController();
    const params = new URLSearchParams(location);
    for (const [key, value] of Object.entries(shownTraining)) params.set(key, value);
    const key = sessionOrigin(shownTraining);
    void documentRequest<TrainingReference>(`${drawingEndpoint}/microcycles/session?${params}`, "Указанията не могат да се заредят.", { signal: controller.signal })
      .then(value => {
        if (controller.signal.aborted) return;
        const cells = `${key}|${JSON.stringify(value.cells)}`;
        // Show the notice only when the instructions of the same training change.
        setReferenceChanged(lastCells.current.startsWith(`${key}|`) && lastCells.current !== cells);
        lastCells.current = cells;
        setReference({ key, value }); setReferenceError(undefined);
        if (!initialized.current) {
          initialized.current = true;
          setContent(current => ({ ...current, session: { ...current.session, group: value.group, season: value.season,
            halfSeason: value.halfSeason, microcycle: value.microcycle, sessionNumber: value.sessionNumber } }));
        } else if (!trainingChosen.current && key === targetKey) {
          // A linked plan does not store the numbers. The opened training gives them, and also the group and season,
          // as in the preview where the coach chose the plan.
          const fields = { group: value.group, season: value.season, halfSeason: value.halfSeason, microcycle: value.microcycle, sessionNumber: value.sessionNumber };
          setContent(current => (Object.keys(fields) as (keyof typeof fields)[]).every(field => current.session[field] === fields[field])
            ? current : { ...current, session: { ...current.session, ...fields } });
        } else if (trainingChosen.current) {
          // The coach chose this training. The printed group and season come from its microcycle.
          setContent(current => current.session.group === value.group && current.session.season === value.season && current.session.halfSeason === value.halfSeason
            ? current : { ...current, session: { ...current.session, group: value.group, season: value.season, halfSeason: value.halfSeason } });
        }
      }).catch(failure => { if (!controller.signal.aborted) setReferenceError({ key, message: failure.message }); });
    return () => controller.abort();
  }, [shownTraining, targetKey, ready, drawingEndpoint, location, refresh]);

  // The instructions of the trainings of the extra groups, by training.
  const [extraReferences, setExtraReferences] = useState<Record<string, { value?: TrainingReference; error?: string }>>({});
  const extraTargetsJson = JSON.stringify(extraChoices.flatMap(({ choice }) => choice.target ? [choice.target] : []));
  useEffect(() => {
    const list: SessionTarget[] = JSON.parse(extraTargetsJson);
    if (!list.length || !ready) return;
    const controller = new AbortController();
    // A coach has a small number of groups, so the number of requests is bounded.
    for (const item of list) {
      const params = new URLSearchParams(location);
      for (const [key, value] of Object.entries(item)) params.set(key, value);
      const key = sessionOrigin(item);
      void documentRequest<TrainingReference>(`${drawingEndpoint}/microcycles/session?${params}`, "Указанията не могат да се заредят.", { signal: controller.signal })
        .then(value => { if (!controller.signal.aborted) setExtraReferences(current => ({ ...current, [key]: { value } })); })
        .catch(failure => { if (!controller.signal.aborted) setExtraReferences(current => ({ ...current, [key]: { error: failure.message } })); });
    }
    return () => controller.abort();
  }, [extraTargetsJson, ready, drawingEndpoint, location, refresh]);

  const storeDraft = useCallback((submitted = pending.current, independent = privateDraft) => {
    if (!storageKey || leaving.current) return;
    try {
      const draft: Draft = { content, changes, saved, id: proposedId.current, pending: submitted,
        privateDraft: independent, training };
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch { setStorageError(true); }
  }, [storageKey, content, changes, saved, privateDraft, training]);
  useEffect(() => {
    if (dirty && ready) storeDraft();
  }, [dirty, ready, storeDraft]);

  function returnToCycle(href = returnHref) {
    if (!href) return;
    leaving.current = true;
    try { if (storageKey) sessionStorage.removeItem(storageKey); } catch { /* Storage can be disabled. */ }
    navigationBlocked.current = false;
    router.replace(href, { scroll: false });
  }

  const visibleContent = useMemo(() => withCoachImages(content, coach), [content, coach]);
  const blocked = dirty || saving;
  const navigationBlocked = useRef(blocked);
  useEffect(() => { navigationBlocked.current = blocked; }, [blocked]);
  useEffect(() => guardBrowserHistory(
    window,
    () => dialogs.confirm("Имате незапазени промени. Да излезете ли?", LEAVE_DIALOG),
    () => navigationBlocked.current,
  ), [dialogs]);

  useEffect(() => {
    if (!blocked) return;
    function onUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = true;
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [blocked]);

  function edit(updater: (content: PlanContent) => PlanContent) {
    setContent(updater);
    setDirty(true);
    setNotice("");
  }

  function updateSection(index: number, patch: Partial<PlanContent["sections"][number]>) {
    edit((current) => ({
      ...current,
      sections: current.sections.map((section, slot) => slot === index ? { ...section, ...patch } : section),
    }));
  }

  async function attach(index: number, drawing: DrawingSnapshot | null, requirements = "") {
    setChanges((previous) => ({ ...previous, [index]: drawing?.sourceId ?? null }));
    updateSection(index, { drawing });
    const fill = drawing ? requirementsFill(content.sections[index].coaching, requirements) : "skip";
    if (fill === "skip") return;
    if (fill === "ask" && !await dialogs.confirm("Полето „Изисквания“ вече има текст. Да го заменим ли с изискванията от упражнението?", {
      title: "Замяна на изискванията", confirmLabel: "Замени",
    })) return;
    updateSection(index, { coaching: requirements.trim() });
  }

  const trainingWarning = choice.microcycleWarning ?? choice.sessionWarning ?? extraWarning;
  /** Warns about a microcycle or training that does not exist. The coach can still save. */
  async function confirmTraining() {
    if (!trainingWarning) return true;
    const outcome = target ? "План-конспектът ще остане към тренировката, от която е отворен." : "План-конспектът няма да се свърже с тренировка.";
    return dialogs.confirm(`${trainingWarning} ${outcome}`, { title: "Проверете тренировката", confirmLabel: "Запази" });
  }

  function chooseTraining(patch: Partial<Training>, session?: Partial<PlanContent["session"]>) {
    setTraining(current => ({ ...current, ...patch, chosen: true }));
    edit(current => session ? { ...current, session: { ...current.session, ...session } } : current);
  }

  /** True when the coach changed only the training. The save then adds the training to the plan, without a copy. */
  const numbersOnly = !!saved && (!!moved || extraTargets.length > 0) && !pending.current && !Object.keys(changes).length && !!baseline.current &&
    withoutTraining(content) === withoutTraining(baseline.current);
  const chosenName = `тренировка №${content.session.sessionNumber.trim()} в микроцикъл ${choice.cycle?.number.trim() ?? content.session.microcycle.trim()}`;

  /** Asks if the plan replaces the plan that the chosen training uses. Gives the ID of that plan, or undefined. */
  async function confirmReplace(failure: unknown) {
    if (!moved || !(failure instanceof DocumentRequestError) || failure.status !== 409 || !failure.replaceDocumentId) return undefined;
    return await dialogs.confirm(`За ${chosenName} вече има друг план-конспект. Да го замените ли с този? Другият план-конспект остава в библиотеката.`,
      { title: "Тренировката има план-конспект", confirmLabel: "Замени" }) ? failure.replaceDocumentId : undefined;
  }

  /**
   * Links the plan to the trainings of the extra groups, one after the other. A training with another plan asks first.
   * It gives the latest usages and the names of the groups that did not get the plan.
   */
  async function linkGroups(documentId: string, targets: { target: SessionTarget; label: string }[], replaceable = forkSource.current) {
    let latest: UsageInfo | undefined;
    const failed: string[] = [];
    for (const { target: to, label } of targets) {
      const send = (replaceDocumentId?: string) => documentRequest<UsageInfo>(endpoint, "Тренировката не може да се добави.", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: to, linkDocumentId: documentId, ...(replaceDocumentId && { replaceDocumentId }) }),
      }, coach);
      try {
        try {
          latest = await send();
        } catch (failure) {
          // A copy replaces the plan that it was made from without a question. The coach chose the copy for these groups.
          if (!(failure instanceof DocumentRequestError) || failure.status !== 409 || !failure.replaceDocumentId ||
              (failure.replaceDocumentId !== replaceable && !await dialogs.confirm(`За ${label} на ${optionGroupName(to.groupKey)} вече има друг план-конспект. Да го замените ли с този? Другият план-конспект остава в библиотеката.`,
                { title: "Тренировката има план-конспект", confirmLabel: "Замени" }))) throw failure;
          latest = await send(failure.replaceDocumentId);
        }
      } catch { failed.push(optionGroupName(to.groupKey)); }
    }
    return { latest, failed };
  }
  const notLinked = (failed: string[]) => `План-конспектът не е добавен за ${failed.join(", ")}. Натиснете „Запази“, за да опитате отново.`;
  /** After a failed link, the chosen trainings stay pending, so "Запази" tries only the links again. */
  function keepPendingLinks(failed: string[]) {
    setTraining(current => ({ ...current, extraChosen: true }));
    setDirty(true);
    setError(notLinked(failed));
  }

  /** Links the saved plan to a training without saving its content. "replaceDocumentId" is the plan that the coach chose to replace. */
  async function addTraining(to: SessionTarget | undefined, replaceDocumentId?: string) {
    if (!saved || saving || leaving.current) return;
    setSaving(true);
    setError("");
    setNotice("");
    const send = (replaceDocumentId?: string) => documentRequest<{ id: string } & UsageInfo>(endpoint, "Тренировката не може да се добави.", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ target: to, linkDocumentId: saved.id, ...(replaceDocumentId && { replaceDocumentId }) }),
    }, coach);
    try {
      let result: UsageInfo = {};
      // The server confirms the link also when the training already uses the plan, so the loaded list cannot hide a change of another tab.
      if (to) try {
        result = await send(replaceDocumentId);
      } catch (failure) {
        const other = await confirmReplace(failure);
        if (!other) throw failure;
        result = await send(other);
      }
      const extra = await linkGroups(saved.id, chosenTargets);
      if (target && !extra.failed.length) { returnToCycle(sessionUrl("microcycles", location, to ?? target)); return; }
      const latest = extra.latest ?? result;
      if (latest.usages) setUsages(latest);
      if (extra.failed.length) { keepPendingLinks(extra.failed); return; }
      setTraining(current => ({ ...current, chosen: false, extraChosen: false }));
      setDirty(false);
      setNotice(`План-конспектът е добавен към ${chosenName}${chosenTargets.length ? ` за ${chosenTargets.length + (to ? 1 : 0)} групи` : ""}.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Тренировката не може да се добави.");
    } finally {
      if (!leaving.current) setSaving(false);
    }
  }

  const groups = options?.groups ?? [];
  /** The suggestions for "Микроцикъл" of a group. */
  const cycleOptions = (groupKey: string | undefined) => groupCycles(options, groupKey).filter(cycle => cycle.number.trim())
    .map(cycle => ({ key: cycle.id, value: cycle.number.trim(), label: `Микроцикъл ${cycle.number.trim()}`, hint: formatWeekRange(cycle.week) }));
  const rowOptions = (cycle?: { rows: string[] }) => cycle?.rows.map((rowId, index) => ({ key: rowId, value: String(index + 1), label: `Тренировка ${index + 1}` })) ?? [];

  /** "Микроцикъл" and "Тренировка №" of one group. With more groups checked, each group has a box with its name. */
  function trainingFields({ name, microcycle, sessionNumber, found, cycles, microcycleEmpty, onMicrocycle, onSession }: {
    name?: string; microcycle: string; sessionNumber: string; found: ReturnType<typeof resolveTraining>;
    cycles: ReturnType<typeof cycleOptions>; microcycleEmpty: string;
    onMicrocycle: (value: string, cycleId?: string) => void; onSession: (value: string) => void;
  }) {
    const suffix = name ? ` – ${name}` : "";
    const fields = <>
      <TrainingCombobox label={`Микроцикъл${suffix}`} max={40} value={microcycle} options={cycles} warning={found.microcycleWarning}
        empty={microcycleEmpty} onChange={(value) => onMicrocycle(value)} onPick={(option) => onMicrocycle(option.value, option.key)} />
      <TrainingCombobox label={`Тренировка №${suffix}`} max={40} value={sessionNumber} options={rowOptions(found.cycle)}
        warning={found.sessionWarning} empty={found.cycle ? "Няма тренировки в микроцикъла." : "Първо въведете микроцикъл."}
        onChange={onSession} onPick={(option) => onSession(option.value)} />
    </>;
    return name ? <fieldset className="td-field-wide td-extra-training"><legend>{name}</legend>{fields}</fieldset> : fields;
  }

  function sessionSlot(key: keyof PlanContent["session"]) {
    if (!coach || (key !== "microcycle" && key !== "sessionNumber")) return undefined;
    // Both fields render in the "Микроцикъл" slot, so the boxes of the groups stay together.
    if (key === "sessionNumber") return null;
    // Typed numbers do not choose a training, so the fields stay closed until the trainings of the coach load.
    if (!options && !optionsError) return <>{["Микроцикъл", "Тренировка №"].map(label =>
      <div key={label} className="td-field" role="status" aria-label="Зареждане" aria-busy="true">
        <span className="td-field-label">{label}</span>
        <span className="td-skeleton td-skeleton--field" aria-hidden="true" />
      </div>)}</>;
    const boxes = alsoGroups.length > 0;
    return <>
      {groups.length > 1 && <div className={`td-training-groups${boxes ? " td-field-wide" : ""}`}>
        <GroupMultiSelect label="Групи" groups={groups} checked={[training.groupKey ?? "", ...alsoGroups]} onToggle={toggleGroup}
          locked={target ? [target.groupKey] : []} />
        {extraWarning && <small className="td-training-groups-warning">{extraWarning}</small>}
      </div>}
      {trainingFields({
        name: boxes ? optionGroupName(training.groupKey ?? "") : undefined,
        microcycle: content.session.microcycle, sessionNumber: content.session.sessionNumber, found: choice, cycles: cycleOptions(training.groupKey),
        microcycleEmpty: optionsError || (training.groupKey ? "Няма микроцикли за групата." : groups.length ? "Първо изберете група." : "Няма групи за треньора."),
        onMicrocycle: (value, cycleId) => chooseTraining(cycleId ? { cycleId } : {}, { microcycle: value }),
        onSession: (value) => chooseTraining({}, { sessionNumber: value }),
      })}
      {extraChoices.map(({ groupKey, selection, choice: extra }) => <Fragment key={groupKey}>{trainingFields({
        name: optionGroupName(groupKey), microcycle: selection.microcycle, sessionNumber: selection.sessionNumber, found: extra,
        cycles: cycleOptions(groupKey), microcycleEmpty: "Няма микроцикли за групата.",
        onMicrocycle: (value, cycleId) => chooseExtra(groupKey, selection, { microcycle: value, cycleId }),
        onSession: (value) => chooseExtra(groupKey, selection, { sessionNumber: value }),
      })}</Fragment>)}
    </>;
  }

  /** Saves the microcycle or training that the coach chose for an extra group. */
  function chooseExtra(groupKey: string, current: ExtraTraining, patch: Partial<ExtraTraining>) {
    chooseExtras({ extra: { ...training.extra, [groupKey]: { ...current, ...patch } } });
  }

  /** A change of the extra groups only. The main training stays as it is, so the save does not move the plan. */
  function chooseExtras(patch: Partial<Training>) {
    setTraining(current => ({ ...current, ...patch, extraChosen: true }));
    setDirty(true);
    setNotice("");
  }

  /**
   * The main group stays the main group while it is checked. From a training, its group cannot be unchecked.
   * A newly checked group starts with a copy of the main numbers. After that, each group keeps its own microcycle and training.
   */
  function toggleGroup(key: string) {
    if (target && key === target.groupKey) return;
    if (!training.groupKey) { chooseTraining({ groupKey: key, cycleId: undefined }); return; }
    if (key === training.groupKey) {
      // The next checked group becomes the main group, with its own microcycle and training.
      const [next, ...rest] = alsoGroups;
      if (!next) { chooseTraining({ groupKey: undefined, cycleId: undefined }); return; }
      const selection = training.extra?.[next] ?? { microcycle: "", sessionNumber: "" };
      chooseTraining({ groupKey: next, alsoGroups: rest, cycleId: selection.cycleId },
        { microcycle: selection.microcycle, sessionNumber: selection.sessionNumber });
      return;
    }
    if (alsoGroups.includes(key)) { chooseExtras({ alsoGroups: alsoGroups.filter(value => value !== key) }); return; }
    chooseExtras({
      alsoGroups: groups.map(group => group.key).filter(value => value === key || alsoGroups.includes(value)),
      extra: { ...training.extra, [key]: { microcycle: content.session.microcycle, sessionNumber: content.session.sessionNumber } },
    });
  }

  async function save(independent = privateDraft, fork = false) {
    if (!subscription.access?.canSave) { setError(trainingSubscriptionMessage); return; }
    if (saving || leaving.current) return;
    if (!content.session.title.trim()) {
      setError("Въведете заглавие на план-конспекта.");
      setPreviewing(false);
      requestAnimationFrame(() => document.getElementById("td-plan-title")?.focus());
      return;
    }
    const input: DocumentInput = {
      ...content,
      sections: content.sections.map(({ drawing, ...section }, index) => ({
        ...section, drawing: Object.hasOwn(changes, index) ? changes[index]! : drawing ? "keep" : null,
      })),
    };
    setSaving(true);
    setPrivateOption(false);
    setError("");
    setNotice("");
    try {
      proposedId.current ||= crypto.randomUUID();
      const creating = !saved || fork || !!pending.current;
      // A retry of an unconfirmed save keeps the source of its copy.
      if (!pending.current) forkSource.current = fork ? saved?.id : undefined;
      // The links go to the plan that this save gives. A copy has no links yet.
      const targets = independent ? [] : chosenTargets;
      // A plan that the coach moved to another training is linked to that training. The opened training keeps its plan.
      const linkTo = independent ? undefined : moved;
      const into = detached ? undefined : target;
      const payload = JSON.stringify({ id: fork ? crypto.randomUUID() : proposedId.current, revision: saved?.revision, content: input,
        ...(saved && linkTo && { target: linkTo, link: true }),
        ...(into && saved && !linkTo && { target: into, ...(link && { link: true, ...(replace && { replaceDocumentId: replace }) }) }),
        ...(fork && { forkFrom: saved?.id, sourceRevision: saved?.revision }),
        ...(!saved && linkTo && { target: linkTo }),
        ...(into && !saved && !linkTo && (independent ? { privateCoachDraft: true } : { target: into, ...(replace && { replaceDocumentId: replace }) })) });
      const submitted = into && creating ? pending.current ?? payload : payload;
      if (into && creating) {
        pending.current = submitted;
        setPrivateDraft(independent);
        storeDraft(submitted, independent);
      }
      const send = (body: string) => documentRequest<{ document: SavedDocument; alreadyCreated?: boolean }>(
        creating ? endpoint : `${endpoint}/${saved!.id}`, "План-конспектът не може да се запази.", {
          method: creating ? "POST" : "PUT",
          headers: { "content-type": "application/json" },
          body,
        }, coach,
      );
      let body = submitted;
      let result;
      try {
        result = await send(body);
      } catch (failure) {
        // The chosen training has another plan. The coach can replace it.
        const other = linkTo && await confirmReplace(failure);
        if (!other) throw failure;
        body = JSON.stringify({ ...JSON.parse(body), replaceDocumentId: other });
        if (into && creating) { pending.current = body; storeDraft(body, independent); }
        result = await send(body);
      }
      setSaved(result.document);
      if (result.document.usages) setUsages(result.document);
      pending.current = null;
      if (into) {
        if (submitted === payload || (initial && JSON.stringify(JSON.parse(submitted).content) === JSON.stringify(input))) {
          const linked = sessionTarget(JSON.parse(body).target);
          // The checked extra groups use the same plan. A failed link keeps the editor open with an error.
          const extra = await linkGroups(result.document.id, targets);
          if (extra.failed.length) {
            setSaved(result.document);
            if (extra.latest) setUsages(extra.latest);
            baseline.current = result.document.content;
            setChanges({});
            keepPendingLinks(extra.failed);
            return;
          }
          returnToCycle(linked ? sessionUrl("microcycles", location, linked) : undefined);
          return;
        }
        setSaved({ ...result.document, revision: 1 });
        setNotice("Предишният запис е потвърден. Запазете текущите промени.");
        setDirty(true);
        return;
      }
      if (!saved) window.history.replaceState(null, "", `${listHref}&document=${result.document.id}`);
      if (result.alreadyCreated) {
        setNotice("План-конспектът вече е създаден. Запазете отново, за да приложите текущите промени.");
      } else {
        baseline.current = result.document.content;
        // A linked plan does not store the numbers. The editor keeps showing the numbers of the training.
        setContent({ ...result.document.content, session: { ...result.document.content.session,
          microcycle: content.session.microcycle, sessionNumber: content.session.sessionNumber } });
        // The extra groups get the plan also when the main group has no chosen training.
        const extra = await linkGroups(result.document.id, targets);
        if (extra.latest) setUsages(extra.latest);
        setChanges({});
        if (extra.failed.length) { keepPendingLinks(extra.failed); return; }
        if (linkTo || targets.length) setTraining(current => ({ ...current, chosen: false, extraChosen: false }));
        setDirty(false);
        setNotice("План-конспектът е запазен.");
        // The draft of the removed training is no longer necessary.
        if (detached && storageKey) try { sessionStorage.removeItem(storageKey); } catch { /* Storage can be disabled. */ }
      }
    } catch (failure) {
      if (failure instanceof DocumentRequestError && [400, 403, 404, 409, 410].includes(failure.status)) {
        pending.current = null;
        if (target) storeDraft(null, independent);
        setPrivateOption(failure.recovery === "private");
        if (failure.recovery === "saved" && failure.documentId === proposedId.current) {
          // The first save committed before the training was removed. Keep the first
          // revision so a later library edit still triggers the normal revision check.
          setSaved({ id: proposedId.current, revision: 1 });
          setDetached(true);
          setDirty(true);
          setNotice("План-конспектът вече е в библиотеката. Можете да запазите текущите промени там.");
        }
      }
      setError(target && pending.current
        ? "Няма потвърждение за записа. Натиснете „Запази“ отново. Черновата е запазена в редактора."
        : failure instanceof Error ? failure.message : "План-конспектът не може да се запази.");
    } finally {
      if (!leaving.current) setSaving(false);
    }
  }

  // The coach chose this plan from the list for the training and did not change it. The save only links it.
  const applying = Boolean(target && link && saved && !moved && !dirty && !pending.current);
  const useOnly = applying || numbersOnly;
  // The trainings other than the one that the save is for. A save over the plan changes them too.
  // The count uses the exact number. The training of this save is not in it when the examples show it.
  const otherUsages = usageTotal - (shownTraining && usages.some(usage => sessionOrigin(usage) === sessionOrigin(shownTraining)) ? 1 : 0);

  return <>
    <header className="tp-header td-editor-header">
      {backHref ? <button type="button" className="tp-back-btn" disabled={saving} onClick={async () => {
        if (!dirty || await dialogs.confirm("Да излезете ли без запазване на промените?", LEAVE_DIALOG)) returnToCycle(backHref);
      }}><ArrowLeft size={16} aria-hidden="true" /> {link ? "Към списъка" : "Към тренировката"}</button> : <BackLink href={listHref} className="tp-back-btn" beforeBack={async () => {
        if (saving) return false;
        if (dirty && !await dialogs.confirm("Имате незапазени промени. Да излезете ли?", LEAVE_DIALOG)) return false;
        navigationBlocked.current = false;
        return true;
      }}><ArrowLeft size={16} aria-hidden="true" /> Към план-конспектите</BackLink>}
      <div className="tp-heading">
        <h1 className="tp-title"><FileText aria-hidden="true" />{saved ? "Редакция на план-конспект" : "Нов план-конспект"}</h1>
        <p>{target && currentReference?.group ? `${context} · ${currentReference.group}` : context}</p>
      </div>
      <div className="td-actions td-header-actions">
        <div className="td-view-switch" role="group" aria-label="Изглед">
          <button type="button" aria-pressed={!previewing} onClick={() => setPreviewing(false)}>
            <PenLine size={16} aria-hidden="true" />Редакция
          </button>
          <button type="button" aria-pressed={previewing} onClick={() => setPreviewing(true)}>
            <Eye size={16} aria-hidden="true" />Преглед за печат
          </button>
        </div>
        <button type="button" className="tp-primary-btn" onClick={async () => {
          if (!await confirmTraining()) return;
          if (applying) void addTraining(target!, replace);
          // From a training chosen in the list, the training itself also needs the link.
          else if (numbersOnly) void addTraining(moved ?? (target && link ? target : undefined), !moved && link ? replace : undefined);
          else if (target && !detached && saved && !pending.current) saveChoice.current?.showModal(); else void save();
        }} disabled={saving || !ready || (!!target && !initialized.current) || (!!subscription.access?.canSave && !!saved && !dirty && !link)}>
          {link && useOnly && <Check size={16} aria-hidden="true" />}
          {saving ? (useOnly ? "Добавяне…" : "Записване…") : link ? (useOnly ? "Използвай този план-конспект" : "Запази и използвай") : "Запази"}
        </button>
      </div>
    </header>
    {(subscription.error || subscription.access && !subscription.access.canSave) && <div role="status" className="td-feedback tp-subscription-notice">{subscription.error || trainingSubscriptionInactiveMessage}{subscription.error && <button type="button" onClick={() => void subscription.refresh().catch(() => {})}>Опитай отново</button>}</div>}
    <dialog ref={saveChoice} className="tp-modal td-save-choice" aria-labelledby="td-save-choice-title" aria-describedby="td-save-choice-description">
      <div className="tp-modal-header">
        <h2 id="td-save-choice-title">Запазване на промените</h2>
      </div>
      <div id="td-save-choice-description">
        {(link || moved) && <p>План-конспектът ще се използва за <strong>{usageLabel(content.session)}</strong>.</p>}
        <p>{otherUsages
          ? <>„Запази върху съществуващия“ променя плана и в още {otherUsages === 1 ? "1 тренировка" : `${otherUsages} тренировки`}, които го използват.</>
          : "Планът не се използва в други тренировки."}</p>
        <p>„Запази като нов план-конспект“ създава копие само за тази тренировка{chosenTargets.length ? ` и за ${chosenTargets.map(item => optionGroupName(item.target.groupKey)).join(", ")}` : ""}.</p>
        {extraTargets.length > 0 && <p>План-конспектът ще се използва и за: <strong>{extraTargets.map(item => `${optionGroupName(item.target.groupKey)} (${item.label})`).join(", ")}</strong>.</p>}
      </div>
      <div className="tp-modal-actions td-save-choice-actions">
        <button type="button" className="tp-primary-btn" onClick={() => { saveChoice.current?.close(); void save(false); }}>Запази върху съществуващия</button>
        <button type="button" className="tp-secondary-btn" onClick={() => { saveChoice.current?.close(); void save(false, true); }}>Запази като нов план-конспект</button>
        <button type="button" className="tp-secondary-btn" autoFocus onClick={() => saveChoice.current?.close()}>Отказ</button>
      </div>
    </dialog>
    {storageError && <p role="alert" className="td-feedback">Черновата е само в този раздел. Оставете го отворен до запазването.</p>}
    {/* The extra groups show their instructions also when the main group has no training. */}
    {(shownTraining || extraChoices.some(({ choice: extra }) => extra.target)) && !previewing && <TrainingReferencePanel
      reference={currentReference} error={currentReferenceError} missing={!shownTraining}
      group={optionGroupName(shownTraining?.groupKey ?? training.groupKey ?? "")}
      others={extraChoices.map(({ groupKey, choice: extra }) => {
        const loaded = extra.target ? extraReferences[sessionOrigin(extra.target)] : undefined;
        return { group: optionGroupName(groupKey), reference: loaded?.value, error: loaded?.error, missing: !extra.target };
      })}
      changed={referenceChanged} refresh={() => setRefresh(value => value + 1)}
      note={moved ? `${target ? "Тренировката е сменена. " : ""}${numbersOnly
        ? `При запазване тази тренировка ще използва същия план-конспект, без копие.${target ? " Предишната тренировка го запазва." : ""}`
        : "При запазване план-конспектът ще се свърже с тази тренировка."}` : undefined} />}
    {privateOption && <button type="button" className="tp-secondary-btn" disabled={saving} onClick={() => void save(true)}>Запази отделно в библиотеката</button>}
    {error && <div role="alert" className="td-feedback">{error}</div>}
    {notice && <div role="status" className="td-notice">{notice}</div>}
    {!target && !previewing && !!usages.length && <section className="td-usages" aria-labelledby="td-usages-title">
      <h2 id="td-usages-title"><Link2 size={16} aria-hidden="true" />Използва се в {usageTotal === 1 ? "1 тренировка" : `${usageTotal} тренировки`}</h2>
      <ul>{usages.map(usage => <li key={`${usage.cycleId}/${usage.groupKey}/${usage.rowId}`}>
        <span>{usageLabel(usage)}</span><small>{[usage.group, formatWeekRange(usage.week)].filter(Boolean).join(" · ")}</small>
      </li>)}</ul>
    </section>}
    <div className="td-workspace">
      {target && !initialized.current ? (!currentReferenceError && <FinanceSkeleton variant="form" />) : previewing
        ? <DocumentSheet content={visibleContent} clubLogoUrl={clubLogoUrl} pending={saving} canPrint={!!subscription.access?.canPrint} checkPrint={async () => (await subscription.refresh()).canPrint} />
        : <DocumentFields content={visibleContent} disabled={saving || !ready || (!!target && !initialized.current)} drawingEndpoint={drawingEndpoint} location={location} sessionSlot={sessionSlot}
            onSession={(key, value) => edit(current => ({ ...current, session: { ...current.session, [key]: value } }))}
            onSection={updateSection} onDrawing={attach} onMerge={(merge) => edit((current) => ({ ...current, merge }))} />}
    </div>
  </>;
}
