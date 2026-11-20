"use client";

import { guardBrowserHistory } from "@/lib/browserHistoryGuard";
import { useBrowserDialogs } from "@/components/admin/BrowserDialogProvider";

import { useTrainingPlanAccess, trainingSubscriptionMessage, trainingSubscriptionInactiveMessage } from "@/lib/exercise/useTrainingPlanAccess";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sessionUrl, sessionOrigin, sessionTarget, type SessionTarget, type TrainingReference } from "@/lib/exercise/trainingSession";
import { formatWeekRange } from "@/lib/exercise/microcycle";
import { groupCycles, resolveTraining, type TrainingOptions } from "@/lib/exercise/trainingOptions";
import TrainingReferencePanel from "./TrainingReferencePanel";
import TrainingCombobox from "./TrainingCombobox";
import BackLink from "../BackLink";
import dynamic from "next/dynamic";
import { ArrowLeft, Eye, FileText, PenLine } from "lucide-react";
import {
  blankDocument,
  type CompetitionSeason, type DocumentInput, type DrawingSnapshot, type PlanContent, type SavedDocument,
} from "@/lib/exercise/document";
import FinanceSkeleton from "../../members/_components/FinanceSkeleton";
import DocumentFields from "./DocumentFields";
import { documentRequest, DocumentRequestError, withCoachImages } from "./documentRequest";

const DocumentSheet = dynamic(() => import("./DocumentSheet"), {
  ssr: false, loading: () => <FinanceSkeleton variant="form" />,
});

type Draft = {
  content: PlanContent; changes: Partial<Record<number, string | null>>; id: string;
  pending: string | null; numberEdited: boolean; privateDraft: boolean; saved?: Pick<SavedDocument, "id" | "revision">;
  training?: Training;
};
/** The group and microcycle that the coach chose for "Микроцикъл" and "Тренировка №". */
type Training = { groupKey?: string; cycleId?: string; chosen: boolean };

