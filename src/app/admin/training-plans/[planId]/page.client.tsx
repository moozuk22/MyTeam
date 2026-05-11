"use client";

import { PointerEvent as ReactPointerEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Circle,
  Copy,
  Flag,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Shapes,
  Type,
  Trash2,
  Users,
} from "lucide-react";
import {
  ALLOWED_EQUIPMENT_TYPES,
  EquipmentType,
  MAX_ITEMS,
  PlanItem,
  PlanLayout,
} from "@/lib/trainingPlans";
import "./editor.css";

type EditorPlan = {
  id: string;
  clubId: string;
  title: string;
  description: string | null;
  layout: PlanLayout;
  createdAt: string;
  updatedAt: string;
};

const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  cone: "Конус",
  ball: "Топка",
  balls: "Топки",
  "goal-small": "Малка врата",
  "goal-full": "Голяма врата",
  "goal-7m": "Врата 7м",
  "goal-5m": "Врата 5м",
  "goal-3m": "Врата 3м",
  "goal-1m": "Врата 1м",
  mannequin: "Манекен",
  marker: "Шапка червена",
  "marker-orange": "Шапка оранжева",
  "marker-blue": "Шапка синя",
  "marker-yellow": "Шапка жълта",
  pole: "Пилон",
  ladder: "Стълба",
  flag: "Колче",
  hurdle: "Препятствие",
  ring: "Обръч",
  run: "Бягане",
  "run-free": "Бягане свободно",
  dribble: "Дрибъл",
  "dribble-free": "Дрибъл свободно",
  pass: "Пас",
  "long-pass": "Дълъг пас",
  shot: "Удар",
  line: "Линия",
  "dashed-line": "Прекъсната линия",
  circle: "Кръг",
  "hatched-circle": "Кръгла зона",
  rectangle: "Правоъгълник",
  "hatched-rectangle": "Правоъгълна зона",
  triangle: "Триъгълник",
  "hatched-triangle": "Триъгълна зона",
  text: "Добави текст",
  "team1-coach": "Треньор",
  "team1-goalkeeper": "Вратар",
  "team1-player-1": "Играч 1",
  "team1-player-2": "Играч 2",
  "team1-player-more": "Играч 3-11",
  "team2-coach": "Треньор",
  "team2-goalkeeper": "Вратар",
  "team2-player-1": "Играч 1",
  "team2-player-2": "Играч 2",
  "team2-player-more": "Играч 3-11",
};

const TACTICAL_TYPES = new Set<EquipmentType>([
  "run",
  "run-free",
  "dribble",
  "dribble-free",
  "pass",
  "long-pass",
  "shot",
]);

const SHAPE_TYPES = new Set<EquipmentType>([
  "line",
  "dashed-line",
  "circle",
  "hatched-circle",
  "rectangle",
  "hatched-rectangle",
  "triangle",
  "hatched-triangle",
]);

const PLAYER_TYPES = new Set<EquipmentType>([
  "team1-coach",
  "team1-goalkeeper",
  "team1-player-1",
  "team1-player-2",
  "team1-player-more",
  "team2-coach",
  "team2-goalkeeper",
  "team2-player-1",
  "team2-player-2",
  "team2-player-more",
]);

const FREEHAND_TYPES = new Set<EquipmentType>(["run-free", "dribble-free"]);

const BALL_GOAL_TYPES: EquipmentType[] = ["ball", "balls", "goal-7m", "goal-5m", "goal-3m", "goal-1m"];
const AID_TYPES: EquipmentType[] = [
  "cone",
  "ladder",
  "flag",
  "hurdle",
  "ring",
  "mannequin",
  "marker",
  "marker-orange",
  "marker-blue",
  "marker-yellow",
];

