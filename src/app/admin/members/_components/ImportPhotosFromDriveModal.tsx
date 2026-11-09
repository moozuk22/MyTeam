"use client";

import { useEffect, useState } from "react";
import { type DriveItem, type PhotoImportResult, type PhotoImportStep } from "../_types/members-page-types";
import { FolderIcon, PhotoImportIcon, SpinnerIcon, XIcon } from "./members-page-icons";

export function ImportPhotosFromDriveModal({
  clubId,
  onClose,
  onImported,
}: {
  clubId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<PhotoImportStep>("browse");
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const [driveItems, setDriveItems] = useState<{ folders: DriveItem[]; sheets: DriveItem[]; images: DriveItem[] } | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [importResult, setImportResult] = useState<PhotoImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const [detailsExpanded, setDetailsExpanded] = useState<"unmatched" | "ambiguous" | "failed" | null>(null);

  useEffect(() => {
    void loadDriveFolder("root");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDriveFolder(folderId: string) {
    setDriveLoading(true);
    setDriveError("");
    try {
      const res = await fetch(`/api/admin/google/drive?folderId=${encodeURIComponent(folderId)}&mode=photos`);
      const data = (await res.json().catch(() => ({}))) as { folders?: DriveItem[]; sheets?: DriveItem[]; images?: DriveItem[]; error?: string };
      if (!res.ok) {
        setDriveError(data.error ?? "Грешка при зареждане на Drive.");
        return;
      }
      setDriveItems({ folders: data.folders ?? [], sheets: [], images: data.images ?? [] });
    } catch {
      setDriveError("Грешка при свързване.");
    } finally {
      setDriveLoading(false);
    }
  }

  function navigateIntoFolder(folder: DriveItem) {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
    void loadDriveFolder(folder.id);
  }

  function navigateToStackIndex(index: number) {
    const newStack = folderStack.slice(0, index);
    setFolderStack(newStack);
    const folderId = newStack.length > 0 ? newStack[newStack.length - 1].id : "root";
    void loadDriveFolder(folderId);
  }

  function selectCurrentFolder() {
    if (folderStack.length === 0) return;
    const current = folderStack[folderStack.length - 1];
    setSelectedFolder(current);
    setStep("confirm");
  }

  async function runImport(overwriteExisting: boolean) {
    if (!selectedFolder) return;
    setStep("importing");
    setImportError("");
    try {
      const res = await fetch("/api/admin/members/import-drive-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: selectedFolder.id, clubId, overwrite: overwriteExisting }),
      });
      const data = (await res.json()) as PhotoImportResult & { error?: string };
      if (!res.ok) {
        setImportError(data.error ?? "Грешка при импортиране.");
        setStep("confirm");
        return;
      }
      setImportResult(data);
      setStep("results");
      onImported();
    } catch {
      setImportError("Грешка при свързване.");
      setStep("confirm");
    }
  }

  return (
    <div className="amp-overlay" onClick={step === "importing" ? undefined : onClose}>
      <div className="amp-modal amp-modal--import-sheets" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Импорт на снимки от Google Drive</span>
          <button className="amp-modal-close" onClick={onClose} aria-label="Затвори" disabled={step === "importing"}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">

          {/* ── Browse step ── */}
          {step === "browse" && (
            <div className="amp-import-browse">
              <div className="amp-drive-breadcrumb">
                <button
                  className="amp-drive-crumb"
                  onClick={() => navigateToStackIndex(0)}
                  type="button"
                >
                  My Drive
                </button>
                {folderStack.map((folder, idx) => (
                  <span key={folder.id} className="amp-drive-crumb-sep">
                    <span className="amp-drive-crumb-arrow">›</span>
                    <button
                      className="amp-drive-crumb"
                      onClick={() => navigateToStackIndex(idx + 1)}
                      type="button"
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>

              {driveError && <p className="amp-confirm-error" style={{ margin: "8px 0" }}>{driveError}</p>}

              {driveLoading ? (
                <div className="amp-import-loading">
                  <SpinnerIcon size={20} />
                  <span>Зареждане...</span>
                </div>
              ) : (
                <div className="amp-drive-list">
                  {(!driveItems || (driveItems.folders.length === 0 && driveItems.images.length === 0)) && (
                    <p className="amp-empty" style={{ padding: "16px 0" }}>Няма папки или снимки тук.</p>
                  )}
                  {driveItems?.folders.map((folder) => (
                    <button
                      key={folder.id}
                      className="amp-drive-item amp-drive-item--folder"
                      onClick={() => navigateIntoFolder(folder)}
                      type="button"
                    >
                      <FolderIcon />
                      <span>{folder.name}</span>
                    </button>
                  ))}
                  {driveItems?.images.map((img) => (
                    <div
                      key={img.id}
                      className="amp-drive-item amp-drive-item--file"
                    >
                      <PhotoImportIcon size={14} />
                      <span>{img.name}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="amp-modal-actions" style={{ marginTop: 16 }}>
                <button
                  className="amp-btn amp-btn--primary"
                  type="button"
                  onClick={selectCurrentFolder}
                  disabled={folderStack.length === 0 || driveLoading}
                >
                  Избери тази папка
                </button>
              </div>
            </div>
          )}

          {/* ── Confirm step ── */}
          {step === "confirm" && selectedFolder && (
            <div className="amp-import-preview">
              <p className="amp-import-folder-name">
                <FolderIcon />
                <strong>{selectedFolder.name}</strong>
              </p>
              <p className="amp-import-confirm-hint">
                Снимките в тази папка ще бъдат съпоставени с състезателите по име на файл.
              </p>

              {importError && <p className="amp-confirm-error" style={{ marginTop: 8 }}>{importError}</p>}

              <div className="amp-modal-actions amp-import-photo-actions" style={{ marginTop: 16 }}>
                <button
                  className="amp-btn amp-btn--ghost"
                  type="button"
                  onClick={() => { setStep("browse"); setImportError(""); }}
                >
                  Назад
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  type="button"
                  onClick={() => void runImport(false)}
                >
                  Импортирай снимките
                </button>
                <button
                  className="amp-btn amp-btn--danger"
                  type="button"
                  onClick={() => void runImport(true)}
                >
                  Презапиши снимките
                </button>
              </div>
            </div>
          )}

          {/* ── Importing step ── */}
          {step === "importing" && (
            <div className="amp-import-loading amp-import-loading--center">
              <SpinnerIcon size={28} />
              <span>Импортиране на снимки...</span>
            </div>
          )}

          {/* ── Results step ── */}
          {step === "results" && importResult && (
            <div className="amp-import-results">
              <div className="amp-import-result-stats amp-import-result-stats--wrap">
                <div className="amp-import-stat amp-import-stat--created">
                  <span className="amp-import-stat-num">{importResult.updated}</span>
                  <span className="amp-import-stat-lbl">Обновени</span>
                </div>
                <div className="amp-import-stat amp-import-stat--skipped">
                  <span className="amp-import-stat-num">{importResult.skippedExisting}</span>
                  <span className="amp-import-stat-lbl">Пропуснати</span>
                </div>
                <div className="amp-import-stat amp-import-stat--warning">
                  <span className="amp-import-stat-num">{importResult.unmatched}</span>
                  <span className="amp-import-stat-lbl">Несъвпадащи</span>
                </div>
                {importResult.failedUploads > 0 && (
                  <div className="amp-import-stat amp-import-stat--error">
                    <span className="amp-import-stat-num">{importResult.failedUploads}</span>
                    <span className="amp-import-stat-lbl">Грешки</span>
                  </div>
                )}
              </div>

              {importResult.details.unmatchedFiles.length > 0 && (
                <div className="amp-import-errors amp-import-errors--warning">
                  <button
                    className="amp-import-errors-toggle"
                    type="button"
                    onClick={() => setDetailsExpanded((v) => v === "unmatched" ? null : "unmatched")}
                  >
                    {detailsExpanded === "unmatched" ? "▲" : "▼"} {importResult.details.unmatchedFiles.length} несъвпадащи файла
                  </button>
                  {detailsExpanded === "unmatched" && (
                    <ul className="amp-import-errors-list">
                      {importResult.details.unmatchedFiles.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {importResult.details.ambiguousFiles.length > 0 && (
                <div className="amp-import-errors amp-import-errors--warning">
                  <button
                    className="amp-import-errors-toggle"
                    type="button"
                    onClick={() => setDetailsExpanded((v) => v === "ambiguous" ? null : "ambiguous")}
                  >
                    {detailsExpanded === "ambiguous" ? "▲" : "▼"} {importResult.details.ambiguousFiles.length} двусмислени файла
                  </button>
                  {detailsExpanded === "ambiguous" && (
                    <ul className="amp-import-errors-list">
                      {importResult.details.ambiguousFiles.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {importResult.details.failedFiles.length > 0 && (
                <div className="amp-import-errors">
                  <button
                    className="amp-import-errors-toggle"
                    type="button"
                    onClick={() => setDetailsExpanded((v) => v === "failed" ? null : "failed")}
                  >
                    {detailsExpanded === "failed" ? "▲" : "▼"} {importResult.details.failedFiles.length} неуспешни качвания
                  </button>
                  {detailsExpanded === "failed" && (
                    <ul className="amp-import-errors-list">
                      {importResult.details.failedFiles.map((f) => (
                        <li key={f.fileName}>
                          <span className="amp-import-err-row">{f.fileName}</span> — {f.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="amp-modal-actions" style={{ marginTop: 16 }}>
                <button className="amp-btn amp-btn--primary" type="button" onClick={onClose}>
                  Затвори
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
