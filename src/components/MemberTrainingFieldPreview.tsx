import type { TrainingSessionItem } from "@/app/member/[cardCode]/_types/member-types";
import { normalizeTrainingFieldType } from "@/app/member/[cardCode]/_utils/member-display";
import {
  getFieldBackground,
  renderFieldMarkings,
} from "@/app/admin/members/_components/TrainingFieldPreview";

type TrainingField = Pick<
  TrainingSessionItem,
  "trainingFieldName" | "trainingFieldType" | "trainingFieldPieces" | "trainingFieldPieceNames"
>;

export function MemberTrainingFieldPreview({
  field,
  clubSport,
}: {
  field: TrainingField;
  clubSport?: string | null;
}) {
  if (!field.trainingFieldName) return null;

  const selectedPieces = field.trainingFieldPieceNames ?? [];
  const wholeFieldSelected = selectedPieces.length === 0;
  const pieces = field.trainingFieldPieces?.length
    ? field.trainingFieldPieces
    : wholeFieldSelected
      ? ["Цял терен"]
      : selectedPieces;
  const fieldType = normalizeTrainingFieldType(field.trainingFieldType, clubSport);

  return (
    <div className="member-training-field-visual">
      <div className="member-training-field-name">
        {field.trainingFieldName}
      </div>
      <div
        className={`member-training-field-pitch member-training-field-pitch--${fieldType}`}
        style={{
          gridTemplateColumns: `repeat(${pieces.length}, minmax(0, 1fr))`,
          background: getFieldBackground(fieldType),
        }}
        role="group"
        aria-label={`Терен ${field.trainingFieldName}`}
      >
        {renderFieldMarkings(fieldType)}
        {pieces.map((piece, index) => {
          const selected = wholeFieldSelected || selectedPieces.includes(piece);
          return (
            <div
              key={`${piece}-${index}`}
              className={`member-training-field-piece${selected ? " member-training-field-piece--selected" : ""}`}
            >
              <span>{piece}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
