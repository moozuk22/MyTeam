"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { Archive, ArrowLeft, CalendarCheck, CalendarRange, ChevronLeft, ChevronRight, Download, FileText, Images, Plus, Printer, Save, Trash2 } from "lucide-react";
import { useBrowserDialogs } from "@/components/admin/BrowserDialogProvider";
import { cycleColumns, emptyCycle, formatWeekDates, formatWeekRange, shiftWeek, type CycleContent } from "@/lib/exercise/microcycle";
import type { CompetitionSeason } from "@/lib/exercise/document";
import "./workspace.css";
type Cycle = { groupKey: string; groupName: string; content: CycleContent; revision: number };
type Data = { club: { name: string }; groups: { key: string; name: string }[]; cycles: Cycle[] };
const headerFields = [["format", "Формат"], ["age", "Възраст"], ["season", "Сезон"], ["half", "Полусезон"], ["number", "Микроцикъл №"]] as const;

/** Waits for the paper sheet images so print and PDF include the club logo. */
const imagesReady = (root: HTMLElement | null) => Promise.all([...root?.querySelectorAll("img") ?? []].map(img => img.decode().catch(() => undefined)));
const upper = (value: string) => value.trim().toLocaleUpperCase("bg-BG");

/** Sheet in the club's paper layout (without Saturday and Sunday rows). Used for print, PDF and the read-only coach view. */
function PaperSheet({ clubName, logoUrl, week, content }: { clubName: string; logoUrl?: string; week: string; content: CycleContent }) {
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
      {content.rows.map((row, i) => <tr key={i}>
        <th scope="row" className="mcp-label mcp-row">ТРЕНИРОВКА{" "}<br />№{i + 1}</th>
        {row.map((cell, j) => <td key={j} data-label={cycleColumns[j]}>{cell}</td>)}
      </tr>)}
    </tbody>
  </table>;
}

