"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, FileText } from "lucide-react";
import {
  blankDocument,
  type DocumentInput, type DrawingSnapshot, type PlanContent, type SavedDocument,
} from "@/lib/exercise/document";
import FinanceSkeleton from "../../members/_components/FinanceSkeleton";
import DocumentFields from "./DocumentFields";
import { documentRequest } from "./documentRequest";

const DocumentSheet = dynamic(() => import("./DocumentSheet"), {
  ssr: false, loading: () => <FinanceSkeleton variant="form" />,
});

export default function DocumentEditor({ initial, groupName, context, endpoint, drawingEndpoint, location, listHref }: {
  initial?: SavedDocument; groupName?: string; context: string; endpoint: string; drawingEndpoint: string; location: string; listHref: string;
}) {
  const [content, setContent] = useState<PlanContent>(() => initial?.content ?? blankDocument(groupName));
  const [saved, setSaved] = useState(initial);
  const proposedId = useRef<string>(initial?.id ?? "");
  const [changes, setChanges] = useState<Partial<Record<number, string | null>>>({});
  const [previewing, setPreviewing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!dirty) return;
    function onUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = true;
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

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
      <Link href={listHref} className="tp-back-btn" onNavigate={(event) => {
        if ((dirty || saving) && !window.confirm("Имате незапазени промени. Да излезете ли?")) event.preventDefault();
      }}><ArrowLeft size={16} aria-hidden="true" /> Към план-конспектите</Link>
      <div className="tp-heading">
        <h1 className="tp-title"><FileText aria-hidden="true" />{saved ? "Редакция на план-конспект" : "Нов план-конспект"}</h1>
        <p>{context}</p>
      </div>
      <div className="td-actions td-header-actions">
        <button type="button" className="tp-secondary-btn"
          onClick={() => setPreviewing((value) => !value)}>
          {previewing ? "Към редакцията" : "Преглед за печат"}
        </button>
        <button type="button" className="tp-primary-btn" onClick={() => void save()} disabled={saving || (!!saved && !dirty)}>
          {saving ? "Записване…" : "Запази"}
        </button>
      </div>
    </header>
    {error && <div role="alert" className="td-feedback">{error}</div>}
    {notice && <div role="status" className="td-notice">{notice}</div>}
    <div className="td-workspace">
      {previewing
        ? <DocumentSheet content={content} pending={saving} />
        : <DocumentFields content={content} disabled={saving} drawingEndpoint={drawingEndpoint} location={location}
            onSession={(key, value) => edit((current) => ({ ...current, session: { ...current.session, [key]: value } }))}
            onSection={updateSection} onDrawing={attach} onMerge={(merge) => edit((current) => ({ ...current, merge }))} />}
    </div>
  </>;
}
