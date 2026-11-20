"use client";

import { sessionUrl, type SessionTarget, type TrainingReference } from "@/lib/exercise/trainingSession";
import BackLink from "../BackLink";

import { useBrowserDialogs } from "@/components/admin/BrowserDialogProvider";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, Eye, FileText, PenLine, Plus, RefreshCw, Trash2 } from "lucide-react";
import { type CompetitionSeason, type DocumentSummary, type SavedDocument } from "@/lib/exercise/document";
import { DocumentCardContent, formatUpdated } from "./DocumentCard";
import FinanceSkeleton from "../../members/_components/FinanceSkeleton";
import DocumentEditor from "./DocumentEditor";
import { documentRequest, withCoachImages } from "./documentRequest";

const DocumentSheet = dynamic(() => import("./DocumentSheet"), {
  ssr: false, loading: () => <FinanceSkeleton variant="form" />,
});

const replaceQuery = (replace?: string) => replace ? `&replace=${replace}` : "";

type Page = { documents: DocumentSummary[]; nextCursor: string | null };

function DocumentListSkeleton() {
  return <div className="td-document-grid" role="status" aria-label="Зареждане" aria-busy="true">
    {[0, 1, 2].map((key) => <div key={key} className="td-document-card td-document-card--skeleton" aria-hidden="true">
      <span className="td-skeleton td-skeleton--title" />
      <span className="td-skeleton td-skeleton--meta" />
    </div>)}
  </div>;
}

/** Read-only preview of a plan before the coach links it to the training. */
function DocumentChoice({ item, coach, endpoint, context, clubLogoUrl, editHref, linking, error, onUse, onBack }: {
  item: DocumentSummary; coach: string | null; endpoint: string; context: string; clubLogoUrl?: string; editHref: string; linking: boolean; error: string; onUse: () => void; onBack: () => void;
}) {
  const [document, setDocument] = useState<SavedDocument>();
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useMemo(() => document && withCoachImages(document.content, coach), [document, coach]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    void documentRequest<{ document: SavedDocument }>(`${endpoint}/${item.id}`, "План-конспектът не може да се зареди.", { signal: abort.signal }, coach)
      .then(({ document }) => { if (!abort.signal.aborted) setDocument(document); })
      .catch((failure: Error) => { if (!abort.signal.aborted) setLoadError(failure.message); });
    return () => abort.abort();
  }, [endpoint, item.id, coach, attempt]);

  return <section aria-labelledby="td-choice-title">
    <header className="tp-header">
      <button type="button" className="tp-back-btn" disabled={linking} onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Към списъка</button>
      <div className="tp-heading">
        <h1 className="tp-title" id="td-choice-title" ref={heading} tabIndex={-1}><Eye aria-hidden="true" />{item.title}</h1>
        <p>{context}</p>
      </div>
      <div className="td-actions td-choice-actions">
        {linking || !document
          ? <button type="button" className="tp-secondary-btn" disabled><PenLine size={16} aria-hidden="true" />Редактирай</button>
          : <Link className="tp-secondary-btn" href={editHref}><PenLine size={16} aria-hidden="true" />Редактирай</Link>}
        <button type="button" className="tp-primary-btn" disabled={linking || !document} onClick={onUse}>
          <Check size={16} aria-hidden="true" />{linking ? "Добавяне…" : "Използвай този план-конспект"}
        </button>
      </div>
    </header>
    {error && <div role="alert" className="td-feedback">{error}</div>}
    <div className="td-workspace">
      {loadError
        ? <div role="alert" className="td-feedback">{loadError} <button type="button" className="tp-secondary-btn"
            onClick={() => { setLoadError(""); setAttempt((value) => value + 1); }}>Опитай отново</button></div>
        : content
          ? <DocumentSheet content={content} clubLogoUrl={clubLogoUrl} pending={false} printActions={false} />
          : <FinanceSkeleton variant="form" />}
    </div>
  </section>;
}