const TOOLBAR_GROUPS: Array<{
  title: string;
  shortLabel?: string;
  icon: "movement" | "ball" | "aids" | "shapes" | "text" | "team1" | "team2";
  types: EquipmentType[];
}> = [
  {
    title: "Движения",
    icon: "movement",
    types: ALLOWED_EQUIPMENT_TYPES.filter((type) => TACTICAL_TYPES.has(type)),
  },
  {
    title: "Топки и врати",
    icon: "ball",
    types: BALL_GOAL_TYPES,
  },
  {
    title: "Пособия",
    icon: "aids",
    types: AID_TYPES,
  },
  {
    title: "Линии и полета",
    icon: "shapes",
    types: ALLOWED_EQUIPMENT_TYPES.filter((type) => SHAPE_TYPES.has(type)),
  },
  {
    title: "Текст",
    icon: "text",
    types: ["text"],
  },
  {
    title: "Отбор 1",
    shortLabel: "T1",
    icon: "team1",
    types: ["team1-coach", "team1-goalkeeper", "team1-player-1", "team1-player-2", "team1-player-more"],
  },
  {
    title: "Отбор 2",
    shortLabel: "T2",
    icon: "team2",
    types: ["team2-coach", "team2-goalkeeper", "team2-player-1", "team2-player-2", "team2-player-more"],
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function createItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isTeam2Type(type: EquipmentType) {
  return type.startsWith("team2-");
}

function getPlayerText(type: EquipmentType) {
  if (type.endsWith("-coach")) return "Т";
  if (type.endsWith("-goalkeeper")) return "В";
  if (type.endsWith("-player-1")) return "1";
  if (type.endsWith("-player-2")) return "2";
  if (type.endsWith("-player-more")) return "...";
  return "";
}

function getDefaultFill(type: EquipmentType) {
  if (type === "marker-orange") return "#e38501";
  if (type === "marker-blue") return "#5084b4";
  if (type === "marker-yellow") return "#f9cb15";
  if (type === "marker") return "#ce0000";
  if (isTeam2Type(type)) return "#00C";
  if (PLAYER_TYPES.has(type)) return "#C00";
  return undefined;
}

function getDefaultText(type: EquipmentType) {
  if (type === "text") return "Текст";
  if (PLAYER_TYPES.has(type)) return getPlayerText(type);
  return undefined;
}

function getNormalizedDrawPoint(surface: SVGSVGElement, clientX: number, clientY: number) {
  const rect = surface.getBoundingClientRect();
  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp((clientY - rect.top) / rect.height, 0, 1),
  };
}

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

function DrawnTacticalItem({
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

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  const scaled = points.map((point) => ({ x: point.x * 100, y: point.y * 100 }));
  if (scaled.length < 2) return "";
  let path = `M ${scaled[0].x} ${scaled[0].y}`;
  for (let index = 1; index < scaled.length; index += 1) {
    const previous = scaled[index - 1];
    const current = scaled[index];
    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;
    path += ` Q ${previous.x} ${previous.y}, ${midX} ${midY}`;
  }
  const last = scaled[scaled.length - 1];
  path += ` T ${last.x} ${last.y}`;
  return path;
}

function buildArrowHeadPath(previous: { x: number; y: number }, current: { x: number; y: number }) {
  const x1 = previous.x * 100;
  const y1 = previous.y * 100;
  const x2 = current.x * 100;
  const y2 = current.y * 100;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return "";

  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const size = 2.8;
  const width = 1.8;
  const baseX = x2 - ux * size;
  const baseY = y2 - uy * size;
  const leftX = baseX + px * width;
  const leftY = baseY + py * width;
  const rightX = baseX - px * width;
  const rightY = baseY - py * width;

  return `M ${x2} ${y2} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`;
}

function ItemVisual({ type, item }: { type: EquipmentType; item?: PlanItem }) {
  if (TACTICAL_TYPES.has(type)) return <TacticalIcon type={type} />;
  if (PLAYER_TYPES.has(type) || type === "text") return <span className="tpe-item-text">{item?.text ?? getDefaultText(type)}</span>;
  return null;
}

function CategoryThumb({
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

export default function TrainingPlanEditorClient({
  clubId,
  plan,
}: {
  clubId: string;
  plan: EditorPlan;
}) {
  const router = useRouter();
  const [layout, setLayout] = useState<PlanLayout>(plan.layout);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [openToolMenu, setOpenToolMenu] = useState<string | null>(null);
  const [activeDrawTool, setActiveDrawTool] = useState<EquipmentType | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const drawSurfaceRef = useRef<SVGSVGElement>(null);
  const dragState = useRef<{ itemId: string; offsetX: number; offsetY: number } | null>(null);
  const drawState = useRef<{ itemId: string; startX: number; startY: number; isFreehand: boolean; lastX: number; lastY: number } | null>(null);
  const activeDrawToolRef = useRef<EquipmentType | null>(null);

  const selectedItem = useMemo(
    () => layout.items.find((item) => item.id === selectedItemId) ?? null,
    [layout.items, selectedItemId],
  );

  useEffect(() => {
    function handlePitchPointerMove(e: PointerEvent) {
      if (drawState.current && drawSurfaceRef.current) {
        const point = getNormalizedDrawPoint(drawSurfaceRef.current, e.clientX, e.clientY);
        if (drawState.current.isFreehand) {
          const distance = Math.hypot(point.x - drawState.current.lastX, point.y - drawState.current.lastY);
          if (distance >= 0.006) {
            drawState.current.lastX = point.x;
            drawState.current.lastY = point.y;
            appendItemPoint(drawState.current.itemId, point.x, point.y);
          }
        } else {
          updateItemEndpoint(drawState.current.itemId, point.x, point.y);
        }
        return;
      }

      if (!dragState.current || !pitchRef.current) return;
      const rect = pitchRef.current.getBoundingClientRect();
      const left = rect.left + pitchRef.current.clientLeft;
      const top = rect.top + pitchRef.current.clientTop;
      const x = clamp((e.clientX - left - dragState.current.offsetX) / pitchRef.current.clientWidth, 0, 1);
      const y = clamp((e.clientY - top - dragState.current.offsetY) / pitchRef.current.clientHeight, 0, 1);
      updateItemPosition(dragState.current.itemId, x, y);
    }

    function handlePitchPointerUp() {
      if (drawState.current) {
        const { itemId, startX, startY } = drawState.current;
        drawState.current = null;
        setLayout((current) => {
          const item = current.items.find((candidate) => candidate.id === itemId);
          const endX = item?.endX ?? startX;
          const endY = item?.endY ?? startY;
          const distance = Math.hypot(endX - startX, endY - startY);
          if (distance < 0.015) {
            return { ...current, items: current.items.filter((candidate) => candidate.id !== itemId) };
          }
          return current;
        });
      }
      dragState.current = null;
    }

    window.addEventListener("pointermove", handlePitchPointerMove);
    window.addEventListener("pointerup", handlePitchPointerUp);
    window.addEventListener("pointercancel", handlePitchPointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePitchPointerMove);
      window.removeEventListener("pointerup", handlePitchPointerUp);
      window.removeEventListener("pointercancel", handlePitchPointerUp);
    };
  }, []);

  useEffect(() => {
    activeDrawToolRef.current = activeDrawTool;
  }, [activeDrawTool]);

  useEffect(() => {
    function warnIfDirty(event: BeforeUnloadEvent) {
      if (!isDirty) return;
      event.preventDefault();
    }

    window.addEventListener("beforeunload", warnIfDirty);
    return () => window.removeEventListener("beforeunload", warnIfDirty);
  }, [isDirty]);

  function markLayout(nextLayout: PlanLayout) {
    setLayout(nextLayout);
    setIsDirty(true);
    setStatusMessage("");
  }

  function updateItemPosition(itemId: string, x: number, y: number) {
    setLayout((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, x, y } : item)),
    }));
    setIsDirty(true);
    setStatusMessage("");
  }

  function updateItemEndpoint(itemId: string, endX: number, endY: number) {
    setLayout((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, endX, endY } : item)),
    }));
    setIsDirty(true);
    setStatusMessage("");
  }

  function appendItemPoint(itemId: string, x: number, y: number) {
    setLayout((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) return item;
        const points = item.points ?? [{ x: item.x, y: item.y }];
        if (points.length >= 300) return { ...item, endX: x, endY: y };
        return { ...item, endX: x, endY: y, points: [...points, { x, y }] };
      }),
    }));
    setIsDirty(true);
    setStatusMessage("");
  }

  function updateSelectedItem(update: (item: PlanItem) => PlanItem) {
    if (!selectedItemId) return;
    markLayout({
      ...layout,
      items: layout.items.map((item) => (item.id === selectedItemId ? update(item) : item)),
    });
  }

  function handleItemPointerDown(e: ReactPointerEvent<HTMLDivElement>, itemId: string) {
    if (!pitchRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = pitchRef.current.getBoundingClientRect();
    const left = rect.left + pitchRef.current.clientLeft;
    const top = rect.top + pitchRef.current.clientTop;
    const item = layout.items.find((candidate) => candidate.id === itemId);
    if (!item) return;
    dragState.current = {
      itemId,
      offsetX: e.clientX - (left + item.x * pitchRef.current.clientWidth),
      offsetY: e.clientY - (top + item.y * pitchRef.current.clientHeight),
    };
    setSelectedItemId(itemId);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function addItem(type: EquipmentType) {
    if (layout.items.length >= MAX_ITEMS) {
      setStatusMessage(`Максимумът е ${MAX_ITEMS} елемента.`);
      return;
    }

    const item: PlanItem = {
      id: createItemId(),
      type,
      x: 0.5,
      y: 0.5,
      rotation: 0,
      scale: type === "goal-full" || type === "goal-7m" ? 1.25 : 1,
      fill: getDefaultFill(type),
      text: getDefaultText(type),
    };
    markLayout({ ...layout, items: [...layout.items, item] });
    setSelectedItemId(item.id);
  }

  function selectTool(type: EquipmentType) {
    if (TACTICAL_TYPES.has(type)) {
      setActiveDrawTool(type);
      setStatusMessage(`${EQUIPMENT_LABELS[type]}: плъзнете върху терена, за да начертаете.`);
      return;
    }

    setActiveDrawTool(null);
    addItem(type);
  }

  function handlePitchPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pitchRef.current || !drawSurfaceRef.current || !activeDrawToolRef.current) {
      setSelectedItemId(null);
      return;
    }

    if (layout.items.length >= MAX_ITEMS) {
      setStatusMessage(`Максимумът е ${MAX_ITEMS} елемента.`);
      return;
    }

    e.preventDefault();
    const { x, y } = getNormalizedDrawPoint(drawSurfaceRef.current, e.clientX, e.clientY);
    const item: PlanItem = {
      id: createItemId(),
      type: activeDrawToolRef.current,
      x,
      y,
      endX: x,
      endY: y,
      points: FREEHAND_TYPES.has(activeDrawToolRef.current) ? [{ x, y }] : undefined,
      rotation: 0,
      scale: 1,
      fill: "#111111",
    };
    drawState.current = {
      itemId: item.id,
      startX: x,
      startY: y,
      isFreehand: FREEHAND_TYPES.has(activeDrawToolRef.current),
      lastX: x,
      lastY: y,
    };
    markLayout({ ...layout, items: [...layout.items, item] });
    setSelectedItemId(item.id);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function duplicateSelected() {
    if (!selectedItem) return;
    if (layout.items.length >= MAX_ITEMS) {
      setStatusMessage(`Максимумът е ${MAX_ITEMS} елемента.`);
      return;
    }
    const clone = {
      ...selectedItem,
      id: createItemId(),
      x: clamp(selectedItem.x + 0.04, 0, 1),
      y: clamp(selectedItem.y + 0.04, 0, 1),
      endX: typeof selectedItem.endX === "number" ? clamp(selectedItem.endX + 0.04, 0, 1) : selectedItem.endX,
      endY: typeof selectedItem.endY === "number" ? clamp(selectedItem.endY + 0.04, 0, 1) : selectedItem.endY,
      points: selectedItem.points?.map((point) => ({
        x: clamp(point.x + 0.04, 0, 1),
        y: clamp(point.y + 0.04, 0, 1),
      })),
    };
    markLayout({ ...layout, items: [...layout.items, clone] });
    setSelectedItemId(clone.id);
  }

function deleteSelected() {
    if (!selectedItemId) return;
    markLayout({ ...layout, items: layout.items.filter((item) => item.id !== selectedItemId) });
    setSelectedItemId(null);
  }

  function changeSelectedText() {
    if (!selectedItem || (selectedItem.type !== "text" && !PLAYER_TYPES.has(selectedItem.type))) return;
    const nextText = window.prompt("Нов текст", selectedItem.text ?? "");
    if (nextText === null) return;
    updateSelectedItem((item) => ({ ...item, text: nextText.trim().slice(0, 40) || item.text }));
  }

  function changeSelectedFill(fill: string) {
    if (!selectedItem) return;
    updateSelectedItem((item) => ({ ...item, fill }));
  }

  async function save() {
    setIsSaving(true);
    setStatusMessage("");
    try {
      const res = await fetch(`/api/admin/clubs/${clubId}/training-plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Грешка при запис.");
      setIsDirty(false);
      setStatusMessage("Запазено.");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Грешка при запис.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="tpe-page">
      <header className="tpe-header">
        <button
          className="tpe-icon-text-btn"
          type="button"
          onClick={() => router.push(`/admin/training-plans?clubId=${encodeURIComponent(clubId)}`)}
        >
          <ArrowLeft size={18} />
          <span>Планове</span>
        </button>
        <div className="tpe-title-block">
          <h1>{plan.title}</h1>
          {plan.description && <p>{plan.description}</p>}
        </div>
        <button className="tpe-save-btn" type="button" onClick={() => void save()} disabled={isSaving || !isDirty}>
          <Save size={18} />
          <span>{isSaving ? "Запазване..." : isDirty ? "Запази" : "Запазено"}</span>
        </button>
      </header>

      <div className="tpe-workspace">
        <aside className="tpe-toolbar" aria-label="Оборудване и движения" onMouseLeave={() => setOpenToolMenu(null)}>
          {TOOLBAR_GROUPS.map((group) => (
            <div className={`tpe-tool-category${openToolMenu === group.title ? " is-open" : ""}`} key={group.title}>
              <button
                className="tpe-category-thumb"
                type="button"
                title={group.title}
                aria-label={group.title}
                onClick={() => setOpenToolMenu((current) => (current === group.title ? null : group.title))}
                onMouseEnter={() => setOpenToolMenu(group.title)}
              >
                <CategoryThumb group={group} />
              </button>
              <div className="tpe-tools-menu">
                {group.types.map((type) => (
                  <button
                    className={`tpe-tool-btn${TACTICAL_TYPES.has(type) ? " tpe-tool-btn--tactical" : ""}${activeDrawTool === type ? " is-active" : ""}`}
                    key={type}
                    type="button"
                    onClick={() => {
                      selectTool(type);
                      setOpenToolMenu(null);
                    }}
                    title={EQUIPMENT_LABELS[type]}
                    aria-label={EQUIPMENT_LABELS[type]}
                  >
                    <span className={`tpe-tool-icon tpe-item--${type}`}>
                      <ItemVisual type={type} item={{ id: "preview", type, x: 0, y: 0, rotation: 0, scale: 1, fill: getDefaultFill(type), text: getDefaultText(type) }} />
                    </span>
                    <span>{EQUIPMENT_LABELS[type]}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="tpe-toolbar-action" type="button" disabled={!selectedItem} onClick={deleteSelected}>
            Изтриване
          </button>
          <button className="tpe-toolbar-action" type="button" disabled={!selectedItem} onClick={duplicateSelected}>
            Копиране
          </button>
          <div className="tpe-tool-category">
            <button
              className="tpe-category-thumb tpe-category-thumb--color"
              type="button"
              title="Смени цвета"
              onClick={() => setOpenToolMenu((current) => (current === "color" ? null : "color"))}
              onMouseEnter={() => setOpenToolMenu("color")}
            >
              Color
            </button>
            <div className={`tpe-tools-menu tpe-tools-menu--swatches${openToolMenu === "color" ? " is-open" : ""}`}>
              {["#ff00e5", "#840be3", "#f9cb15", "#32cd32", "#e38501", "#5084b4", "#ce0000", "#CCC", "#000"].map((fill) => (
                <button
                  key={fill}
                  className="tpe-color-swatch"
                  type="button"
                  disabled={!selectedItem}
                  onClick={() => {
                    changeSelectedFill(fill);
                    setOpenToolMenu(null);
                  }}
                  style={{ backgroundColor: fill }}
                  aria-label={`Цвят ${fill}`}
                />
              ))}
            </div>
          </div>
          <button className="tpe-toolbar-action" type="button" disabled={!selectedItem || (selectedItem.type !== "text" && !PLAYER_TYPES.has(selectedItem.type))} onClick={changeSelectedText}>
            Смени текста
          </button>
        </aside>

        <section className="tpe-canvas-area">
          <div className="tpe-pitch-wrap">
            <div
              ref={pitchRef}
              className="tpe-pitch"
              style={{ aspectRatio: "3/2" }}
              onPointerDown={handlePitchPointerDown}
            >
              <div className="tpe-pitch-lines" aria-hidden="true">
                <span className="tpe-pitch-center-circle" />
                <span className="tpe-pitch-center-spot" />
                <span className="tpe-pitch-box tpe-pitch-box--left" />
                <span className="tpe-pitch-box tpe-pitch-box--right" />
                <span className="tpe-pitch-goal tpe-pitch-goal--left" />
                <span className="tpe-pitch-goal tpe-pitch-goal--right" />
              </div>
              <svg
                ref={drawSurfaceRef}
                className="tpe-drawn-tactical-layer"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {layout.items
                  .filter((item) => TACTICAL_TYPES.has(item.type) && typeof item.endX === "number" && typeof item.endY === "number")
                  .map((item) => (
                    <DrawnTacticalItem
                      key={item.id}
                      item={item}
                      isSelected={selectedItemId === item.id}
                      onSelect={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedItemId(item.id);
                      }}
                    />
                  ))}
              </svg>
              {layout.items.filter((item) => !(TACTICAL_TYPES.has(item.type) && typeof item.endX === "number" && typeof item.endY === "number")).map((item) => (
                <div
                  key={item.id}
                  className={`tpe-item tpe-item--${item.type}${TACTICAL_TYPES.has(item.type) ? " tpe-item--tactical" : ""} ${selectedItemId === item.id ? "tpe-item--selected" : ""}`}
                  style={{
                    left: `${item.x * 100}%`,
                    top: `${item.y * 100}%`,
                    color: item.fill,
                    transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`,
                  }}
                  onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                  title={EQUIPMENT_LABELS[item.type]}
                >
                  <ItemVisual type={item.type} item={item} />
                </div>
              ))}
            </div>
          </div>

          <SelectedItemControls
            selectedItem={selectedItem}
            statusMessage={statusMessage}
            onRotateLeft={() => updateSelectedItem((item) => ({ ...item, rotation: clamp(item.rotation - 15, -360, 360) }))}
            onRotateRight={() => updateSelectedItem((item) => ({ ...item, rotation: clamp(item.rotation + 15, -360, 360) }))}
            onScaleDown={() => updateSelectedItem((item) => ({ ...item, scale: Number(clamp(item.scale - 0.1, 0.5, 3).toFixed(2)) }))}
            onScaleUp={() => updateSelectedItem((item) => ({ ...item, scale: Number(clamp(item.scale + 0.1, 0.5, 3).toFixed(2)) }))}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
          />
        </section>
      </div>
    </main>
  );
}

function SelectedItemControls({
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
