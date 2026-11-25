const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ASSIGNMENTS = 5000;
const MAX_GROUPS_PER_ROW = 100;

/** The preview row data that identifies the player, plus the selected groups. */
export type SheetImportGroupAssignment = {
  rowIndex: number;
  fullName: string;
  birthDateIso: string | null;
  jerseyNumber: string | null;
  groupIds: string[];
};

function optionalString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

export class SheetImportGroupError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Validates the custom-group assignments sent with a Google Sheets import.
 * Rows without groups are dropped. Returns assignments keyed by sheet row.
 */
export function parseSheetImportGroupAssignments(raw: unknown): Map<number, SheetImportGroupAssignment> {
  const result = new Map<number, SheetImportGroupAssignment>();
  if (raw == null) return result;
  if (!Array.isArray(raw) || raw.length > MAX_ASSIGNMENTS) {
    throw new SheetImportGroupError("Невалидно разпределение по групи.", 400);
  }
  for (const item of raw) {
    const entry = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null;
    const rowIndex = entry?.rowIndex;
    const fullName = typeof entry?.fullName === "string" ? entry.fullName.trim() : "";
    const birthDateIso = optionalString(entry?.birthDateIso);
    const jerseyNumber = optionalString(entry?.jerseyNumber);
    const groupIdsRaw = entry?.groupIds;
    if (
      typeof rowIndex !== "number" || !Number.isInteger(rowIndex) || rowIndex < 2 ||
      !fullName || birthDateIso === undefined || jerseyNumber === undefined ||
      !Array.isArray(groupIdsRaw) || groupIdsRaw.length > MAX_GROUPS_PER_ROW ||
      result.has(rowIndex)
    ) {
      throw new SheetImportGroupError("Невалидно разпределение по групи.", 400);
    }
    const groupIds = Array.from(new Set(groupIdsRaw.map((value) => String(value ?? "").trim())));
    if (groupIds.some((id) => !UUID_REGEX.test(id))) {
      throw new SheetImportGroupError("Невалидна персонализирана група.", 400);
    }
    if (groupIds.length > 0) result.set(rowIndex, { rowIndex, fullName, birthDateIso, jerseyNumber, groupIds });
  }
  return result;
}

/**
 * Makes sure each assignment still points at the same player in the sheet,
 * so a sheet edited after the preview cannot put a player in the wrong group.
 * Name, birth date and jersey number are compared, so same-named players
 * that changed rows are also detected.
 */
export function assertGroupAssignmentsMatchRows(
  assignments: Map<number, SheetImportGroupAssignment>,
  rows: Array<{ rowIndex: number; fullName: string; birthDateIso: string | null; jerseyNumber: string | null }>,
) {
  const rowsByIndex = new Map(rows.map((row) => [row.rowIndex, row]));
  for (const assignment of assignments.values()) {
    const row = rowsByIndex.get(assignment.rowIndex);
    if (
      !row ||
      row.fullName !== assignment.fullName ||
      row.birthDateIso !== assignment.birthDateIso ||
      row.jerseyNumber !== assignment.jerseyNumber
    ) {
      throw new SheetImportGroupError(
        "Таблицата е променена след прегледа. Върнете се назад и я отворете отново.",
        409,
      );
    }
  }
}

export function collectAssignedGroupIds(assignments: Map<number, SheetImportGroupAssignment>): string[] {
  const ids = new Set<string>();
  for (const assignment of assignments.values()) {
    for (const id of assignment.groupIds) ids.add(id);
  }
  return [...ids];
}
