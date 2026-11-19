"use client";

import { guardBrowserHistory } from "@/lib/browserHistoryGuard";
import { useBrowserDialogs } from "@/components/admin/BrowserDialogProvider";

import { useTrainingPlanAccess, trainingSubscriptionMessage, trainingSubscriptionInactiveMessage } from "@/lib/exercise/useTrainingPlanAccess";

import { useEffect, useRef, useState } from "react";
import BackLink from "../BackLink";
import dynamic from "next/dynamic";
import { ArrowLeft, Eye, FileText, PenLine } from "lucide-react";
import {
  blankDocument,
  type CompetitionSeason, type DocumentInput, type DrawingSnapshot, type PlanContent, type SavedDocument,
} from "@/lib/exercise/document";
import FinanceSkeleton from "../../members/_components/FinanceSkeleton";
import DocumentFields from "./DocumentFields";
import { documentRequest } from "./documentRequest";

const DocumentSheet = dynamic(() => import("./DocumentSheet"), {
  ssr: false, loading: () => <FinanceSkeleton variant="form" />,
});

export default function DocumentEditor({ clubId, clubLogoUrl, initial, groupName, competitionSeason, context, endpoint, drawingEndpoint, location, listHref }: {
  clubId: string; clubLogoUrl?: string; initial?: SavedDocument; groupName?: string; competitionSeason: CompetitionSeason; context: string; endpoint: string; drawingEndpoint: string; location: string; listHref: string;
}) {
  const dialogs = useBrowserDialogs();
  const subscription = useTrainingPlanAccess(clubId);
  const [content, setContent] = useState<PlanContent>(() => {
    const document = initial?.content ?? blankDocument(groupName);
    return { ...document, session: { ...document.session, ...competitionSeason } };
  });
  const [saved, setSaved] = useState(initial);
  const proposedId = useRef<string>(initial?.id ?? "");
  const [changes, setChanges] = useState<Partial<Record<number, string | null>>>({});
  const [previewing, setPreviewing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const blocked = dirty || saving;
  const navigationBlocked = useRef(blocked);
  useEffect(() => { navigationBlocked.current = blocked; }, [blocked]);
  useEffect(() => guardBrowserHistory(
    window,
    () => dialogs.confirm("Имате незапазени промени. Да излезете ли?"),
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

  async function save() {
    if (!subscription.access?.canSave) { setError(trainingSubscriptionMessage); return; }
    if (saving) return;
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
    setError("");
    setNotice("");
    try {
      proposedId.current ||= crypto.randomUUID();
      const result = await documentRequest<{ document: SavedDocument; alreadyCreated?: boolean }>(
        saved ? `${endpoint}/${saved.id}` : endpoint, "План-конспектът не може да се запази.", {
          method: saved ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: proposedId.current, revision: saved?.revision, content: input }),
        },
      );
      setSaved(result.document);
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
      setError(failure instanceof Error ? failure.message : "План-конспектът не може да се запази.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <header className="tp-header td-editor-header">
      <BackLink href={listHref} className="tp-back-btn" beforeBack={async () => {
        if (saving) return false;
        if (dirty && !await dialogs.confirm("Имате незапазени промени. Да излезете ли?")) return false;
        navigationBlocked.current = false;
        return true;
      }}><ArrowLeft size={16} aria-hidden="true" /> Към план-конспектите</BackLink>
      <div className="tp-heading">
        <h1 className="tp-title"><FileText aria-hidden="true" />{saved ? "Редакция на план-конспект" : "Нов план-конспект"}</h1>
        <p>{context}</p>
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
        <button type="button" className="tp-primary-btn" onClick={() => void save()} disabled={saving || (!!subscription.access?.canSave && !!saved && !dirty)}>
          {saving ? "Записване…" : "Запази"}
        </button>
      </div>
    </header>
    {(subscription.error || subscription.access && !subscription.access.canSave) && <div role="status" className="td-feedback tp-subscription-notice">{subscription.error || trainingSubscriptionInactiveMessage}{subscription.error && <button type="button" onClick={() => void subscription.refresh().catch(() => {})}>Опитай отново</button>}</div>}
    {error && <div role="alert" className="td-feedback">{error}</div>}
    {notice && <div role="status" className="td-notice">{notice}</div>}
    <div className="td-workspace">
      {previewing
        ? <DocumentSheet content={content} clubLogoUrl={clubLogoUrl} pending={saving} canPrint={!!subscription.access?.canPrint} checkPrint={async () => (await subscription.refresh()).canPrint} />
        : <DocumentFields content={content} disabled={saving} drawingEndpoint={drawingEndpoint} location={location}
            onSession={(key, value) => edit((current) => ({ ...current, session: { ...current.session, [key]: value } }))}
            onSection={updateSection} onDrawing={attach} onMerge={(merge) => edit((current) => ({ ...current, merge }))} />}
    </div>
  </>;
}
