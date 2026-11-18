"use client";

import { trainingSubscriptionMessage } from "@/lib/exercise/useTrainingPlanAccess";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { documentBottomGroups, type DocumentSection, type PlanContent } from "@/lib/exercise/document";
import type { Exercise } from "@/lib/exercise/model";
import PrintDrawing, { type DrawingReport, type DrawingStatus } from "./PrintDrawing";

const WIDTH = 1060;
const HEIGHT = 730;
const SINGLE_PAGE_MIN_SCALE = 0.82;

function fitSheet(sheet: HTMLDivElement) {
  sheet.style.minHeight = "";
  sheet.style.width = `${WIDTH}px`;
  const naturalHeight = sheet.offsetHeight;
  if (naturalHeight <= HEIGHT) return { scale: 1, multiPage: false };

  let fits = HEIGHT / (naturalHeight + 1);
  let exceeds = 1;
  // Use the full paper width at each scale so dense text can wrap into fewer lines.
  for (let step = 0; step < 7; step++) {
    const scale = (fits + exceeds) / 2;
    sheet.style.width = `${WIDTH / scale}px`;
    if ((sheet.offsetHeight + 1) * scale <= HEIGHT) fits = scale;
    else exceeds = scale;
  }
  if (fits < SINGLE_PAGE_MIN_SCALE) {
    sheet.style.width = `${WIDTH}px`;
    sheet.style.minHeight = "";
    return { scale: 1, multiPage: true };
  }
  sheet.style.width = `${WIDTH / fits}px`;
  sheet.style.minHeight = `${HEIGHT / fits}px`;
  return { scale: fits, multiPage: false };
}

function PrintedValue({ label, value }: { label: string; value: string }) {
  return <div className="td-printed-value"><b>{label}</b>{value && <> · {value}</>}</div>;
}

function PrintedSections({ indices, sections, monochrome, onReport }: {
  indices: number[]; sections: DocumentSection[]; monochrome: boolean; onReport: DrawingReport;
}) {
  const drawings = indices.filter((index) => sections[index].drawing);
  const placement = indices.join(":");
  return <section className="td-printed-section" style={{ gridColumn: `span ${indices.length}` }}>
    <div className="td-printed-split">
      {indices.map((index) => <div key={index}>
        <h3 className={index === 3 ? "td-printed-section-heading-long" : undefined}>{sections[index].title}</h3>
        <div className="td-printed-text">
          <PrintedValue label="Цели / Насоки" value={sections[index].coaching} />
        </div>
      </div>)}
    </div>
    <div className={`td-printed-diagrams${drawings.length === 1 && indices.length === 2 ? " td-wide-diagram" : ""}`}>
      {drawings.map((index) => {
        const drawing = sections[index].drawing!;
        return <PrintDrawing key={index} index={index} placement={placement} layout={drawing.layout} title={drawing.title} monochrome={monochrome} onReport={onReport} />;
      })}
    </div>
    <div className="td-printed-split td-printed-footer">
      {indices.map((index) => <div key={index}>
        <PrintedValue label="Повторения" value={sections[index].repetitions} />
        <PrintedValue label="Времетраене (мин.)" value={sections[index].duration} />
      </div>)}
    </div>
  </section>;
}

function PrintedHeader({ content }: { content: PlanContent }) {
  const competitionLabel = [content.session.halfSeason.toLocaleLowerCase("bg-BG"), content.session.season]
    .filter(Boolean).join(" ");
  return <header className="td-printed-header">
    <h2>{content.session.title}</h2>
    <div>{competitionLabel ? `Спортно-състезателен ${competitionLabel}` : "Спортно-състезателен сезон"}</div>
  </header>;
}

function PrintedTopRow({ content, clubLogoUrl, monochrome, onReport, attempt }: {
  content: PlanContent; clubLogoUrl?: string; monochrome: boolean; onReport: DrawingReport; attempt: number;
}) {
  return <div className="td-printed-row" key={`top:${attempt}:${monochrome}`}>
    <PrintedSections indices={[0]} sections={content.sections} monochrome={monochrome} onReport={onReport} />
    <PrintedSections indices={[1]} sections={content.sections} monochrome={monochrome} onReport={onReport} />
    <section className="td-printed-section td-printed-session">
      <h3>Данни за тренировката</h3>
      <div className="td-printed-session-grid">
        <div className="td-printed-text td-printed-session-period">
          {([["period", "Период"], ["microcycle", "Микроцикъл"], ["sessionNumber", "Тренировка №"]] as const).map(([key, label]) => <PrintedValue key={key} label={label} value={content.session[key]} />)}
        </div>
        <div className="td-printed-session-side">
          <div className="td-printed-session-logo">{clubLogoUrl && <img src={clubLogoUrl} alt="" />}</div>
          {([["date", "Дата"], ["day", "Ден"], ["time", "Час"]] as const).map(([key, label]) => <div className="td-printed-text td-printed-session-datetime" key={key}><PrintedValue label={label} value={key === "date" ? content.session.date.split("-").reverse().join(".") : content.session[key]} /></div>)}
        </div>
        <div className="td-printed-text td-printed-session-main">
          {([["gameMoment", "Момент от играта"], ["objective", "Цел на тренировката"], ["tasks", "Задачи"]] as const).map(([key, label]) => <PrintedValue key={key} label={label} value={content.session[key]} />)}
        </div>
        <div className="td-printed-text td-printed-session-details">
          {([["playerCount", "Състезатели"], ["absences", "Отсъстващи"], ["injuries", "Контузени"], ["duration", "Времетраене (мин.)"], ["equipment", "Необходими пособия"]] as const).map(([key, label]) => <PrintedValue key={key} label={label} value={content.session[key]} />)}
        </div>
      </div>
      <div className="td-printed-text td-printed-session-coach"><PrintedValue label="Треньор" value={content.session.coach} /></div>
    </section>
  </div>;
}