export default function Workspace({ clubId, coachGroupId, initialWeek, clubLogoUrl, competitionSeason }: { competitionSeason: CompetitionSeason; clubId: string; coachGroupId?: string; initialWeek: string; clubLogoUrl?: string }) {
  const [week, setWeek] = useState(initialWeek);
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
  const dialogs = useBrowserDialogs();
  const sheet = useRef<HTMLDivElement>(null);
  const location = new URLSearchParams({ clubId, ...(coachGroupId ? { coachGroupId } : {}) }).toString();
  const endpoint = `/api/admin/clubs/${clubId}/training-plans/microcycles?${location}&week=${week}`;
  const readOnly = coachGroupId !== undefined;
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined); setError("");
    fetch(endpoint, { signal: controller.signal }).then(async r => { const value = await r.json(); if (!r.ok) throw new Error(value.error); return value; }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [endpoint, reload]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (dirty || busy) e.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, busy]);
  const navigate = async (fn: () => void) => { if (busy) return; if (!dirty || await dialogs.confirm("Да се отхвърлят ли незапазените промени?")) fn(); };
  const goToWeek = (next: string) => navigate(() => { setWeek(next); setSelected(""); setDirty(false); });
  const open = (key: string) => navigate(() => { const cycle = data?.cycles.find(c => c.groupKey === key); setSelected(key); setContent({ ...(cycle?.content ?? emptyCycle()), season: competitionSeason.season, half: competitionSeason.halfSeason }); setRevision(cycle?.revision ?? 0); setDirty(false); });
  const change = (next: CycleContent) => { setContent(next); setDirty(true); };
  async function save(remove = false) {
    setBusy(true); setError("");
    try {
      const r = await fetch(endpoint, { method: remove ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week, groupKey: selected, revision, content }) });
      const value = await r.json(); if (!r.ok) throw new Error(value.error);
      setRevision(remove ? 0 : value.revision); setDirty(false); if (remove) setSelected(""); setReload(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Грешка при запис."); } finally { setBusy(false); }
  }
  async function exportCycle(pdf: boolean) {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/admin/clubs/${clubId}/training-plans/access?operation=print`);
      const access = await r.json();
      if (!r.ok || !access.canPrint) throw new Error("Необходим е активен абонамент за печат.");
      if (!pdf) {
        flushSync(() => { setPrintAllowed(true); setPaper(true); });
        await imagesReady(sheet.current);
        const el = sheet.current!;
        // A4 landscape with 10 mm margins is 277 × 190 mm (about 1047 × 718 CSS px). Shrink the sheet to fit one page.
        el.style.width = "1047px";
        const scale = Math.min(1, 710 / el.offsetHeight);
        if (scale < 1) el.style.zoom = String(scale);
        requestAnimationFrame(() => { window.print(); el.style.width = ""; el.style.zoom = ""; setPrintAllowed(false); setPaper(false); setBusy(false); });
        return;
      }
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
      flushSync(() => setPaper(true));
      await imagesReady(sheet.current);
      const canvas = await html2canvas(sheet.current!, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      setPaper(false);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      // Fit the whole sheet on one A4 landscape page (277 × 190 mm inside 10 mm margins).
      const fit = Math.min(277 / canvas.width, 190 / canvas.height);
      const width = canvas.width * fit; const height = canvas.height * fit;
      doc.addImage(canvas.toDataURL("image/png"), "PNG", (297 - width) / 2, 10, width, height);
      doc.save(`microcycle-${week}.pdf`);
      setBusy(false);
    } catch (e) { setPaper(false); setBusy(false); setError(e instanceof Error ? e.message : "Грешка при печат."); }
  }

  const archived = data?.cycles.filter(c => !data.groups.some(g => g.key === c.groupKey)) ?? [];
  const selectedName = data?.groups.find(g => g.key === selected)?.name ?? data?.cycles.find(c => c.groupKey === selected)?.groupName;
  const range = formatWeekRange(week);
  const updateCell = (i: number, j: number, value: string) => change({ ...content, rows: content.rows.map((r, n) => n === i ? r.map((v, k) => k === j ? value : v) : r) });

  return <main className={`tp-page mc-page${printAllowed ? " mc-print-allowed" : ""}`}>
    <div className="tp-inner">
      <header className="tp-header">
        <Link className="tp-back-btn" href={`/admin/members?${location}`}><ArrowLeft size={16} aria-hidden="true" /> Назад</Link>
        <div className="tp-heading">
          <h1 className="tp-title"><CalendarRange aria-hidden="true" />Седмичен микроцикъл</h1>
          {data ? <p>{data.club.name}</p> : <p aria-hidden="true"><span className="mc-line mc-line--title" /></p>}
        </div>
        <nav className="mc-links" aria-label="Тренировъчни планове">
          <Link className="tp-secondary-btn" href={`/admin/training-plans?${location}`}><Images size={16} aria-hidden="true" /> Библиотека с рисунки</Link>
          <Link className="tp-secondary-btn" href={`/admin/training-plans/documents?${location}`}><FileText size={16} aria-hidden="true" /> План-конспекти</Link>
        </nav>
      </header>

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
      {data && data.groups.length > 0 && <div className="mc-groups">
        {data.groups.map(g => {
          const exists = data.cycles.some(c => c.groupKey === g.key);
          return <button type="button" className="mc-group" disabled={busy || (readOnly && !exists)} key={g.key} aria-pressed={g.key === selected} onClick={() => void open(g.key)}>
            <strong>{g.name}</strong>
            <span className={`mc-chip${exists ? " mc-chip--saved" : ""}`}>{exists ? "Има микроцикъл" : readOnly ? "Няма микроцикъл" : "Създай микроцикъл"}</span>
          </button>;
        })}
      </div>}
      {archived.length > 0 && <>
        <h2 className="mc-section-title"><Archive size={16} aria-hidden="true" /> Архив</h2>
        <div className="mc-groups">
          {archived.map(c => <button type="button" className="mc-group" disabled={busy} key={c.groupKey} aria-pressed={c.groupKey === selected} onClick={() => void open(c.groupKey)}>
            <strong>{c.groupName}</strong><span className="mc-chip mc-chip--saved">Архивирана група</span>
          </button>)}
        </div>
      </>}

      {selected && <section className="mc-editor" aria-label={`Микроцикъл: ${selectedName ?? ""}`}>
        <div ref={sheet} className={`mc-sheet${paper ? " mc-paper" : readOnly ? " mc-view" : ""}`}>
          {paper || readOnly ? <PaperSheet clubName={data?.club.name ?? ""} logoUrl={clubLogoUrl} week={week} content={content} /> : <>
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
              <tbody>
                {content.rows.length === 0 && <tr className="mc-empty-row"><td colSpan={6}>{readOnly ? "Няма добавени тренировки." : "Няма добавени тренировки. Използвайте „Добави тренировка“."}</td></tr>}
                {content.rows.map((row, i) => <tr key={i}>
                  <th scope="row" className="mc-col-num">
                    <span className="mc-row-title"><span className="mc-row-label">Тренировка </span>{i + 1}</span>
                    {!readOnly && <button type="button" className="tp-icon-btn mc-remove" disabled={busy} onClick={() => change({ ...content, rows: content.rows.filter((_, n) => n !== i) })} aria-label={`Премахни тренировка ${i + 1}`} title="Премахни"><Trash2 size={16} aria-hidden="true" /></button>}
                  </th>
                  {row.map((cell, j) => <td key={j}>
                    <span className="mc-cell-label" aria-hidden="true">{cycleColumns[j]}</span>
                    <textarea aria-label={`Тренировка ${i + 1}, ${cycleColumns[j]}`} value={cell} maxLength={4000} readOnly={readOnly || busy} onChange={e => updateCell(i, j, e.target.value)} />
                  </td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
          {!readOnly && <button type="button" className="tp-secondary-btn mc-add" disabled={busy || content.rows.length >= 30} onClick={() => change({ ...content, rows: [...content.rows, ["", "", "", "", ""]] })}><Plus size={16} aria-hidden="true" /> Добави тренировка</button>}
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
