"use client";

import { useEffect, useMemo } from "react";
import {
  CUSTOM_TRAINING_GROUP_COLOR_PALETTE,
  isCustomTrainingGroupPaletteColor,
} from "@/lib/customTrainingGroupColors";
import { type CustomTrainingGroup } from "../_types/members-page-types";

export function CustomTrainingGroupColorPicker({
  value,
  onChange,
  disabled,
  groups,
  excludeGroupId,
}: {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  groups: Pick<CustomTrainingGroup, "id" | "color">[];
  excludeGroupId?: string;
}) {
  const availableColors = useMemo(() => {
    const usedColors = new Set(
      groups
        .filter(
          (g) => isCustomTrainingGroupPaletteColor(g.color) && (!excludeGroupId || g.id !== excludeGroupId),
        )
        .map((g) => g.color),
    );
    return CUSTOM_TRAINING_GROUP_COLOR_PALETTE.filter((hex) => !usedColors.has(hex));
  }, [groups, excludeGroupId]);

  useEffect(() => {
    if (!disabled && availableColors.length > 0 && !availableColors.some((hex) => hex === value)) {
      onChange(availableColors[0]);
    }
  }, [availableColors, disabled, onChange, value]);

  return (
    <div className="amp-edit-field" style={{ marginTop: 10 }}>
      <span className="amp-lbl">Цвят на групата</span>
      <div className="amp-custom-group-color-swatches" role="radiogroup" aria-label="Цвят на групата">
        {availableColors.map((hex) => {
          const isSelected = value === hex;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Цвят ${hex}`}
              disabled={disabled}
              className={`amp-custom-group-color-swatch${isSelected ? " is-selected" : ""}`}
              style={{
                backgroundColor: hex,
                ...(hex === "#FAFAFA" && !isSelected ? { borderColor: "rgba(0,0,0,0.35)" } : {}),
              }}
              onClick={() => onChange(hex)}
            />
          );
        })}
      </div>
    </div>
  );
}
