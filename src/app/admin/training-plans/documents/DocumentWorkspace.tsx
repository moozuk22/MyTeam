"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { DocumentSummary, SavedDocument } from "@/lib/exercise/document";
import FinanceSkeleton from "../../members/_components/FinanceSkeleton";
import DocumentEditor from "./DocumentEditor";
import { documentRequest } from "./documentRequest";

type Page = { documents: DocumentSummary[]; nextCursor: string | null };
const dateFormat = new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeZone: "Europe/Sofia" });

function DocumentList({ endpoint, listHref, libraryHref, context }: { endpoint: string; listHref: string; libraryHref: string; context: string }) {
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
    if (deleting || !window.confirm(`Да изтрием ли „${item.title}“?`)) return;
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
      <Link className="tp-back-btn" href={libraryHref}><ArrowLeft size={16} aria-hidden="true" /> Назад</Link>
      <div className="tp-heading">
        <h1 className="tp-title"><FileText aria-hidden="true" />План-конспекти</h1>
        <p>{context}</p>
      </div>
      <Link className="tp-primary-btn" href={`${listHref}&document=new`}><Plus size={16} aria-hidden="true" /> Нов план-конспект</Link>
    </header>
    {error && <div role="alert" className="td-feedback">
      {error} <button type="button" className="tp-secondary-btn" onClick={() => navigate(null)}>Обнови списъка</button>
    </div>}
    {!page && !error && <FinanceSkeleton />}
    {page?.documents.length === 0 && <div className="tp-empty">Няма запазени план-конспекти на тази страница.</div>}
    {page && <ul className="td-document-list">
      {page.documents.map((item) => <li key={item.id}>
        <Link href={`${listHref}&document=${item.id}`}>
          <strong>{item.title}</strong>
          <time dateTime={item.updatedAt}><RefreshCw size={14} aria-hidden="true" />{dateFormat.format(new Date(item.updatedAt))}</time>
        </Link>
        <button className="tp-danger-btn" type="button" disabled={!!deleting}
          aria-label={deleting === item.id ? undefined : `Изтрий ${item.title}`} onClick={() => void remove(item)}>
          <Trash2 size={16} aria-hidden="true" />{deleting === item.id ? "Изтриване…" : "Изтрий"}
        </button>
      </li>)}
    </ul>}
    {(cursor || page?.nextCursor) && <div className="td-actions">
      {cursor && <button type="button" className="tp-secondary-btn" disabled={!!deleting} onClick={() => navigate(null)}>Първа страница</button>}
      {page?.nextCursor && <button type="button" className="tp-secondary-btn" disabled={!!deleting} onClick={() => navigate(page.nextCursor)}>Следваща страница</button>}
    </div>}
  </>;
}

export default function DocumentWorkspace({ clubId, clubName, groupName, location, selected }: {
  clubId: string; clubName: string; groupName?: string; location: string; selected?: string;
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
  return <main className="tp-page td-page">
    <div className="tp-inner td-inner">
      {!selected && <DocumentList endpoint={endpoint} listHref={listHref} libraryHref={libraryHref} context={context} />}
      {selected && selected !== "new" && !loaded && <section aria-label="План-конспект">
        <header className="tp-header">
          <Link className="tp-back-btn" href={listHref}><ArrowLeft size={16} aria-hidden="true" /> Към план-конспектите</Link>
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
      {(loaded || selected === "new") && <DocumentEditor initial={loaded} groupName={groupName} context={context} endpoint={endpoint}
        drawingEndpoint={drawingEndpoint} location={location} listHref={listHref} />}
    </div>
  </main>;
}
