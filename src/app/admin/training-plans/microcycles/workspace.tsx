"use client";

import { sessionUrl, type SessionTarget } from "@/lib/exercise/trainingSession";
import SectionNav from "../SectionNav";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { Archive, ArrowLeft, CalendarCheck, CalendarRange, ChevronDown, ChevronLeft, ChevronRight, Download, Layers, Plus, Printer, Save, Search, Trash2, Users } from "lucide-react";
import { useBrowserDialogs } from "@/components/admin/BrowserDialogProvider";
import { cycleColumns, emptyCycle, formatWeekDates, formatWeekRange, shiftWeek, type CycleContent } from "@/lib/exercise/microcycle";
import type { CompetitionSeason } from "@/lib/exercise/document";
import { coachSections, filterGroups, NO_COACH_ID, type FilterGroup } from "@/lib/exercise/microcycleGroupFilter";
import TrainingDocumentDialog from "./TrainingDocumentDialog";
import PrintChoiceDialog, { type PrintChoice, type PrintTraining } from "./PrintChoiceDialog";
import dynamic from "next/dynamic";
import { withCoachImages } from "../documents/documentRequest";
import { fitTextareas } from "./fitTextareas";
import "../documents/documents.css";
import "./workspace.css";
type Cycle = { id: string; canLink: boolean; links: Record<string, string | null>; groupKey: string; groupName: string; content: CycleContent; revision: number };
type Data = { club: { name: string }; groups: FilterGroup[]; coachView?: boolean; cycles: Cycle[] };
const groupCount = (n: number) => `${n} ${n === 1 ? "група" : "групи"}`;
const headerFields = [["format", "Формат"], ["age", "Възраст"], ["season", "Сезон"], ["half", "Полусезон"], ["number", "Микроцикъл №"]] as const;

/** Waits for the paper sheet images so print and PDF include the club logo. */
const imagesReady = (root: HTMLElement | null) => Promise.all([...root?.querySelectorAll("img") ?? []].map(img => img.decode().catch(() => undefined)));
const DocumentSheet = dynamic(() => import("../documents/DocumentSheet"), { ssr: false });

/** A4 landscape with 10 mm margins is 277 × 190 mm (about 1047 × 718 CSS px). Shrinks the week sheet to fit one page. */
function fitWeek(el: HTMLElement) {
  el.style.width = "1047px";
  const scale = Math.min(1, 710 / el.offsetHeight);
  if (scale < 1) el.style.zoom = String(scale);
}

/** Puts the week sheet on one A4 landscape page (277 × 190 mm inside 10 mm margins). */
function addWeekPage(doc: import("jspdf").jsPDF, canvas: HTMLCanvasElement) {
  const fit = Math.min(277 / canvas.width, 190 / canvas.height);
  const width = canvas.width * fit; const height = canvas.height * fit;
  doc.addImage(canvas.toDataURL("image/png"), "PNG", (297 - width) / 2, 10, width, height);
}

