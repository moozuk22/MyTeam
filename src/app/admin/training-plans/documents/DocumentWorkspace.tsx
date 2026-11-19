"use client";

import BackLink from "../BackLink";

import { useBrowserDialogs } from "@/components/admin/BrowserDialogProvider";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, FileText, Image as ImageIcon, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { type CompetitionSeason, type DocumentPreview, type DocumentSummary, type SavedDocument } from "@/lib/exercise/document";
import FinanceSkeleton from "../../members/_components/FinanceSkeleton";
import DocumentEditor from "./DocumentEditor";
import { documentRequest } from "./documentRequest";

type Page = { documents: DocumentSummary[]; nextCursor: string | null };
const dateFormat = new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeZone: "Europe/Sofia" });

const months = ["ЯНУ", "ФЕВ", "МАР", "АПР", "МАЙ", "ЮНИ", "ЮЛИ", "АВГ", "СЕП", "ОКТ", "НОЕ", "ДЕК"];

/** Calendar tile with the training date, or a document icon when there is no valid date. */
function DateTile({ preview }: { preview: DocumentPreview | null }) {
  const match = preview && /^(\d{4})-(\d{2})-(\d{2})$/.exec(preview.date);
  const month = match ? months[Number(match[2]) - 1] : undefined;
  if (!match || !month) return <span className="td-date td-date--empty" aria-hidden="true"><FileText /></span>;
  return <span className="td-date">
    <span className="td-date-month" aria-hidden="true">{month}</span>
    <span className="td-date-day" aria-hidden="true">{Number(match[3])}</span>
    <span className="td-date-time" aria-hidden="true">{preview.time || match[1]}</span>
    <span className="td-sr-only">{`${match[3]}.${match[2]}.${match[1]} г.${preview.time ? `, ${preview.time} ч.` : ""}`}</span>
  </span>;
}

function DocumentListSkeleton() {
  return <div className="td-document-grid" role="status" aria-label="Зареждане" aria-busy="true">
    {[0, 1, 2].map((key) => <div key={key} className="td-document-card td-document-card--skeleton" aria-hidden="true">
      <span className="td-skeleton td-skeleton--title" />
      <span className="td-skeleton td-skeleton--meta" />
    </div>)}
  </div>;
}

