"use client";

import { useCallback, useEffect, useState } from "react";
import { type DriveItem, type ImportResult, type ImportStep, type ParsedPlayerRow } from "../_types/members-page-types";
import { FolderIcon, SheetFileIcon, SpinnerIcon, XIcon } from "./members-page-icons";

type ImportCustomGroup = { id: string; name: string };

const assignmentKey = (rowIndex: number, groupId: string) => `${rowIndex}:${groupId}`;

export function ImportFromSheetsModal({
  clubId,
  coachGroupId,
  onClose,
  onImported,
}: {
  clubId: string;
  coachGroupId?: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<ImportStep>("browse");
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const [driveItems, setDriveItems] = useState<{ folders: DriveItem[]; sheets: DriveItem[] } | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState("");
  const [selectedSheet, setSelectedSheet] = useState<DriveItem | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedPlayerRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const [customGroups, setCustomGroups] = useState<ImportCustomGroup[]>([]);
  const [customGroupsLoading, setCustomGroupsLoading] = useState(true);
  const [customGroupsError, setCustomGroupsError] = useState("");
  // Selected "row:group" pairs. A player can belong to several custom groups.
  const [assignments, setAssignments] = useState<Set<string>>(() => new Set());

  const loadCustomGroups = useCallback(async (signal?: AbortSignal) => {
    setCustomGroupsLoading(true);
    setCustomGroupsError("");
    try {
      const search = coachGroupId ? `?coachGroupId=${encodeURIComponent(coachGroupId)}` : "";
      const res = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/custom-training-groups${search}`, {
        cache: "no-store",
        signal,
      });
      if (!res.ok) throw new Error("Failed to load custom groups.");
      const data: unknown = await res.json();
      const groups = Array.isArray(data)
        ? data
            .map((item) => {
              const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
              return { id: String(raw.id ?? ""), name: String(raw.name ?? "").trim() };
            })
            .filter((group) => group.id && group.name)
        : [];
      setCustomGroups(groups);
    } catch {
      if (signal?.aborted) return;
      setCustomGroups([]);
      setCustomGroupsError("Персонализираните групи не можаха да се заредят.");
    } finally {
      if (!signal?.aborted) setCustomGroupsLoading(false);
    }
  }, [clubId, coachGroupId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadCustomGroups(controller.signal);
    return () => controller.abort();
  }, [loadCustomGroups]);

  // Auto-load root folder on mount
  useEffect(() => {
    void loadDriveFolder("root");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDriveFolder(folderId: string) {
    setDriveLoading(true);
    setDriveError("");
    try {
      const res = await fetch(`/api/admin/google/drive?folderId=${encodeURIComponent(folderId)}`);
      const data = (await res.json().catch(() => ({}))) as { folders?: DriveItem[]; sheets?: DriveItem[]; error?: string };
      if (!res.ok) {
        setDriveError(data.error ?? "Грешка при зареждане на Drive.");
        return;
      }
      setDriveItems({ folders: data.folders ?? [], sheets: data.sheets ?? [] });
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

  async function selectSheet(sheet: DriveItem) {
    setSelectedSheet(sheet);
    setAssignments(new Set());
    setPreviewLoading(true);
    setPreviewError("");
    setStep("preview");
    try {
      const res = await fetch(
        `/api/admin/members/import-sheets?spreadsheetId=${encodeURIComponent(sheet.id)}`,
      );
      const data = (await res.json()) as { rows?: ParsedPlayerRow[]; error?: string };
      if (!res.ok) {
        setPreviewError(data.error ?? "Грешка при четене на таблицата.");
        return;
      }
      setPreviewRows(data.rows ?? []);
    } catch {
      setPreviewError("Грешка при свързване.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runImport() {
    if (!selectedSheet) return;
    setStep("importing");
    setImportError("");
    try {
      const res = await fetch("/api/admin/members/import-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId: selectedSheet.id,
          clubId,
          ...(coachGroupId ? { coachGroupId } : {}),
          ...(groupAssignments.length > 0 ? { groupAssignments } : {}),
        }),
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) {
        setImportError(data.error ?? "Грешката при импортиране.");
        setStep("preview");
        return;
      }
      setImportResult(data);
      setStep("results");
      onImported();
    } catch {
      setImportError("Грешка при свързване.");
      setStep("preview");
    }
  }

  const isImportable = (row: ParsedPlayerRow) => !row.warning || Boolean(row.birthDateIso);
  const importableRows = previewRows.filter(isImportable);
  const validRowCount = importableRows.length;
  const visibleGroups = customGroupsError ? [] : customGroups;
  const groupAssignments = importableRows
    .map((row) => ({
      rowIndex: row.rowIndex,
      fullName: row.fullName,
      groupIds: visibleGroups.filter((group) => assignments.has(assignmentKey(row.rowIndex, group.id))).map((group) => group.id),
    }))
    .filter((entry) => entry.groupIds.length > 0);

  function toggleAssignment(rowIndex: number, groupId: string, checked: boolean) {
    setAssignments((prev) => {
      const next = new Set(prev);
      const key = assignmentKey(rowIndex, groupId);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleGroupForAll(groupId: string, checked: boolean) {
    setAssignments((prev) => {
      const next = new Set(prev);
      for (const row of importableRows) {
        const key = assignmentKey(row.rowIndex, groupId);
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  function groupSelectionCount(groupId: string) {
    return importableRows.filter((row) => assignments.has(assignmentKey(row.rowIndex, groupId))).length;
  }

  return (
    <div className="amp-overlay" onClick={step === "importing" ? undefined : onClose}>
      <div className="amp-modal amp-modal--import-sheets" onClick={(e) => e.stopPropagation()}>
        <div className="amp-modal-tint" aria-hidden="true" />
        <h2 className="amp-modal-title">
          <span className="amp-modal-title-gradient">Импорт от Google Sheets</span>
          <button className="amp-modal-close" onClick={onClose} aria-label="Затвори" disabled={step === "importing"}>
            <XIcon />
          </button>
        </h2>

        <div className="amp-modal-body">

          {/* ── Browse step ── */}
          {step === "browse" && (
            <div className="amp-import-browse">
              {/* Breadcrumb */}
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
                  {(!driveItems || (driveItems.folders.length === 0 && driveItems.sheets.length === 0)) && (
                    <p className="amp-empty" style={{ padding: "16px 0" }}>Няма папки или таблици тук.</p>
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
                  {driveItems?.sheets.map((sheet) => (
                    <button
                      key={sheet.id}
                      className="amp-drive-item amp-drive-item--sheet"
                      onClick={() => void selectSheet(sheet)}
                      type="button"
                    >
                      <SheetFileIcon />
                      <span>{sheet.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Preview step ── */}
          {step === "preview" && (
            <div className="amp-import-preview">
              <p className="amp-import-sheet-name">
                <SheetFileIcon />
                <strong>{selectedSheet?.name}</strong>
              </p>

              {(previewLoading || (customGroupsLoading && !previewError)) && (
                <div className="amp-import-loading">
                  <SpinnerIcon size={20} />
                  <span>Четене на таблицата...</span>
                </div>
              )}

              {previewError && <p className="amp-confirm-error">{previewError}</p>}

              {!previewLoading && !previewError && previewRows.length === 0 && (
                <p className="amp-empty">Не са намерени редове с данни.</p>
              )}

              {!previewLoading && !customGroupsLoading && !previewError && previewRows.length > 0 && (
                <>
                  <p className="amp-import-row-count">
                    {validRowCount} от {previewRows.length} реда ще бъдат импортирани
                    {previewRows.some((r) => r.warning) && (
                      <span className="amp-import-warn-count"> · {previewRows.filter((r) => r.warning).length} с предупреждения</span>
                    )}
                  </p>
                  {customGroupsError && (
                    <div className="amp-import-groups-error" role="alert">
                      <span>{customGroupsError} Можете да импортирате без групи.</span>
                      <button className="amp-btn amp-btn--ghost" type="button" onClick={() => void loadCustomGroups()}>
                        Опитай отново
                      </button>
                    </div>
                  )}
                  {visibleGroups.length > 0 && (
                    <p className="amp-import-groups-hint">
                      Отметнете персонализираните групи за всеки състезател. Отметката в заглавието избира всички.
                    </p>
                  )}
                  <div className="amp-preview-table-wrap">
                    <table className={`amp-preview-table${visibleGroups.length > 0 ? " amp-preview-table--groups" : ""}`}>
                      <thead>
                        <tr>
                          <th className="amp-preview-name-col">Ime</th>
                          {visibleGroups.map((group) => {
                            const selected = groupSelectionCount(group.id);
                            const allSelected = validRowCount > 0 && selected === validRowCount;
                            return (
                              <th key={group.id} className="amp-preview-group-col" scope="col">
                                <label className={`amp-import-group-check amp-import-group-check--head${allSelected ? " is-selected" : ""}`}>
                                  <input
                                    type="checkbox"
                                    className="amp-group-check-input"
                                    checked={allSelected}
                                    disabled={validRowCount === 0}
                                    ref={(input) => {
                                      if (input) input.indeterminate = selected > 0 && !allSelected;
                                    }}
                                    onChange={(e) => toggleGroupForAll(group.id, e.target.checked)}
                                    aria-label={`Всички в група ${group.name}`}
                                  />
                                  <span className="amp-group-check-box" aria-hidden="true" />
                                  <span className="amp-import-group-name">{group.name}</span>
                                </label>
                              </th>
                            );
                          })}
                          <th>Роден</th>
                          <th>№</th>
                          <th>Отбор</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => (
                          <tr key={row.rowIndex} className={row.warning ? "amp-preview-row--warn" : ""}>
                            <td className="amp-preview-name-col">{row.fullName}</td>
                            {visibleGroups.map((group) => {
                              const importable = isImportable(row);
                              const checked = importable && assignments.has(assignmentKey(row.rowIndex, group.id));
                              return (
                                <td key={group.id} className="amp-preview-group-col">
                                  {importable ? (
                                    <label className={`amp-import-group-check${checked ? " is-selected" : ""}`}>
                                      <input
                                        type="checkbox"
                                        className="amp-group-check-input"
                                        checked={checked}
                                        onChange={(e) => toggleAssignment(row.rowIndex, group.id, e.target.checked)}
                                        aria-label={`${row.fullName} в група ${group.name}`}
                                      />
                                      <span className="amp-group-check-box" aria-hidden="true" />
                                    </label>
                                  ) : (
                                    <span className="amp-preview-missing" aria-hidden="true">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td>{row.birthDateIso ? new Date(row.birthDateIso).toLocaleDateString("bg-BG") : <span className="amp-preview-missing">{row.warning ?? "—"}</span>}</td>
                            <td>{row.jerseyNumber ?? "—"}</td>
                            <td>{row.teamGroup ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {importError && <p className="amp-confirm-error" style={{ marginTop: 8 }}>{importError}</p>}

              <div className="amp-modal-actions" style={{ marginTop: 16 }}>
                <button
                  className="amp-btn amp-btn--ghost"
                  type="button"
                  onClick={() => { setStep("browse"); setPreviewError(""); setImportError(""); }}
                >
                  Назад
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  type="button"
                  onClick={() => void runImport()}
                  disabled={previewLoading || customGroupsLoading || validRowCount === 0}
                >
                  Импортирай {validRowCount > 0 ? `${validRowCount} състезателя` : ""}
                </button>
              </div>
            </div>
          )}

          {/* ── Importing step ── */}
          {step === "importing" && (
            <div className="amp-import-loading amp-import-loading--center">
              <SpinnerIcon size={28} />
              <span>Импортиране...</span>
            </div>
          )}

          {/* ── Results step ── */}
          {step === "results" && importResult && (
            <div className="amp-import-results">
              <div className="amp-import-result-stats">
                <div className="amp-import-stat amp-import-stat--created">
                  <span className="amp-import-stat-num">{importResult.created}</span>
                  <span className="amp-import-stat-lbl">Добавени</span>
                </div>
                <div className="amp-import-stat amp-import-stat--skipped">
                  <span className="amp-import-stat-num">{importResult.skipped}</span>
                  <span className="amp-import-stat-lbl">Пропуснати</span>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="amp-import-errors">
                  <button
                    className="amp-import-errors-toggle"
                    type="button"
                    onClick={() => setErrorsExpanded((v) => !v)}
                  >
                    {errorsExpanded ? "▲" : "▼"} {importResult.errors.length} грешки
                  </button>
                  {errorsExpanded && (
                    <ul className="amp-import-errors-list">
                      {importResult.errors.map((e) => (
                        <li key={e.row}>
                          <span className="amp-import-err-row">Ред {e.row}</span> {e.name} — {e.reason}
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
