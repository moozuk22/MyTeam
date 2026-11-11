"use client";

import { PointerEvent as ReactPointerEvent, useId } from "react";
import { Circle, Flag, Shapes, Type, Users } from "lucide-react";
import { EquipmentType, PlanItem } from "@/lib/trainingPlans";
import { TACTICAL_TYPES, PLAYER_TYPES, TOOLBAR_GROUPS, getDefaultText } from "../_utils/equipment";
import { buildSmoothPath, buildArrowHeadPath } from "../_utils/geometry";

function TacticalIcon({ type }: { type: EquipmentType }) {
  const markerId = useId().replace(/:/g, "");
  const isFree = type === "run-free" || type === "dribble-free";
  const isDribble = type === "dribble" || type === "dribble-free";
  const isLongPass = type === "long-pass";
  const isShot = type === "shot";
  const isCurved = type === "run" || type === "run-free";

  if (!TACTICAL_TYPES.has(type)) return null;

  const mainPath = isDribble
    ? "M5 34 C14 20 20 46 30 30 C40 14 45 38 58 18"
    : isCurved
      ? "M5 36 C18 30 19 14 34 13 C45 12 48 8 58 5"
      : isLongPass
        ? "M5 36 L60 8"
        : "M7 34 L58 8";

  return (
    <svg className="tpe-tactical-svg" viewBox="0 0 68 44" aria-hidden="true" focusable="false">
      <defs>
        <marker id={markerId} markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" />
        </marker>
      </defs>
      <path
        className={`tpe-tactical-path${isFree ? " tpe-tactical-path--dashed" : ""}${isShot ? " tpe-tactical-path--shot" : ""}`}
        d={mainPath}
        markerEnd={`url(#${markerId})`}
      />
      {isShot && !isFree && (
        <path className="tpe-tactical-path tpe-tactical-path--shot-secondary" d="M9 39 L49 13" markerEnd={`url(#${markerId})`} />
      )}
    </svg>
  );
}

export function DrawnTacticalItem({
  item,
  isSelected,
  onSelect,
}: {
  item: PlanItem;
  isSelected: boolean;
  onSelect: (event: ReactPointerEvent<SVGPathElement>) => void;
}) {
  const isFree = item.type === "run-free" || item.type === "dribble-free";
  const isDribble = item.type === "dribble" || item.type === "dribble-free";
  const isShot = item.type === "shot";
  const freehandPoints = isFree ? item.points ?? [] : [];
  const endX = item.endX ?? item.x;
  const endY = item.endY ?? item.y;
  const x1 = item.x * 100;
  const y1 = item.y * 100;
  const x2 = endX * 100;
  const y2 = endY * 100;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const curve = isDribble ? 10 : 0;
  const cx1 = x1 + dx * 0.32 - dy * curve / 100;
  const cy1 = y1 + dy * 0.32 + dx * curve / 100;
  const cx2 = x1 + dx * 0.68 + dy * curve / 100;
  const cy2 = y1 + dy * 0.68 - dx * curve / 100;
  const path = freehandPoints.length > 1
    ? buildSmoothPath(freehandPoints)
    : isDribble
      ? `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
      : `M ${x1} ${y1} L ${x2} ${y2}`;
  const arrowHead = buildArrowHeadPath(
    freehandPoints.length > 1 ? freehandPoints[freehandPoints.length - 2] : { x: item.x, y: item.y },
    freehandPoints.length > 1 ? freehandPoints[freehandPoints.length - 1] : { x: endX, y: endY },
  );

  return (
    <g style={{ color: item.fill }}>
      <path
        className={`tpe-drawn-tactical-path${isFree ? " tpe-drawn-tactical-path--dashed" : ""}${isShot ? " tpe-drawn-tactical-path--shot" : ""}${isSelected ? " is-selected" : ""}`}
        d={path}
        onPointerDown={onSelect}
      />
      {arrowHead && (
        <path
          className={`tpe-drawn-arrowhead${isSelected ? " is-selected" : ""}`}
          d={arrowHead}
          onPointerDown={onSelect}
        />
      )}
      {isShot && (
        <path
          className={`tpe-drawn-tactical-path tpe-drawn-tactical-path--shot-secondary${isSelected ? " is-selected" : ""}`}
          d={`M ${x1 + dx * 0.04} ${y1 + dy * 0.04} L ${x2 - dx * 0.18} ${y2 - dy * 0.18}`}
          onPointerDown={onSelect}
        />
      )}
    </g>
  );
}

export function ItemVisual({ type, item }: { type: EquipmentType; item?: PlanItem }) {
  if (TACTICAL_TYPES.has(type)) return <TacticalIcon type={type} />;
  if (PLAYER_TYPES.has(type) || type === "text") return <span className="tpe-item-text">{item?.text ?? getDefaultText(type)}</span>;
  return null;
}

export function CategoryThumb({
  group,
}: {
  group: (typeof TOOLBAR_GROUPS)[number];
}) {
  if (group.shortLabel) {
    return <span className={`tpe-category-team tpe-category-team--${group.icon}`}>{group.shortLabel}</span>;
  }

  if (group.icon === "movement") return <TacticalIcon type="run" />;
  if (group.icon === "ball") return <Circle size={24} />;
  if (group.icon === "aids") return <Flag size={24} />;
  if (group.icon === "shapes") return <Shapes size={24} />;
  if (group.icon === "text") return <Type size={24} />;
  return <Users size={24} />;
}
