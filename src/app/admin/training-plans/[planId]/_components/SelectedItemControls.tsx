"use client";

import { Copy, Minus, Plus, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { PlanItem } from "@/lib/trainingPlans";
import { EQUIPMENT_LABELS } from "../_utils/equipment";

export function SelectedItemControls({
  selectedItem,
  statusMessage,
  onRotateLeft,
  onRotateRight,
  onScaleDown,
  onScaleUp,
  onDuplicate,
  onDelete,
}: {
  selectedItem: PlanItem | null;
  statusMessage: string;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onScaleDown: () => void;
  onScaleUp: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <aside className="tpe-controls">
      <div>
        <h2>{selectedItem ? EQUIPMENT_LABELS[selectedItem.type] : "Избран елемент"}</h2>
        <p>
          {selectedItem
            ? `X ${Math.round(selectedItem.x * 100)}%, Y ${Math.round(selectedItem.y * 100)}%`
            : "Изберете елемент от терена."}
        </p>
      </div>
      <div className="tpe-controls-row">
        <button type="button" onClick={onRotateLeft} disabled={!selectedItem} title="Завърти наляво">
          <RotateCcw size={18} />
        </button>
        <button type="button" onClick={onRotateRight} disabled={!selectedItem} title="Завърти надясно">
          <RotateCw size={18} />
        </button>
        <button type="button" onClick={onScaleDown} disabled={!selectedItem} title="Намали">
          <Minus size={18} />
        </button>
        <button type="button" onClick={onScaleUp} disabled={!selectedItem} title="Увеличи">
          <Plus size={18} />
        </button>
        <button type="button" onClick={onDuplicate} disabled={!selectedItem} title="Дублирай">
          <Copy size={18} />
        </button>
        <button type="button" onClick={onDelete} disabled={!selectedItem} title="Изтрий">
          <Trash2 size={18} />
        </button>
      </div>
      {statusMessage && <p className="tpe-status">{statusMessage}</p>}
    </aside>
  );
}