/** Waits until each plan has its drawings and the sheets keep the same layout. */
async function printPagesReady(root: HTMLElement, count: number) {
  const deadline = Date.now() + 30_000;
  let stable = 0;
  while (stable < 3) {
    if (root.querySelector(".mc-print-doc [role=alert]")) throw new Error("Упражненията не могат да се подготвят за печат. Опитайте отново.");
    if (Date.now() > deadline) throw new Error("Печатът не може да се подготви. Опитайте отново.");
    stable = root.querySelectorAll('.td-preview[data-print-ready="true"]').length === count ? stable + 1 : 0;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await imagesReady(root);
}
const upper = (value: string) => value.trim().toLocaleUpperCase("bg-BG");

/** Sheet in the club's paper layout (without Saturday and Sunday rows). Used for print, PDF and the read-only coach view. */
function PaperSheet({ clubName, logoUrl, week, content, action }: { action?: (id: string) => React.ReactNode; clubName: string; logoUrl?: string; week: string; content: CycleContent }) {
  const season = content.season.trim();
  const half = upper(content.half);
  const number = content.number.trim();
  return <table className="mcp-table">
    <colgroup><col className="mcp-col-label" /><col className="mcp-col-warmup" /><col /><col /><col /><col /></colgroup>
    <thead>
      <tr className="mcp-top">
        <th rowSpan={2} className="mcp-logo">{logoUrl && <img src={logoUrl} alt="" crossOrigin="anonymous" />}</th>
        <th rowSpan={2} className="mcp-format"><span>{upper(content.format)}</span><span>{upper(content.age)}</span></th>
        <th colSpan={4} className="mcp-club">{clubName}</th>
      </tr>
      <tr className="mcp-top">
        <th colSpan={4} className="mcp-title">
          {season && <em>{/състезателна/i.test(season) ? season : `Спортно – състезателна ${season}`}</em>}
          <span>ТРЕНИРОВЪЧЕН ПЛАН{half ? ` - ${half}` : ""}</span>
          <strong>({formatWeekDates(week)})</strong>
          <strong className="mcp-number">СЕДМИЧЕН ТРЕНИРОВЪЧЕН МИКРОЦИКЪЛ{number ? ` №${number}` : ""}</strong>
        </th>
      </tr>
      <tr className="mcp-heads">
        <th rowSpan={2} className="mcp-label mcp-parts"><span>ЧАСТ ОТ ТРЕНИРОВКАТА/ ФАЗИ</span><span>Тренировка №</span></th>
        <th className="mcp-head">ПОДГОТВИТЕЛНА ЧАСТ</th>
        <th colSpan={4} className="mcp-head">ОСНОВНА ЧАСТ</th>
      </tr>
      <tr className="mcp-heads">{cycleColumns.map(c => <th key={c} className="mcp-head mcp-phase">{upper(c)}</th>)}</tr>
    </thead>
    <tbody>
      {content.rows.length === 0 && <tr className="mcp-empty"><td colSpan={6}>Няма добавени тренировки.</td></tr>}
      {content.rows.map((row, i) => <tr key={row.id} id={action ? `training-${row.id}` : undefined} tabIndex={-1}>
        <th scope="row" className="mcp-label mcp-row">ТРЕНИРОВКА{" "}<br />№{i + 1}{action?.(row.id)}</th>
        {row.cells.map((cell, j) => <td key={j} data-label={cycleColumns[j]}>{cell}</td>)}
      </tr>)}
    </tbody>
  </table>;
}

export default function Workspace({ restore, clubId, coachGroupId, initialWeek, clubLogoUrl, competitionSeason }: { restore?: SessionTarget; competitionSeason: CompetitionSeason; clubId: string; coachGroupId?: string; initialWeek: string; clubLogoUrl?: string }) {
  const [week, setWeek] = useState(restore?.week ?? initialWeek);
  const [data, setData] = useState<Data>();
  const [selected, setSelected] = useState("");
  const [content, setContent] = useState(emptyCycle);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [printAllowed, setPrintAllowed] = useState(false);
  const [paper, setPaper] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [byCoach, setByCoach] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  // While searching, every matching coach opens; this set holds the ones the user closed again. It resets with each new query.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const dialogs = useBrowserDialogs();
  const [openDocument, setOpenDocument] = useState<{ rowId: string; documentId: string }>();
  const [printChoice, setPrintChoice] = useState<{ pdf: boolean }>();
  const [bundle, setBundle] = useState<{ week: boolean; documents: PrintChoice["documents"] }>();
  const bundleRef = useRef<HTMLDivElement>(null);
  const pendingRestore = useRef(restore);
  const sheet = useRef<HTMLDivElement>(null);
  const location = new URLSearchParams({ clubId, ...(coachGroupId ? { coachGroupId } : {}) }).toString();
  const endpoint = `/api/admin/clubs/${clubId}/training-plans/microcycles?${location}&week=${week}&version=2`;
  const readOnly = coachGroupId !== undefined;
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined); setError("");
    fetch(endpoint, { signal: controller.signal }).then(async r => { const value = await r.json(); if (!r.ok) throw new Error(value.error); return value; }).then((value: Data) => {
      if (controller.signal.aborted) return;
      setData(value);
      const target = pendingRestore.current;
      if (!target) return;
      const cycle = value.cycles.find(c => c.id === target.cycleId && c.groupKey === target.groupKey);
      if (cycle) { setSelected(cycle.groupKey); setContent(cycle.content); setRevision(cycle.revision); }
      if (!cycle?.content.rows.some(row => row.id === target.rowId)) {
        setError("Тренировката вече не е налична.");
        pendingRestore.current = undefined;
      }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [endpoint, reload]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (dirty || busy) e.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, busy]);
  useEffect(() => {
    const target = pendingRestore.current;
    if (!target || selected !== target.groupKey) return;
    const row = document.getElementById(`training-${target.rowId}`);
    if (!row) return;
    row.focus({ preventScroll: true });
    row.scrollIntoView({ block: "start" });
    pendingRestore.current = undefined;
  }, [selected, data]);
  const navigate = async (fn: () => void) => { if (busy) return; if (!dirty || await dialogs.confirm("Да се отхвърлят ли незапазените промени?")) fn(); };
  const goToWeek = (next: string) => navigate(() => { setWeek(next); setSelected(""); setDirty(false); });
  const open = (key: string) => navigate(() => { const cycle = data?.cycles.find(c => c.groupKey === key); setSelected(key); setContent(cycle?.content ?? { ...emptyCycle(), season: competitionSeason.season, half: competitionSeason.halfSeason }); setRevision(cycle?.revision ?? 0); setDirty(false); });
  const change = (next: CycleContent) => { setContent(next); setDirty(true); };
  async function save(remove = false) {
    setBusy(true); setError("");
    try {
      const r = await fetch(endpoint, { method: remove ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week, groupKey: selected, revision, content }) });
      const value = await r.json(); if (!r.ok) throw new Error(value.error);
      if (!remove) setContent(value.content);
      setRevision(remove ? 0 : value.revision); setDirty(false); if (remove) setSelected(""); setReload(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Грешка при запис."); } finally { setBusy(false); }
  }
  async function exportCycle(pdf: boolean) {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/admin/clubs/${clubId}/training-plans/access?operation=print`);
      const access = await r.json();
      if (!r.ok || !access.canPrint) throw new Error("Необходим е активен абонамент за печат.");
      // When the trainings have plans, the user chooses what to print.
      if (printTrainings().some(training => training.documentId)) { setPrintChoice({ pdf }); setBusy(false); return; }
      await exportWeek(pdf);
    } catch (e) { setPaper(false); setBusy(false); setError(e instanceof Error ? e.message : "Грешка при печат."); }
  }
  function printTrainings(): PrintTraining[] {
    const links = selectedCycle?.canLink ? selectedCycle.links : {};
    return content.rows.map((row, index) => ({ rowId: row.id, number: index + 1, documentId: links[row.id] }));
  }
  async function exportWeek(pdf: boolean) {
    if (!pdf) {
      flushSync(() => { setPrintAllowed(true); setPaper(true); });
      await imagesReady(sheet.current);
      const el = sheet.current!;
      fitWeek(el);
      requestAnimationFrame(() => { window.print(); el.style.width = ""; el.style.zoom = ""; setPrintAllowed(false); setPaper(false); setBusy(false); });
      return;
    }
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
    flushSync(() => setPaper(true));
    await imagesReady(sheet.current);
    const canvas = await html2canvas(sheet.current!, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    setPaper(false);
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    addWeekPage(doc, canvas);
    doc.save(`microcycle-${week}.pdf`);
    setBusy(false);
  }
  /** Prints the chosen pages. The week and each plan start on a separate page. */
  async function exportChoice(pdf: boolean, choice: PrintChoice) {
    setPrintChoice(undefined);
    setBusy(true); setError("");
    try {
      if (!choice.documents.length) { await exportWeek(pdf); return; }
      const documents = choice.documents.map(item => ({ ...item, content: withCoachImages({ ...item.content, session: {
        // A linked plan does not store the numbers. The training gives them.
        ...item.content.session, microcycle: content.number, sessionNumber: String(item.number) } }, coachGroupId ?? null) }));
      flushSync(() => setBundle({ week: choice.week, documents }));
      const root = bundleRef.current!;
      await printPagesReady(root, documents.length);
      const weekPage = root.querySelector<HTMLElement>(".mc-print-week");
      const papers = [...root.querySelectorAll<HTMLElement>(".mc-print-doc .td-paper")];
      if (!pdf) {
        if (weekPage) fitWeek(weekPage);
        await new Promise<void>(resolve => requestAnimationFrame(() => { window.print(); resolve(); }));
        return;
      }
      const [{ default: html2canvas }, { jsPDF }, { addDocumentPages, releaseCanvases }] = await Promise.all([
        import("html2canvas-pro"), import("jspdf"), import("../documents/documentPdf")]);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      const canvases: HTMLCanvasElement[] = [];
      try {
        if (weekPage) {
          const canvas = await html2canvas(weekPage, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
          canvases.push(canvas);
          addWeekPage(doc, canvas);
        }
        for (const [index, paper] of papers.entries()) await addDocumentPages(doc, paper, canvases, index === 0 && !weekPage);
        doc.save(`microcycle-${week}.pdf`);
      } finally { releaseCanvases(canvases); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при печат.");
    } finally { setBundle(undefined); setBusy(false); }
  }

  const archived = filterGroups((data?.cycles.filter(c => !data.groups.some(g => g.key === c.groupKey)) ?? []).map(c => ({ key: c.groupKey, name: c.groupName })), query);
  const coachMode = Boolean(data?.coachView) && byCoach;
  const searching = query.trim() !== "";
  const visibleGroups = data ? filterGroups(data.groups, query) : [];
  const sections = data && coachMode ? coachSections(data.groups, query) : [];
  const hasSaved = (key: string) => Boolean(data?.cycles.some(c => c.groupKey === key));
  const toggleCoach = (id: string) => (searching ? setCollapsed : setExpanded)(current => { const next = new Set(current); if (!next.delete(id)) next.add(id); return next; });
  const showByCoach = (value: boolean) => {
    setByCoach(value);
    // Open the coach of the selected group so the selection stays visible.
    const coach = data?.groups.find(g => g.key === selected)?.coach;
    if (value && selected) setExpanded(current => new Set(current).add(coach?.id ?? NO_COACH_ID));
  };
  const groupCard = (g: FilterGroup) => {
    const exists = hasSaved(g.key);
    return <button type="button" className="mc-group" disabled={busy || (readOnly && !exists)} key={g.key} aria-pressed={g.key === selected} onClick={() => void open(g.key)}>
      <strong>{g.name}</strong>
      <span className={`mc-chip${exists ? " mc-chip--saved" : ""}`}>{exists ? "Има микроцикъл" : readOnly ? "Няма микроцикъл" : "Създай микроцикъл"}</span>
    </button>;
  };
  const selectedName = data?.groups.find(g => g.key === selected)?.name ?? data?.cycles.find(c => c.groupKey === selected)?.groupName;
  const range = formatWeekRange(week);
  const updateCell = (i: number, j: number, value: string) => change({ ...content, rows: content.rows.map((r, n) => n === i ? { ...r, cells: r.cells.map((v, k) => k === j ? value : v) } : r) });
  const rowsRef = useRef<HTMLTableSectionElement>(null);
  // The fields of each training fit their text. On wide screens the fields of a training have the same height.
  useLayoutEffect(() => {
    const body = rowsRef.current;
    if (!body) return;
    const wide = window.matchMedia("(min-width: 640px)");
    const fit = () => fitTextareas(Array.from(body.rows, (row) => Array.from(row.querySelectorAll("textarea"))), wide.matches);
    fit();
    void document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [content.rows, selected, paper]);

  const selectedCycle = data?.cycles.find(c => c.groupKey === selected);
  function documentAction(rowId: string) {
    if (!selectedCycle?.canLink || !selectedCycle.content.rows.some(row => row.id === rowId)) return null;
    const linked = selectedCycle.links[rowId];
    if (linked === null) return <small className="mc-doc-action">Има план-конспект от друг автор</small>;
    if (linked) return <button type="button" className="tp-primary-btn mc-doc-action" aria-haspopup="dialog"
      onClick={() => setOpenDocument({ rowId, documentId: linked })}>Отвори план-конспекта</button>;
    const href = sessionUrl("documents", location, { cycleId: selectedCycle.id, groupKey: selected, week, rowId }, "choose");
    return <Link className="tp-secondary-btn mc-doc-action" href={href} onNavigate={event => guardNavigation(event, href)}>
      Добави план-конспект
    </Link>;
  }
  function guardNavigation(event: { preventDefault: () => void }, href: string) {
    if (dirty || busy) { event.preventDefault(); void navigate(() => window.location.assign(href)); }
  }
  function documentDialog() {
    if (!openDocument || !selectedCycle) return null;
    const target = { cycleId: selectedCycle.id, groupKey: selected, week, rowId: openDocument.rowId };
    return <TrainingDocumentDialog endpoint={`/api/admin/clubs/${clubId}/training-plans/documents`} documentId={openDocument.documentId}
      coachGroupId={coachGroupId} previewHref={sessionUrl("documents", location, target, openDocument.documentId)}
      chooseHref={`${sessionUrl("documents", location, target, "choose")}&replace=${openDocument.documentId}`}
      onNavigate={guardNavigation} onRemove={() => removeDocument(selectedCycle.id, openDocument.rowId, openDocument.documentId)}
      onClose={() => setOpenDocument(undefined)} />;
  }
  async function removeDocument(cycleId: string, rowId: string, documentId: string) {
    const params = new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location)), cycleId, groupKey: selected, week, rowId, documentId });
    const response = await fetch(`/api/admin/clubs/${clubId}/training-plans/microcycles/session?${params}`, { method: "DELETE", cache: "no-store" });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "План-конспектът не може да бъде премахнат.");
    // The training is free again, so it offers to add a plan.
    setData(current => current && { ...current, cycles: current.cycles.map(cycle => cycle.id !== cycleId ? cycle
      : { ...cycle, links: Object.fromEntries(Object.entries(cycle.links).filter(([key]) => key !== rowId)) }) });
    setOpenDocument(undefined);
  }
  return <main className={`tp-page mc-page${printAllowed ? " mc-print-allowed" : ""}${bundle ? " mc-print-bundle-on" : ""}`}>
    {documentDialog()}
    {printChoice && <PrintChoiceDialog pdf={printChoice.pdf} endpoint={`/api/admin/clubs/${clubId}/training-plans/documents`} coachGroupId={coachGroupId}
      weekLabel={`${selectedName ?? ""} · ${range}`} trainings={printTrainings()}
      onConfirm={choice => void exportChoice(printChoice.pdf, choice)} onClose={() => setPrintChoice(undefined)} />}
    {bundle && <div ref={bundleRef} className="mc-print-bundle" aria-hidden="true" inert>
      {bundle.week && <div className="mc-print-page mc-print-week">
        <PaperSheet clubName={data?.club.name ?? ""} logoUrl={clubLogoUrl} week={week} content={content} />
      </div>}
      {bundle.documents.map(item => <div className="mc-print-page mc-print-doc" key={item.rowId}>
        <DocumentSheet content={item.content} clubLogoUrl={clubLogoUrl} pending={false} printActions={false} />
      </div>)}
    </div>}
    <div className="tp-inner">
      <header className="tp-header">
        <Link className="tp-back-btn" href={`/admin/members?${location}`} onNavigate={event => guardNavigation(event, `/admin/members?${location}`)}><ArrowLeft size={16} aria-hidden="true" /> Назад</Link>
        <div className="tp-heading">
          <h1 className="tp-title"><CalendarRange aria-hidden="true" />Седмичен микроцикъл</h1>
          {data ? <p>{data.club.name}</p> : <p aria-hidden="true"><span className="mc-line mc-line--title" /></p>}
        </div>
      </header>
      <SectionNav location={location} current="microcycles" onNavigate={guardNavigation} />

      <section className="mc-week" aria-label="Седмица">
        <button type="button" className="tp-icon-btn" disabled={busy} onClick={() => void goToWeek(shiftWeek(week, -7))} aria-label="Предишна седмица"><ChevronLeft size={20} aria-hidden="true" /></button>
        <div className="mc-week-label" aria-live="polite">
          <span>{week === initialWeek ? "Текуща седмица" : "Седмица"}</span>
          <strong>{range}</strong>
        </div>
        <button type="button" className="tp-icon-btn" disabled={busy} onClick={() => void goToWeek(shiftWeek(week, 7))} aria-label="Следваща седмица"><ChevronRight size={20} aria-hidden="true" /></button>
        {week !== initialWeek && <button type="button" className="tp-secondary-btn mc-week-today" disabled={busy} onClick={() => void goToWeek(initialWeek)}><CalendarCheck size={16} aria-hidden="true" /> Към текущата</button>}
      </section>

      {error && <div role="alert" className="td-feedback">{error} <button type="button" className="tp-secondary-btn" onClick={() => setReload(v => v + 1)}>Опитай отново</button></div>}

      <h2 className="mc-section-title">Групи</h2>
      {!data && !error && <div role="status" aria-label="Зареждане" aria-busy="true" className="mc-groups">
        {[0, 1, 2].map(i => <div key={i} className="mc-group mc-group--skeleton" aria-hidden="true"><span className="mc-line mc-line--name" /><span className="mc-line mc-line--chip" /></div>)}
      </div>}
      {data && data.groups.length === 0 && <div className="tp-empty">Няма налични групи.</div>}
      {data && data.groups.length > 0 && <div className="tp-category-controls mc-filters">
        {data.coachView && <div className="tp-scope-controls" role="group" aria-label="Изглед на групите">
          <button type="button" className={coachMode ? "tp-secondary-btn" : "tp-primary-btn"} aria-pressed={!coachMode} onClick={() => showByCoach(false)}><Layers size={16} aria-hidden="true" /> Всички групи</button>
          <button type="button" className={coachMode ? "tp-primary-btn" : "tp-secondary-btn"} aria-pressed={coachMode} onClick={() => showByCoach(true)}><Users size={16} aria-hidden="true" /> По треньори</button>
        </div>}
        <label className="tp-field mc-search">
          <span><Search size={16} aria-hidden="true" />Търсене</span>
          <input type="search" maxLength={200} value={query} placeholder={coachMode ? "Търси група или треньор" : "Търси група"} onChange={e => { setQuery(e.target.value); setCollapsed(new Set()); }} />
        </label>
      </div>}
      {data && data.groups.length > 0 && (coachMode ? sections.length === 0 : visibleGroups.length === 0) && <div className="tp-empty">Няма групи, които отговарят на търсенето.</div>}
      {data && !coachMode && visibleGroups.length > 0 && <div className="mc-groups">{visibleGroups.map(groupCard)}</div>}
      {coachMode && sections.length > 0 && <div className="mc-groups">
        {sections.map(section => {
          const isOpen = searching ? !collapsed.has(section.id) : expanded.has(section.id);
          const saved = section.groups.filter(g => hasSaved(g.key)).length;
          const panel = `mc-coach-${section.id}`;
          return <div key={section.id} className={`mc-coach${isOpen ? " mc-coach--open" : ""}`}>
            <button type="button" className="mc-coach-toggle" aria-expanded={isOpen} aria-controls={panel} onClick={() => toggleCoach(section.id)}>
              <span className="mc-coach-text">
                <strong>{section.name}</strong>
                <span className="mc-coach-chips">
                  <span className="mc-chip">{groupCount(section.groups.length)}</span>
                  {saved > 0 && <span className="mc-chip mc-chip--saved">{saved} с микроцикъл</span>}
                </span>
              </span>
              <ChevronDown className="mc-coach-icon" size={20} aria-hidden="true" />
            </button>
            {isOpen && <div id={panel} className="mc-groups mc-coach-groups">{section.groups.map(groupCard)}</div>}
          </div>;
        })}
      </div>}
      {archived.length > 0 && <>
        <h2 className="mc-section-title"><Archive size={16} aria-hidden="true" /> Архив</h2>
        <div className="mc-groups">
          {archived.map(c => <button type="button" className="mc-group" disabled={busy} key={c.key} aria-pressed={c.key === selected} onClick={() => void open(c.key)}>
            <strong>{c.name}</strong><span className="mc-chip mc-chip--saved">Архивирана група</span>
          </button>)}
        </div>
      </>}

      {selected && <section className="mc-editor" aria-label={`Микроцикъл: ${selectedName ?? ""}`}>
        <div ref={sheet} className={`mc-sheet${paper ? " mc-paper" : readOnly ? " mc-view" : ""}`}>
          {paper || readOnly ? <PaperSheet action={paper ? undefined : documentAction} clubName={data?.club.name ?? ""} logoUrl={clubLogoUrl} week={week} content={content} /> : <>
          <header className="mc-sheet-header">
            <div>
              <p className="mc-sheet-club">{data?.club.name}</p>
              <h2>{selectedName}</h2>
            </div>
            <p className="mc-sheet-week">{range}</p>
          </header>

          <div className="mc-fields">
            {headerFields.map(([key, label]) => <label className="mc-field" key={key}>
              <span>{label}</span>
              <input value={content[key]} maxLength={2000} readOnly={readOnly || busy || key === "season" || key === "half"} onChange={e => change({ ...content, [key]: e.target.value })} />
            </label>)}
          </div>

          <div className="mc-table">
            <table>
              <thead>
                <tr><th rowSpan={2} className="mc-col-num">№</th><th>Подготвителна част</th><th colSpan={4}>Основна част</th></tr>
                <tr>{cycleColumns.map(c => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody ref={rowsRef}>
                {content.rows.length === 0 && <tr className="mc-empty-row"><td colSpan={6}>{readOnly ? "Няма добавени тренировки." : "Няма добавени тренировки. Използвайте „Добави тренировка“."}</td></tr>}
                {content.rows.map((row, i) => <tr key={row.id} id={`training-${row.id}`} tabIndex={-1}>
                  <th scope="row" className="mc-col-num">
                    <span className="mc-row-title"><span className="mc-row-label">Тренировка </span>{i + 1}</span>
                    {documentAction(row.id)}
                    {!readOnly && <button type="button" className="tp-icon-btn mc-remove" disabled={busy} onClick={() => change({ ...content, rows: content.rows.filter((_, n) => n !== i) })} aria-label={`Премахни тренировка ${i + 1}`} title="Премахни"><Trash2 size={16} aria-hidden="true" /></button>}
                  </th>
                  {row.cells.map((cell, j) => <td key={j}>
                    <span className="mc-cell-label" aria-hidden="true">{cycleColumns[j]}</span>
                    <textarea aria-label={`Тренировка ${i + 1}, ${cycleColumns[j]}`} value={cell} maxLength={4000} readOnly={readOnly || busy} onChange={e => updateCell(i, j, e.target.value)} />
                  </td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
          {!readOnly && <button type="button" className="tp-secondary-btn mc-add" disabled={busy || content.rows.length >= 30} onClick={() => change({ ...content, rows: [...content.rows, { id: crypto.randomUUID(), cells: ["", "", "", "", ""] }] })}><Plus size={16} aria-hidden="true" /> Добави тренировка</button>}
          </>}

        </div>

        <div className="mc-actions">
          {!readOnly && <>
            <button type="button" className="tp-primary-btn" disabled={busy} onClick={() => void save()}><Save size={16} aria-hidden="true" /> {busy ? "Записване…" : "Запази"}</button>
            {dirty && !busy && <span className="mc-dirty">Незапазени промени</span>}
          </>}
          <span className="mc-actions-spacer" />
          <button type="button" className="tp-secondary-btn" disabled={busy} onClick={() => void exportCycle(false)}><Printer size={16} aria-hidden="true" /> Печат</button>
          <button type="button" className="tp-secondary-btn" disabled={busy} onClick={() => void exportCycle(true)}><Download size={16} aria-hidden="true" /> Изтегли PDF</button>
          {!readOnly && revision > 0 && <button type="button" className="tp-danger-btn" disabled={busy} onClick={async () => { if (await dialogs.confirm("Да се изтрие ли микроцикълът?")) void save(true); }}><Trash2 size={16} aria-hidden="true" /> Изтрий</button>}
        </div>
      </section>}
    </div>
  </main>;
}