const LEAVE_DIALOG = { title: "Незапазени промени", confirmLabel: "Излез" };

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
  const [training, setTraining] = useState<Training>({ groupKey: target?.groupKey, cycleId: target?.cycleId, chosen: false });
  const [referenceChanged, setReferenceChanged] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [storageError, setStorageError] = useState(false);
  const [privateOption, setPrivateOption] = useState(false);
  const [privateDraft, setPrivateDraft] = useState(false);
  const leaving = useRef(false);
  const pending = useRef<string | null>(null);
  const numberEdited = useRef(false);
  const initialized = useRef(!!initial);
  const lastCells = useRef("");
  const trainingChosen = useRef(false);
  const dialogs = useBrowserDialogs();
  const subscription = useTrainingPlanAccess(clubId);
  const [content, setContent] = useState<PlanContent>(() => {
    const document = initial?.content ?? blankDocument(groupName);
    return initial ? document : { ...document, session: { ...document.session, ...competitionSeason } };
  });
  const [saved, setSaved] = useState<Pick<SavedDocument, "id" | "revision"> | undefined>(initial);
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
        numberEdited.current = draft.numberEdited; initialized.current = true;
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
  // The plan moves to another training only after the coach changes the fields.
  const movedJson = training.chosen && choice.target && (!target || sessionOrigin(choice.target) !== sessionOrigin(target)) ? JSON.stringify(choice.target) : "";
  const moved = useMemo<SessionTarget | undefined>(() => movedJson ? JSON.parse(movedJson) : undefined, [movedJson]);
  const shownTraining = moved ?? target;
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
        } else if (trainingChosen.current) {
          // The coach chose this training. The printed group and season come from its microcycle.
          setContent(current => current.session.group === value.group && current.session.season === value.season && current.session.halfSeason === value.halfSeason
            ? current : { ...current, session: { ...current.session, group: value.group, season: value.season, halfSeason: value.halfSeason } });
        }
      }).catch(failure => { if (!controller.signal.aborted) setReferenceError({ key, message: failure.message }); });
    return () => controller.abort();
  }, [shownTraining, ready, drawingEndpoint, location, refresh]);

  const storeDraft = useCallback((submitted = pending.current, independent = privateDraft) => {
    if (!storageKey || leaving.current) return;
    try {
      const draft: Draft = { content, changes, saved, id: proposedId.current, pending: submitted,
        numberEdited: numberEdited.current, privateDraft: independent, training };
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

  function attach(index: number, drawing: DrawingSnapshot | null) {
    setChanges((previous) => ({ ...previous, [index]: drawing?.sourceId ?? null }));
    updateSection(index, { drawing });
  }

  const trainingWarning = choice.microcycleWarning ?? choice.sessionWarning;
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

  const groups = options?.groups ?? [];
  const cycleChoices = groupCycles(options, training.groupKey).filter(cycle => cycle.number.trim())
    .map(cycle => ({ key: cycle.id, value: cycle.number.trim(), label: `Микроцикъл ${cycle.number.trim()}`, hint: formatWeekRange(cycle.week) }));
  const sessionChoices = choice.cycle?.rows.map((rowId, index) => ({ key: rowId, value: String(index + 1), label: `Тренировка ${index + 1}` })) ?? [];
  function sessionSlot(key: keyof PlanContent["session"]) {
    if (!coach || (!options && !optionsError) || (key !== "microcycle" && key !== "sessionNumber")) return undefined;
    if (key === "sessionNumber") return <TrainingCombobox label="Тренировка №" max={40} value={content.session.sessionNumber} options={sessionChoices}
      warning={choice.sessionWarning} empty={choice.cycle ? "Няма тренировки в микроцикъла." : "Първо въведете микроцикъл."}
      onChange={(value) => { numberEdited.current = true; chooseTraining({}, { sessionNumber: value }); }}
      onPick={(option) => { numberEdited.current = true; chooseTraining({}, { sessionNumber: option.value }); }} />;
    return <>
      {!target && groups.length > 1 && <div className="td-field">
        <label htmlFor="td-training-group">Група</label>
        <select id="td-training-group" value={training.groupKey ?? ""}
          onChange={(event) => chooseTraining({ groupKey: event.target.value || undefined, cycleId: undefined })}>
          <option value="">Без група</option>
          {groups.map(group => <option key={group.key} value={group.key}>{group.name}</option>)}
        </select>
      </div>}
      <TrainingCombobox label="Микроцикъл" max={40} value={content.session.microcycle} options={cycleChoices} warning={choice.microcycleWarning}
        empty={optionsError || (training.groupKey ? "Няма микроцикли за групата." : groups.length ? "Първо изберете група." : "Няма групи за треньора.")}
        onChange={(value) => chooseTraining({}, { microcycle: value })}
        onPick={(option) => chooseTraining({ cycleId: option.key }, { microcycle: option.value })} />
    </>;
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
      // A plan that the coach moved to another training is linked to that training. The opened training keeps its plan.
      const linkTo = independent ? undefined : moved;
      const payload = JSON.stringify({ id: fork ? crypto.randomUUID() : proposedId.current, revision: saved?.revision, content: input,
        ...(saved && linkTo && { target: linkTo, link: true }),
        ...(target && saved && !linkTo && { target, ...(link && { link: true, ...(replace && { replaceDocumentId: replace }) }) }),
        ...(fork && { forkFrom: saved?.id, sourceRevision: saved?.revision }),
        ...(!saved && linkTo && { target: linkTo, automaticNumber: true }),
        ...(target && !saved && !linkTo && (independent ? { privateCoachDraft: true } : { target, automaticNumber: !numberEdited.current, ...(replace && { replaceDocumentId: replace }) })) });
      const submitted = target && creating ? pending.current ?? payload : payload;
      if (target && creating) {
        pending.current = submitted;
        setPrivateDraft(independent);
        storeDraft(submitted, independent);
      }
      const result = await documentRequest<{ document: SavedDocument; alreadyCreated?: boolean }>(
        creating ? endpoint : `${endpoint}/${saved!.id}`, "План-конспектът не може да се запази.", {
          method: creating ? "POST" : "PUT",
          headers: { "content-type": "application/json" },
          body: submitted,
        }, coach,
      );
      setSaved(result.document);
      pending.current = null;
      if (target) {
        if (submitted === payload || (initial && JSON.stringify(JSON.parse(submitted).content) === JSON.stringify(input))) {
          const linked = sessionTarget(JSON.parse(submitted).target);
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
        setContent(result.document.content);
        setChanges({});
        setDirty(false);
        setNotice("План-конспектът е запазен.");
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
          if (target && saved && !pending.current) saveChoice.current?.showModal(); else void save();
        }} disabled={saving || !ready || (!!target && !initialized.current) || (!!subscription.access?.canSave && !!saved && !dirty && !link)}>
          {saving ? "Записване…" : "Запази"}
        </button>
      </div>
    </header>
    {(subscription.error || subscription.access && !subscription.access.canSave) && <div role="status" className="td-feedback tp-subscription-notice">{subscription.error || trainingSubscriptionInactiveMessage}{subscription.error && <button type="button" onClick={() => void subscription.refresh().catch(() => {})}>Опитай отново</button>}</div>}
    <dialog ref={saveChoice} className="tp-modal td-save-choice" aria-labelledby="td-save-choice-title" aria-describedby="td-save-choice-description">
      <div className="tp-modal-header">
        <h2 id="td-save-choice-title">Запазване на промените</h2>
      </div>
      <p id="td-save-choice-description">Промените върху съществуващия план ще се виждат във всеки тренировъчен микроцикъл, в който се използва.</p>
      <div className="tp-modal-actions td-save-choice-actions">
        <button type="button" className="tp-primary-btn" onClick={() => { saveChoice.current?.close(); void save(false); }}>Запази върху съществуващия</button>
        <button type="button" className="tp-secondary-btn" onClick={() => { saveChoice.current?.close(); void save(false, true); }}>Запази като нов план-конспект</button>
        <button type="button" className="tp-secondary-btn" autoFocus onClick={() => saveChoice.current?.close()}>Отказ</button>
      </div>
    </dialog>
    {storageError && <p role="alert" className="td-feedback">Черновата е само в този раздел. Оставете го отворен до запазването.</p>}
    {shownTraining && !previewing && <TrainingReferencePanel reference={currentReference} error={currentReferenceError}
      changed={referenceChanged} refresh={() => setRefresh(value => value + 1)}
      note={moved ? `${target ? "Тренировката е сменена. " : ""}При запазване план-конспектът ще се свърже с тази тренировка.` : undefined} />}
    {privateOption && <button type="button" className="tp-secondary-btn" disabled={saving} onClick={() => void save(true)}>Запази отделно в библиотеката</button>}
    {error && <div role="alert" className="td-feedback">{error}</div>}
    {notice && <div role="status" className="td-notice">{notice}</div>}
    <div className="td-workspace">
      {target && !initialized.current ? (!currentReferenceError && <FinanceSkeleton variant="form" />) : previewing
        ? <DocumentSheet content={visibleContent} clubLogoUrl={clubLogoUrl} pending={saving} canPrint={!!subscription.access?.canPrint} checkPrint={async () => (await subscription.refresh()).canPrint} />
        : <DocumentFields content={visibleContent} disabled={saving || !ready || (!!target && !initialized.current)} drawingEndpoint={drawingEndpoint} location={location} sessionSlot={sessionSlot}
            onSession={(key, value) => { if (key === "sessionNumber") numberEdited.current = true; edit(current => ({ ...current, session: { ...current.session, [key]: value } })); }}
            onSection={updateSection} onDrawing={attach} onMerge={(merge) => edit((current) => ({ ...current, merge }))} />}
    </div>
  </>;
}