function DocumentList({ coach, endpoint, listHref, libraryHref, context, clubLogoUrl, location, target, replace }: { coach: string | null; endpoint: string; listHref: string; libraryHref: string; context: string; clubLogoUrl?: string; location: string; target?: SessionTarget; replace?: string }) {
  const dialogs = useBrowserDialogs();
  const [page, setPage] = useState<Page>();
  const [cursor, setCursor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const choose = Boolean(target);
  const [linking, setLinking] = useState(false);
  const [deleting, setDeleting] = useState<string>();
  const [chosen, setChosen] = useState<DocumentSummary>();

  useEffect(() => {
    const abort = new AbortController();
    const url = cursor ? `${endpoint}?cursor=${encodeURIComponent(cursor)}` : endpoint;
    void documentRequest<Page>(url, "План-конспектите не могат да се заредят.", { signal: abort.signal }, coach)
      .then(setPage)
      .catch((failure: Error) => { if (!abort.signal.aborted) setError(failure.message); });
    return () => abort.abort();
  }, [endpoint, cursor, attempt, coach]);

  function navigate(next: string | null) {
    setPage(undefined);
    setError("");
    setCursor(next);
    setAttempt((value) => value + 1);
  }

  async function linkDocument(id: string) {
    if (!target || linking) return;
    setLinking(true);
    setError("");
    try {
      await documentRequest(endpoint, "План-конспектът не може да се свърже.", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, linkDocumentId: id, ...(replace && { replaceDocumentId: replace }) }),
      }, coach);
      window.location.assign(libraryHref);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "План-конспектът не може да се свърже.");
      setLinking(false);
    }
  }

  async function remove(item: DocumentSummary) {
    if (deleting || !await dialogs.confirm(`Да изтрием ли „${item.title}“?`)) return;
    setDeleting(item.id);
    setError("");
    try {
      await documentRequest(`${endpoint}/${item.id}?revision=${item.revision}`, "План-конспектът не може да се изтрие.", {
        method: "DELETE",
      }, coach);
      navigate(cursor);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "План-конспектът не може да се изтрие.");
    } finally {
      setDeleting(undefined);
    }
  }

  if (chosen && target) return <DocumentChoice item={chosen} coach={coach} endpoint={endpoint} context={context} clubLogoUrl={clubLogoUrl}
    editHref={`${sessionUrl("documents", location, target, chosen.id)}&link=1${replaceQuery(replace)}`} linking={linking} error={error} onUse={() => void linkDocument(chosen.id)}
    onBack={() => { if (linking) return; setError(""); setChosen(undefined); }} />;

  return <>
    <header className="tp-header">
      <BackLink className="tp-back-btn" href={libraryHref}><ArrowLeft size={16} aria-hidden="true" /> Назад</BackLink>
      <div className="tp-heading">
        <h1 className="tp-title"><FileText aria-hidden="true" />План-конспекти</h1>
        <p>{context}</p>
      </div>
      <Link className="tp-primary-btn" href={choose ? listHref.replace("document=choose", "document=new") : `${listHref}&document=new`}><Plus size={16} aria-hidden="true" /> {choose ? "Създай нов план-конспект" : "Нов план-конспект"}</Link>
    </header>
    {choose && <h2>{replace ? "Избери друг план-конспект" : "Избери съществуващ план-конспект"}</h2>}
    {error && <div role="alert" className="td-feedback">
      {error} <button type="button" className="tp-secondary-btn" onClick={() => navigate(null)}>Обнови списъка</button>
    </div>}
    {!page && !error && <DocumentListSkeleton />}
    {page?.documents.length === 0 && <div className="tp-empty">Няма запазени план-конспекти на тази страница.</div>}
    {!!page?.documents.length && <ul className="td-document-grid">
      {page.documents.map((item) => {
        const card = <DocumentCardContent item={item} />;
        return <li key={item.id} className="td-document-card">
          {choose
              ? <button type="button" className="td-document-open" disabled={linking} aria-label={`Преглед на ${item.title}`} onClick={() => { setError(""); setChosen(item); }}>{card}</button>
              : <Link className="td-document-open" href={`${listHref}&document=${item.id}`}>{card}</Link>}
          <div className="td-document-footer">
            <time dateTime={item.updatedAt}><RefreshCw size={14} aria-hidden="true" />Обновен {formatUpdated(item.updatedAt)}</time>
            {!choose && <button className="tp-danger-btn" type="button" disabled={!!deleting}
              aria-label={deleting === item.id ? undefined : `Изтрий ${item.title}`} onClick={() => void remove(item)}>
              <Trash2 size={16} aria-hidden="true" />{deleting === item.id ? "Изтриване…" : "Изтрий"}
            </button>}
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

export default function DocumentWorkspace({ target, clubId, clubName, clubLogoUrl, groupName, competitionSeason, location, selected, link = false, replace }: {
  target?: SessionTarget; clubId: string; clubName: string; clubLogoUrl?: string; groupName?: string; competitionSeason: CompetitionSeason; location: string; selected?: string; link?: boolean;
  /** The plan that the coach replaces in the training. */
  replace?: string;
}) {
  const drawingEndpoint = `/api/admin/clubs/${clubId}/training-plans`;
  const coach = new URLSearchParams(location).get("coachGroupId");
  const endpoint = `${drawingEndpoint}/documents`;
  const listHref = `/admin/training-plans/documents?${location}`;
  const libraryHref = `/admin/training-plans?${location}`;
  const [loaded, setLoaded] = useState<SavedDocument>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const documentId = selected;
    if (!documentId || documentId === "new" || documentId === "choose") return;
    const abort = new AbortController();
    void documentRequest<{ document: SavedDocument }>(
      `${endpoint}/${documentId}`, "План-конспектът не може да се зареди.", { signal: abort.signal }, coach,
    ).then(async ({ document }) => {
      if (target) {
        const query = new URLSearchParams(location);
        for (const [key, value] of Object.entries(target)) query.set(key, value);
        const reference = await documentRequest<TrainingReference>(`${drawingEndpoint}/microcycles/session?${query}`,
          "Тренировката не може да се зареди.", { signal: abort.signal });
        if (reference.documentId !== document.id) {
          if (!link) throw new Error("План-конспектът не е за тази тренировка.");
          if (reference.occupied && reference.documentId !== (replace ?? null)) throw new Error("За тренировката вече има план-конспект.");
        }
      }
      if (!abort.signal.aborted) setLoaded(document);
    })
      .catch((failure: Error) => { if (!abort.signal.aborted) setError(failure.message); });
    return () => abort.abort();
  }, [selected, endpoint, attempt, coach, target, location, drawingEndpoint, link, replace]);

  const context = groupName ? `${clubName} · ${groupName}` : clubName;
  return <main className={`tp-page td-page${!selected || selected === "choose" ? " td-library" : ""}`}>
    <div className="tp-inner td-inner">
      {!selected && <DocumentList coach={coach} endpoint={endpoint} listHref={listHref} libraryHref={libraryHref} context={context} location={location} />}
      {selected === "choose" && target && <DocumentList target={target} coach={coach} endpoint={endpoint}
        listHref={`${sessionUrl("documents", location, target, "choose")}${replaceQuery(replace)}`} replace={replace}
        libraryHref={sessionUrl("microcycles", location, target)} context={context} clubLogoUrl={clubLogoUrl} location={location} />}
      {selected && selected !== "choose" && selected !== "new" && !loaded && <section aria-label="План-конспект">
        <header className="tp-header">
          {target
            ? link
              ? <Link replace scroll={false} className="tp-back-btn" href={`${sessionUrl("documents", location, target, "choose")}${replaceQuery(replace)}`}><ArrowLeft size={16} aria-hidden="true" /> Към списъка</Link>
              : <Link replace scroll={false} className="tp-back-btn" href={sessionUrl("microcycles", location, target)}><ArrowLeft size={16} aria-hidden="true" /> Към тренировката</Link>
            : <BackLink className="tp-back-btn" href={listHref}><ArrowLeft size={16} aria-hidden="true" /> Към план-конспектите</BackLink>}
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
      {(loaded || selected === "new") && <DocumentEditor target={target} clubId={clubId} clubLogoUrl={clubLogoUrl} initial={loaded} groupName={groupName} competitionSeason={competitionSeason} context={context} endpoint={endpoint}
        drawingEndpoint={drawingEndpoint} location={location} listHref={listHref} link={link} replace={replace} />}
    </div>
  </main>;
}