function PrintedBottomRow({ content, monochrome, onReport, attempt }: {
  content: PlanContent; monochrome: boolean; onReport: DrawingReport; attempt: number;
}) {
  const bottom = documentBottomGroups(content.merge);
  return <div className="td-printed-row td-printed-row-bottom" key={`bottom:${attempt}:${monochrome}`}>
    {bottom.map((indices) => <PrintedSections key={indices.join(":")} indices={indices} sections={content.sections} monochrome={monochrome} onReport={onReport} />)}
  </div>;
}

export default function DocumentSheet({ content, clubLogoUrl, pending, canPrint = false, checkPrint }: {
  content: PlanContent; clubLogoUrl?: string; pending: boolean; canPrint?: boolean; checkPrint?: () => Promise<boolean>;
}) {
  const [printError, setPrintError] = useState("");
  const [checkingPrint, setCheckingPrint] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdf, setPdf] = useState<{ url: string; filename: string }>();
  const actionInProgress = useRef(false);
  const exportVersion = useRef(0);
  useEffect(() => {
    const clearPrintAccess = () => { delete document.documentElement.dataset.trainingPrintAuthorized; };
    window.addEventListener("afterprint", clearPrintAccess);
    return () => {
      window.removeEventListener("afterprint", clearPrintAccess);
      clearPrintAccess();
    };
  }, []);
  async function print(asPdf = false) {
    if (actionInProgress.current) return;
    if (!canPrint) { setPrintError(trainingSubscriptionMessage); return; }
    if (!ready) return;
    actionInProgress.current = true;
    const version = exportVersion.current;
    setCheckingPrint(true);
    setExportingPdf(asPdf);
    setPrintError("");
    try {
      if (!await checkPrint?.()) { setPrintError(trainingSubscriptionMessage); return; }
      if (version !== exportVersion.current) return;
      if (asPdf) {
        const paper = preview.current?.querySelector<HTMLElement>(".td-paper");
        if (!paper) throw new Error("PDF файлът не може да се подготви.");
        const { createDocumentPdf, documentPdfFilename } = await import("./documentPdf");
        const blob = await createDocumentPdf(paper);
        if (version !== exportVersion.current) return;
        const url = URL.createObjectURL(blob);
        const filename = documentPdfFilename(content.session.title);
        setPdf({ url, filename });
        const download = document.createElement("a");
        download.href = url;
        download.download = filename;
        document.body.append(download);
        download.click();
        download.remove();
        return;
      }
      document.documentElement.dataset.trainingPrintAuthorized = "true";
      window.print();
    } catch (failure) {
      delete document.documentElement.dataset.trainingPrintAuthorized;
      if (version === exportVersion.current) {
        setPrintError(asPdf ? "PDF файлът не може да се подготви. Опитайте отново." : failure instanceof Error ? failure.message : "Печатът не може да се подготви.");
      }
    } finally {
      actionInProgress.current = false;
      setCheckingPrint(false);
      setExportingPdf(false);
    }
  }
  const preview = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [multiPage, setMultiPage] = useState(false);
  const [screen, setScreen] = useState(1);
  const [fonts, setFonts] = useState(false);
  const [monochrome, setMonochrome] = useState(false);
  useEffect(() => {
    const version = ++exportVersion.current;
    setPdf(undefined);
    return () => { exportVersion.current = version + 1; };
  }, [content, monochrome, canPrint]);
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf.url); }, [pdf]);
  const [attempt, setAttempt] = useState(0);
  const [drawings, setDrawings] = useState<Record<number, { layout: Exercise; placement: string; status: DrawingStatus }>>({});
  const report: DrawingReport = useCallback((index, placement, layout, status) => {
    setDrawings((previous) => ({ ...previous, [index]: { layout, placement, status } }));
  }, []);

  useLayoutEffect(() => {
    if (sheet.current) {
      const fit = fitSheet(sheet.current);
      setScale(fit.scale);
      setMultiPage(fit.multiPage);
      if (fit.multiPage) setDrawings({});
    }
  }, [content, fonts]);

  useEffect(() => {
    let active = true;
    void document.fonts.ready.then(() => { if (active) setFonts(true); });
    const visible = preview.current;
    if (!visible) return;
    const observer = new ResizeObserver(([entry]) => setScreen(entry.contentRect.width / WIDTH));
    observer.observe(visible);
    return () => { active = false; observer.disconnect(); };
  }, []);

  const bottom = documentBottomGroups(content.merge);
  const assetStates = [[0], [1], ...bottom].flatMap((indices) => indices.flatMap((index) => {
    const drawing = content.sections[index].drawing;
    const asset = drawings[index];
    if (!drawing) return [];
    return [asset?.layout === drawing.layout && asset.placement === indices.join(":") ? asset.status : undefined];
  }));
  // Fit again after Konva has drawn all pitch images. Their final canvas size
  // can change the section's measured height after the initial layout pass.
  const drawingsReady = assetStates.length > 0 && assetStates.every((status) => status === "ready");
  useLayoutEffect(() => {
    if (!drawingsReady || !sheet.current) return;
    const fit = fitSheet(sheet.current);
    setScale(fit.scale);
    setMultiPage(fit.multiPage);
    if (fit.multiPage) setDrawings({});
  }, [drawingsReady]);
  const failed = assetStates.includes("failed");
  const ready = !pending && fonts && scale > 0 && assetStates.every((status) => status === "ready");
  const previewHeight = multiPage ? HEIGHT * 2 + 12 : HEIGHT;
  const style = {
    "--td-fit": scale || 1,
    "--td-screen": screen,
    "--td-preview-height": `${previewHeight * screen}px`,
  } as CSSProperties;

  return <section className="td-print-area" id="td-print-preview" aria-label="Преглед за печат">
    <div className="td-print-toolbar">
      <h2>Преглед за печат <small>A4 · хоризонтално</small></h2>
      <div className="td-print-actions">
        <label className="td-print-mode">
          <input type="checkbox" checked={monochrome} disabled={checkingPrint} onChange={(event) => {
            setDrawings({});
            setMonochrome(event.target.checked);
          }} />
          Черно-бял печат
        </label>
        <button className="tp-primary-btn" type="button" disabled={checkingPrint || (canPrint && !ready)} onClick={() => void print()}>Печат</button>
        <button className="tp-secondary-btn" type="button" disabled={checkingPrint || (canPrint && !ready)} onClick={() => void print(true)}>
          {exportingPdf ? "Подготовка на PDF…" : "Изтегли PDF"}
        </button>
      </div>
    </div>
    <p className="td-muted">За печат от телефон изтеглете PDF файла и го отворете. Изберете „Печат“ от менюто на телефона или приложението на принтера.</p>
    {pdf && <p className="td-muted" role="status">
      PDF файлът е готов. <a className="tp-secondary-btn" href={pdf.url} target="_blank" rel="noopener">Отвори PDF</a>
    </p>}
    {printError && <div className="td-feedback" role="alert">{printError}</div>}
    {failed && <div className="td-feedback" role="alert">
      Рисунките не могат да се подготвят за печат.
      <button type="button" className="tp-secondary-btn" onClick={() => { setDrawings({}); setAttempt((value) => value + 1); }}>Опитай отново</button>
    </div>}
    {!failed && !ready && <div className="td-print-loading" role="status" aria-label="Зареждане" aria-busy="true"><span aria-hidden="true" /></div>}
    {multiPage && <p className="td-muted">Планът ще се отпечата на две страници, за да остане четим.</p>}
    <div className={`td-preview${multiPage ? " td-preview-multipage" : ""}`} ref={preview} style={style} data-print-ready={ready}>
      <div className={`${monochrome ? "td-paper td-paper-monochrome" : "td-paper"}${multiPage ? " td-paper-multipage" : ""}`}>
        {!multiPage
          ? <div className="td-printed-sheet" ref={sheet}>
              <PrintedHeader content={content} />
              <PrintedTopRow content={content} clubLogoUrl={clubLogoUrl} monochrome={monochrome} onReport={report} attempt={attempt} />
              <PrintedBottomRow content={content} monochrome={monochrome} onReport={report} attempt={attempt} />
            </div>
          : <>
              <div className="td-print-page">
                <div className="td-printed-sheet td-print-page-sheet">
                  <PrintedHeader content={content} />
                  <PrintedTopRow content={content} clubLogoUrl={clubLogoUrl} monochrome={monochrome} onReport={report} attempt={attempt} />
                </div>
              </div>
              <div className="td-print-page">
                <div className="td-printed-sheet td-print-page-sheet">
                  <PrintedHeader content={content} />
                  <PrintedBottomRow content={content} monochrome={monochrome} onReport={report} attempt={attempt} />
                </div>
              </div>
            </>}
      </div>
    </div>
  </section>;
}
