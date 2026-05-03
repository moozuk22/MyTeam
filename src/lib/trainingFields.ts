import { prisma } from "@/lib/db";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TrainingFieldSelection {
  trainingFieldId: string | null;
  trainingFieldPieceIds: string[];
}

export type TrainingFieldSelectionsByDate = Record<string, TrainingFieldSelection>;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseTrainingFieldSelection(input: {
  trainingFieldId: unknown;
  trainingFieldPieceIds: unknown;
}): TrainingFieldSelection {
  const fieldId = String(input.trainingFieldId ?? "").trim();

  if (fieldId && !UUID_REGEX.test(fieldId)) {
    throw new Error("Invalid training field.");
  }

  const rawPieceIds = Array.isArray(input.trainingFieldPieceIds)
    ? input.trainingFieldPieceIds
    : [];

  const pieceIds: string[] = [];
  for (const raw of rawPieceIds) {
    const pieceId = String(raw ?? "").trim();
    if (!pieceId) continue;
    if (!UUID_REGEX.test(pieceId)) {
      throw new Error("Invalid training field piece.");
    }
    if (!pieceIds.includes(pieceId)) {
      pieceIds.push(pieceId);
    }
  }

  return {
    trainingFieldId: fieldId || null,
    trainingFieldPieceIds: pieceIds,
  };
}

export function parseTrainingFieldSelectionsByDate(input: {
  trainingFieldSelections: unknown;
  trainingDates: string[];
  fallback?: TrainingFieldSelection;
}): TrainingFieldSelectionsByDate {
  const allowedDates = new Set(input.trainingDates);
  const result: TrainingFieldSelectionsByDate = {};

  if (input.trainingFieldSelections && typeof input.trainingFieldSelections === "object" && !Array.isArray(input.trainingFieldSelections)) {
    for (const [date, rawSelection] of Object.entries(input.trainingFieldSelections as Record<string, unknown>)) {
      if (!ISO_DATE_REGEX.test(date) || !allowedDates.has(date)) {
        throw new Error("Training field selections contain date outside selected training days.");
      }
      const source = rawSelection && typeof rawSelection === "object" && !Array.isArray(rawSelection)
        ? rawSelection as Record<string, unknown>
        : {};
      result[date] = parseTrainingFieldSelection({
        trainingFieldId: source.trainingFieldId,
        trainingFieldPieceIds: source.trainingFieldPieceIds,
      });
    }
  }

  for (const date of input.trainingDates) {
    if (!result[date] && input.fallback?.trainingFieldId) {
      result[date] = {
        trainingFieldId: input.fallback.trainingFieldId,
        trainingFieldPieceIds: input.fallback.trainingFieldPieceIds,
      };
    }
  }

  return result;
}

export function normalizeStoredTrainingFieldSelections(
  raw: unknown,
  trainingDates: string[],
  fallback?: TrainingFieldSelection,
): TrainingFieldSelectionsByDate {
  try {
    return parseTrainingFieldSelectionsByDate({
      trainingFieldSelections: raw,
      trainingDates,
      fallback,
    });
  } catch {
    return {};
  }
}

export async function verifyTrainingFieldSelection(
  clubId: string,
  selection: TrainingFieldSelection,
): Promise<void> {
  if (!selection.trainingFieldId) {
    if (selection.trainingFieldPieceIds.length > 0) {
      throw new Error("Select a field for the selected field pieces.");
    }
    return;
  }

  const field = await prisma.field.findFirst({
    where: { id: selection.trainingFieldId, clubId },
    select: {
      id: true,
      pieces: {
        select: { id: true },
      },
    },
  });
  if (!field) {
    throw new Error("Selected field was not found.");
  }

  const fieldPieceIds = new Set(field.pieces.map((p) => p.id));
  for (const pieceId of selection.trainingFieldPieceIds) {
    if (!fieldPieceIds.has(pieceId)) {
      throw new Error("Selected field piece does not belong to the selected field.");
    }
  }
}

export async function verifyTrainingFieldSelectionsByDate(
  clubId: string,
  selections: TrainingFieldSelectionsByDate,
): Promise<void> {
  for (const selection of Object.values(selections)) {
    await verifyTrainingFieldSelection(clubId, selection);
  }
}

export async function clubHasTrainingFields(clubId: string): Promise<boolean> {
  const count = await prisma.field.count({
    where: { clubId },
    take: 1,
  });
  return count > 0;
}