function DocumentList({ endpoint, listHref, libraryHref, context }: { endpoint: string; listHref: string; libraryHref: string; context: string }) {
  const dialogs = useBrowserDialogs();
  const [page, setPage] = useState<Page>();
  const [cursor, setCursor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string>();

  useEffect(() => {
    const abort = new AbortController();
    const url = cursor ? `${endpoint}?cursor=${encodeURIComponent(cursor)}` : endpoint;
    void documentRequest<Page>(url, "План-конспектите не могат да се заредят.", { signal: abort.signal })
      .then(setPage)
      .catch((failure: Error) => { if (!abort.signal.aborted) setError(failure.message); });
    return () => abort.abort();
  }, [endpoint, cursor, attempt]);

  function navigate(next: string | null) {
    setPage(undefined);
    setError("");
    setCursor(next);
    setAttempt((value) => value + 1);
  }

  async function remove(item: DocumentSummary) {
    if (deleting || !await dialogs.confirm(`Да изтрием ли „${item.title}“?`)) return;
    setDeleting(item.id);
    setError("");
    try {
      await documentRequest(`${endpoint}/${item.id}?revision=${item.revision}`, "План-конспектът не може да се изтрие.", {
        method: "DELETE",
      });
      navigate(cursor);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "План-конспектът не може да се изтрие.");
    } finally {
      setDeleting(undefined);
    }
  }

  return <>
    <header className="tp-header">
      <BackLink className="tp-back-btn" href={libraryHref}><ArrowLeft size={16} aria-hidden="true" /> Назад</BackLink>
      <div className="tp-heading">
        <h1 className="tp-title"><FileText aria-hidden="true" />План-конспекти</h1>
        <p>{context}</p>
      </div>
      <Link className="tp-primary-btn" href={`${listHref}&document=new`}><Plus size={16} aria-hidden="true" /> Нов план-конспект</Link>
    </header>
    {error && <div role="alert" className="td-feedback">
      {error} <button type="button" className="tp-secondary-btn" onClick={() => navigate(null)}>Обнови списъка</button>
    </div>}
    {!page && !error && <DocumentListSkeleton />}
    {page?.documents.length === 0 && <div className="tp-empty">Няма запазени план-конспекти на тази страница.</div>}
    {!!page?.documents.length && <ul className="td-document-grid">
      {page.documents.map((item) => {
        const preview = item.preview ?? null;
        const who = [preview?.day, preview?.group, preview?.coach].filter(Boolean).join(" · ");
        const tags = [
          preview?.sessionNumber && `Тренировка № ${preview.sessionNumber}`,
          preview?.microcycle && `Микроцикъл ${preview.microcycle}`,
          preview?.period,
        ].filter(Boolean) as string[];
        const stats = [
          preview?.duration && { icon: Clock, label: "Времетраене", value: `${preview.duration} мин.` },
          preview && { icon: ImageIcon, label: "Рисунки", value: `${preview.drawings} от 5` },
          preview?.playerCount && { icon: Users, label: "Състезатели", value: preview.playerCount },
        ].filter(Boolean) as { icon: typeof Clock; label: string; value: string }[];
        return <li key={item.id} className="td-document-card">
          <Link className="td-document-open" href={`${listHref}&document=${item.id}`}>
            <span className="td-document-top">
              <DateTile preview={preview} />
              <span className="td-document-name">
                <strong>{item.title}</strong>
                {who && <span className="td-document-who">{who}</span>}
              </span>
            </span>
            {!!tags.length && <span className="td-document-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</span>}
            {preview?.gameMoment && <span className="td-document-detail">
              <span className="td-document-label">Момент от играта</span>
              <span className="td-document-moment">{preview.gameMoment}</span>
            </span>}
            {preview?.objective && <span className="td-document-detail">
              <span className="td-document-label">Цел на тренировката</span>
              <span className="td-document-goal">{preview.objective}</span>
            </span>}
            {!!stats.length && <span className="td-document-stats">
              {stats.map(({ icon: Icon, label, value }) => <span key={label} className="td-stat">
                <Icon size={15} aria-hidden="true" />
                <span><span className="td-stat-label">{label}</span><span className="td-stat-value">{value}</span></span>
              </span>)}
            </span>}
          </Link>
          <div className="td-document-footer">
            <time dateTime={item.updatedAt}><RefreshCw size={14} aria-hidden="true" />Обновен {dateFormat.format(new Date(item.updatedAt))}</time>
            <button className="tp-danger-btn" type="button" disabled={!!deleting}
              aria-label={deleting === item.id ? undefined : `Изтрий ${item.title}`} onClick={() => void remove(item)}>
              <Trash2 size={16} aria-hidden="true" />{deleting === item.id ? "Изтриване…" : "Изтрий"}
            </button>
          </div>
        </li>;
      })}
    </ul>}
    {(cursor || page?.nextCursor) && <div className="td-actions">
      {cursor && <button type="button" className="tp-secondary-btn" disabled={!!deleting} onClick={() => navigate(null)}>Първа страница</button>}
      {page?.nextCursor && <button type="button" className="tp-secondary-btn" disabled={!!deleting} onClick={() => navigate(page.nextCursor)}>Следваща страница</button>}
    </div>}
  </>;
}

export default function DocumentWorkspace({ clubId, clubName, clubLogoUrl, groupName, competitionSeason, location, selected }: {
  clubId: string; clubName: string; clubLogoUrl?: string; groupName?: string; competitionSeason: CompetitionSeason; location: string; selected?: string;
}) {
  const drawingEndpoint = `/api/admin/clubs/${clubId}/training-plans`;
  const endpoint = `${drawingEndpoint}/documents`;
  const listHref = `/admin/training-plans/documents?${location}`;
  const libraryHref = `/admin/training-plans?${location}`;
  const [loaded, setLoaded] = useState<SavedDocument>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!selected || selected === "new") return;
    const abort = new AbortController();
    void documentRequest<{ document: SavedDocument }>(
      `${endpoint}/${selected}`, "План-конспектът не може да се зареди.", { signal: abort.signal },
    ).then(({ document }) => setLoaded(document))
      .catch((failure: Error) => { if (!abort.signal.aborted) setError(failure.message); });
    return () => abort.abort();
  }, [selected, endpoint, attempt]);

  const context = groupName ? `${clubName} · ${groupName}` : clubName;
  return <main className={`tp-page td-page${!selected ? " td-library" : ""}`}>
    <div className="tp-inner td-inner">
      {!selected && <DocumentList endpoint={endpoint} listHref={listHref} libraryHref={libraryHref} context={context} />}
      {selected && selected !== "new" && !loaded && <section aria-label="План-конспект">
        <header className="tp-header">
          <BackLink className="tp-back-btn" href={listHref}><ArrowLeft size={16} aria-hidden="true" /> Към план-конспектите</BackLink>
          <div className="tp-heading">
            <h1 className="tp-title"><FileText aria-hidden="true" />План-конспект</h1>
            <p>{context}</p>
          </div>
        </header>
        {error
          ? <div role="alert" className="td-feedback">{error} <button type="button" className="tp-secondary-btn"
              onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Опитай отново</button></div>
          : <FinanceSkeleton variant="form" />}
      </section>}
      {(loaded || selected === "new") && <DocumentEditor clubId={clubId} clubLogoUrl={clubLogoUrl} initial={loaded} groupName={groupName} competitionSeason={competitionSeason} context={context} endpoint={endpoint}
        drawingEndpoint={drawingEndpoint} location={location} listHref={listHref} />}
    </div>
  </main>;
}
