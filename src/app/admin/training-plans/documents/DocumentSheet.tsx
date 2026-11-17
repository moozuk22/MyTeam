"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { documentBottomGroups, sessionFields, type DocumentSection, type PlanContent } from "@/lib/exercise/document";
import type { Exercise } from "@/lib/exercise/model";
import PrintDrawing, { type DrawingReport, type DrawingStatus } from "./PrintDrawing";

const WIDTH = 1060;
const HEIGHT = 730;

function fitSheet(sheet: HTMLDivElement) {
  sheet.style.minHeight = "";
  sheet.style.width = `${WIDTH}px`;
  const naturalHeight = sheet.offsetHeight;
  if (naturalHeight <= HEIGHT) return 1;

  let fits = HEIGHT / (naturalHeight + 1);
  let exceeds = 1;
  // Use the full paper width at each scale so dense text can wrap into fewer lines.
  for (let step = 0; step < 7; step++) {
    const scale = (fits + exceeds) / 2;
    sheet.style.width = `${WIDTH / scale}px`;
    if ((sheet.offsetHeight + 1) * scale <= HEIGHT) fits = scale;
    else exceeds = scale;
  }
  sheet.style.width = `${WIDTH / fits}px`;
  sheet.style.minHeight = `${HEIGHT / fits}px`;
  return fits;
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
        <h3>{sections[index].title}</h3>
        <div className="td-printed-text">
          <PrintedValue label="Организация" value={sections[index].organization} />
          <PrintedValue label="Цели / Насоки" value={sections[index].coaching} />
          {sections[index].description && <div className="td-printed-description">{sections[index].description}</div>}
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

export default function DocumentSheet({ content, pending }: { content: PlanContent; pending: boolean }) {
  const preview = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [screen, setScreen] = useState(1);
  const [fonts, setFonts] = useState(false);
  const [monochrome, setMonochrome] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [drawings, setDrawings] = useState<Record<number, { layout: Exercise; placement: string; status: DrawingStatus }>>({});
  const report: DrawingReport = useCallback((index, placement, layout, status) => {
    setDrawings((previous) => ({ ...previous, [index]: { layout, placement, status } }));
  }, []);

  useLayoutEffect(() => {
    if (sheet.current) setScale(fitSheet(sheet.current));
  }, [content, fonts]);

  useEffect(() => {
    let active = true;
    void document.fonts.ready.then(() => { if (active) setFonts(true); });
    const visible = preview.current;
    if (!visible) return;
    const observer = new ResizeObserver(([entry]) => setScreen(Math.min(1, entry.contentRect.width / WIDTH)));
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
  const failed = assetStates.includes("failed");
  const ready = !pending && fonts && scale > 0 && assetStates.every((status) => status === "ready");
  const style = {
    "--td-fit": scale || 1,
    "--td-screen": screen,
    "--td-preview-height": `${HEIGHT * screen}px`,
  } as CSSProperties;

  return <section className="td-print-area" id="td-print-preview" aria-label="Преглед за печат">
    <div className="td-print-toolbar">
      <h2>Преглед за печат <small>A4 · хоризонтално</small></h2>
      <div className="td-print-actions">
        <label className="td-print-mode">
          <input type="checkbox" checked={monochrome} onChange={(event) => {
            setDrawings({});
            setMonochrome(event.target.checked);
          }} />
          Черно-бял печат
        </label>
        <button className="tp-primary-btn" type="button" disabled={!ready} onClick={() => window.print()}>Печат</button>
      </div>
    </div>
    {failed && <div className="td-feedback" role="alert">
      Рисунките не могат да се подготвят за печат.
      <button type="button" className="tp-secondary-btn" onClick={() => { setDrawings({}); setAttempt((value) => value + 1); }}>Опитай отново</button>
    </div>}
    {!failed && !ready && <div className="td-print-loading" role="status" aria-label="Зареждане" aria-busy="true"><span aria-hidden="true" /></div>}
    {scale > 0 && scale < 0.82 && <p className="td-muted">Листът е смален, за да се побере на една страница.</p>}
    <div className="td-preview" ref={preview} style={style} data-print-ready={ready}>
      <div className={monochrome ? "td-paper td-paper-monochrome" : "td-paper"}>
        <div className="td-printed-sheet" ref={sheet}>
          <header className="td-printed-header">
            <h2>{content.session.title}</h2>
            <div>{[content.session.season, content.session.halfSeason].filter(Boolean).join(" · ") || "Спортно-състезателен сезон"}</div>
          </header>
          <div className="td-printed-row" key={`top:${attempt}:${monochrome}`}>
            <PrintedSections indices={[0]} sections={content.sections} monochrome={monochrome} onReport={report} />
            <PrintedSections indices={[1]} sections={content.sections} monochrome={monochrome} onReport={report} />
            <section className="td-printed-section td-printed-session">
              <h3>Данни за тренировката</h3>
              <div className="td-printed-text">
                {sessionFields.slice(3).map(([key, label]) => <PrintedValue key={key} label={label}
                  value={key === "date" ? content.session.date.split("-").reverse().join(".") : content.session[key]} />)}
              </div>
            </section>
          </div>
          <div className="td-printed-row" key={`bottom:${attempt}:${monochrome}`}>
            {bottom.map((indices) => <PrintedSections key={indices.join(":")} indices={indices} sections={content.sections} monochrome={monochrome} onReport={report} />)}
          </div>
        </div>
      </div>
    </div>
  </section>;
}
