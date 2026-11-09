"use client";

import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { EquipmentType, MAX_ITEMS, PlanItem, PlanLayout } from "@/lib/trainingPlans";
import { EQUIPMENT_LABELS, TACTICAL_TYPES, PLAYER_TYPES, FREEHAND_TYPES, TOOLBAR_GROUPS, getDefaultFill, getDefaultText } from "./_utils/equipment";
import { clamp, getNormalizedDrawPoint } from "./_utils/geometry";
import { DrawnTacticalItem, ItemVisual, CategoryThumb } from "./_components/TacticalVisuals";
import { SelectedItemControls } from "./_components/SelectedItemControls";
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

function createItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
