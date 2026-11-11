"use client";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { countEquipment, FOOTBALL } from "@/lib/exercise/football";
import {
  HEIGHT,
  CUSTOM_TEAM_COLOR_ERROR,
  MAX_TEXT_FONT_SIZE,
  WIDTH,
  addCustomTeam,
  createObject,
  getCustomTeamColors,
  isCustomTeamColor,
  isMovementType,
  isZoneType,
  removeCustomTeam,
  textFontSize,
  validateExercise,
  type Exercise,
  type ExerciseObject,
  type ExerciseTool,
} from "@/lib/exercise/model";
import {
  arrowheadPoints,
  commit,
  duplicateObject,
  movementPoints,
  shotShafts,
  redo,
  undo,
  type History,
} from "@/lib/exercise/geometry";
import {
  draftKey,
  readDraft,
  sameExercise,
  type RecoveryDraft,
} from "@/lib/exercise/drafts";
import { MAX_ITEMS } from "@/lib/trainingPlans";
import Canvas from "./Canvas";
import { EquipmentPreview } from "./Visuals";
import { measurePitchText } from "./textLayout";

const EQUIPMENT_LABELS = FOOTBALL.labels;
const TOOLBAR_GROUPS = FOOTBALL.tools;
const TEXT_CATEGORY = TOOLBAR_GROUPS.findIndex((group) => group.types[0] === "text");
const TEAM_COLOR_SUGGESTIONS = ["#facc15", "#a855f7", "#fb923c", "#22d3ee", "#f472b6", "#a3e635"];
const DRAWING_MODES = [
  { value: "straight", label: "Право" },
  { value: "curve", label: "Крива с ръкохватка" },
  { value: "freehand", label: "Свободна ръка" },
] as const;

function ObjectColorInput({
  color,
  onCommit,
}: {
  color: string;
  onCommit: (color: string, group: symbol, preview: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const group = useRef<symbol | undefined>(undefined);
  const frame = useRef(0);
  const commitColor = useEffectEvent(onCommit);
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const onInput = () => {
      group.current ??= Symbol();
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        if (group.current) commitColor(input.value, group.current, true);
      });
    };
    const finish = () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      commitColor(input.value, group.current ?? Symbol(), false);
      group.current = undefined;
    };
    const finishIfAdjusting = () => {
      if (group.current) finish();
    };
    input.addEventListener("input", onInput);
    input.addEventListener("change", finish);
    input.addEventListener("blur", finishIfAdjusting);
    input.addEventListener("click", finishIfAdjusting);
    return () => {
      cancelAnimationFrame(frame.current);
      input.removeEventListener("input", onInput);
      input.removeEventListener("change", finish);
      input.removeEventListener("blur", finishIfAdjusting);
      input.removeEventListener("click", finishIfAdjusting);
    };
  }, []);
  useEffect(() => {
    const input = ref.current;
    if (input && !frame.current && input.value !== color) input.value = color;
  }, [color]);

  return (
    <input
      ref={ref}
      type="color"
      aria-label="Цвят"
      title="Цвят"
      defaultValue={color}
    />
  );
}

function ObjectActions({
  object,
  editLabelOnMount,
  onColorChange,
  onLabelChange,
  onDuplicate,
  onRemove,
  onReorder,
  canDuplicate,
  canMoveBack,
  canMoveForward,
}: {
  object: ExerciseObject;
  editLabelOnMount: boolean;
  onColorChange: (color: string, group: symbol, preview: boolean) => void;
  onLabelChange: (label: string, fontSize?: number) => boolean;
  onDuplicate: () => void;
  onRemove: () => void;
  onReorder: (delta: number) => void;
  canDuplicate: boolean;
  canMoveBack: boolean;
  canMoveForward: boolean;
}) {
  const [editingLabel, setEditingLabel] = useState(editLabelOnMount);
  const [expanded, setExpanded] = useState(false);
  const textInputId = useId();
  const editButton = useRef<HTMLButtonElement>(null);
  const labelInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const isText = object.kind === "text";
  const editTitle =
    object.kind === "player" ? "Редактирай номер" : "Редактирай текст";

  useEffect(() => {
    if (!editingLabel) return;
    const frame = requestAnimationFrame(() => {
      const input = textInput.current ?? labelInput.current;
      input?.focus({ preventScroll: true });
      input?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editingLabel]);

  function closeLabelEditor() {
    setEditingLabel(false);
    setExpanded(false);
    requestAnimationFrame(() => editButton.current?.focus());
  }

  if (editingLabel) {
    return (
      <form
        className={isText ? "ke-object-label ke-object-label--text" : "ke-object-label"}
        data-expanded={isText && expanded ? "true" : undefined}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const label = data.get("label");
          if (typeof label !== "string") return;
          if (isText && !label.trim()) {
            textInput.current?.setCustomValidity("Въведете текст.");
            textInput.current?.reportValidity();
            return;
          }
          const fontSize = isText ? Number(data.get("fontSize")) : undefined;
          if (onLabelChange(label, fontSize)) closeLabelEditor();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            closeLabelEditor();
          } else if (isText && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.currentTarget.requestSubmit();
          }
        }}
      >
        {isText ? (
          <>
            <textarea
              ref={textInput}
              id={textInputId}
              name="label"
              defaultValue={object.label ?? ""}
              maxLength={40}
              rows={2}
              required
              aria-label="Текст"
              onInput={(e) => e.currentTarget.setCustomValidity("")}
            />
            <label>
              Размер на шрифта
              <input
                type="number"
                name="fontSize"
                inputMode="decimal"
                min={1}
                max={MAX_TEXT_FONT_SIZE}
                step="any"
                defaultValue={textFontSize(object)}
                required
              />
            </label>
            <button
              type="button"
              aria-label={expanded ? "Свий текстовото поле" : "Разшири текстовото поле"}
              title={expanded ? "Свий текстовото поле" : "Разшири текстовото поле"}
              aria-expanded={expanded}
              aria-controls={textInputId}
              onPointerDown={(e) => {
                if (e.button === 0 && document.activeElement === textInput.current) {
                  e.preventDefault();
                }
              }}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
            </button>
          </>
        ) : (
          <input
            ref={labelInput}
            name="label"
            defaultValue={object.label ?? ""}
            maxLength={40}
            aria-label="Номер"
          />
        )}
        <button type="submit" aria-label="Потвърди" title="Потвърди">
          <Check size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Откажи редакцията"
          title="Откажи редакцията"
          onClick={closeLabelEditor}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </form>
    );
  }

  return (
    <>
      <ObjectColorInput color={object.color} onCommit={onColorChange} />
      <button
        type="button"
        aria-label="Дублирай"
        title="Дублирай"
        onClick={onDuplicate}
        disabled={!canDuplicate}
      >
        <Copy size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Изтрий"
        title="Изтрий"
        onClick={onRemove}
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Назад в слоевете"
        title="Назад в слоевете"
        onClick={() => onReorder(-1)}
        disabled={!canMoveBack}
      >
        <ArrowDown size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Напред в слоевете"
        title="Напред в слоевете"
        onClick={() => onReorder(1)}
        disabled={!canMoveForward}
      >
        <ArrowUp size={18} aria-hidden="true" />
      </button>
      {(object.kind === "player" || object.kind === "text") && (
        <button
          ref={editButton}
          type="button"
          aria-label={editTitle}
          title={editTitle}
          onClick={() => setEditingLabel(true)}
        >
          <Pencil size={18} aria-hidden="true" />
        </button>
      )}
    </>
  );
}

export type EditorProps = {
  plan: {
    id: string;
    title: string;
    description?: string | null;
    layout: Exercise;
    updatedAt: string;
  };
  clubId: string;
  userId: string;
};
function objectLabel(o: ExerciseObject) {
  return o.kind === "player"
    ? `Отбор ${o.team} · ${o.role === "coach" ? "Треньор" : o.role === "goalkeeper" ? "Вратар" : "Състезател"} ${o.label}`
    : o.kind === "text"
      ? o.label || "Текст"
      : o.kind === "equipment"
        ? EQUIPMENT_LABELS[o.equipment!]
        : o.kind === "movement"
          ? EQUIPMENT_LABELS[o.action!]
          : o.shape === "circle"
            ? "Кръг"
            : o.shape === "triangle"
              ? "Триъгълник"
              : "Правоъгълник";
}
function ZonePreview({ type }: { type: ExerciseTool }) {
  const hatchId = useId();
  const hatched = type.startsWith("hatched-");
  return (
    <svg viewBox="0 0 70 24" width="70" height="24" aria-hidden="true">
      {hatched && (
        <defs>
          <pattern
            id={hatchId}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <path d="M0 0V4" stroke="currentColor" strokeWidth="1.5" />
          </pattern>
        </defs>
      )}
      <g
        fill={hatched ? `url(#${hatchId})` : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      >
        {type.endsWith("circle") ? (
          <circle cx="35" cy="12" r="9" />
        ) : type.endsWith("triangle") ? (
          <path d="M35 3L47 21H23Z" />
        ) : (
          <rect x="21" y="4" width="28" height="16" />
        )}
      </g>
    </svg>
  );
}
function MovementPreview({ type }: { type: ExerciseTool }) {
  const o = createObject(type, { x: 0, y: 0 }, "preview");
  if (o.kind !== "movement") return null;
  o.points =
    o.path === "curve"
      ? [
          { x: 5, y: 20 },
          { x: 40, y: -8 },
          { x: 75, y: 20 },
        ]
      : [
          { x: 5, y: 15 },
          { x: 75, y: 15 },
        ];
  const p = movementPoints(o),
    style = FOOTBALL.actions[o.action!];
  const pathData = (points: number[]) =>
    points.reduce(
      (s, n, i) => (i % 2 ? s : `${s}${i ? " L" : "M"}${n},${points[i + 1]}`),
      "",
    );
  const head = style.arrow ? arrowheadPoints(p, 0, 9) : [];
  const shafts = o.action === "shot" ? shotShafts(p, head) : [p];
  return (
    <svg viewBox="0 0 85 30" width="70" height="24" aria-hidden="true">
      {shafts.map((shaft, index) => (
        <path
          key={index}
          d={pathData(shaft)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeDasharray={style.dash.join(" ")}
        />
      ))}
      {head.length > 0 && (
        <path d={pathData(head)} fill="none" stroke="currentColor" strokeWidth="2" />
      )}
    </svg>
  );
}
export default function Editor({ plan, clubId, userId }: EditorProps) {
  const router = useRouter();
  const [history, setHistory] = useState<History>({
    past: [],
    present: plan.layout,
    future: [],
  });
  const [selection, setSelection] = useState<{ id: string; editLabel: boolean } | null>(null),
    [selectedTool, setTool] = useState<ExerciseTool | "select">("select");
  const selected = selection?.id ?? null;
  function setSelected(id: string | null) {
    setSelection((current) => {
      if (current?.id === id) return current;
      return id ? { id, editLabel: false } : null;
    });
  }
  const [placementCount, setPlacementCount] = useState("1");
  const toolsRef = useRef<HTMLDivElement>(null);
  const addTeamButtonRef = useRef<HTMLButtonElement>(null);
  const [addingTeam, setAddingTeam] = useState(false);
  const [teamColor, setTeamColor] = useState(TEAM_COLOR_SUGGESTIONS[0]);
  const [pathMode, setPathMode] = useState<"straight" | "curve" | "freehand">(
    "straight",
  );
  const [category, setCategory] = useState(0),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false),
    [conflict, setConflict] = useState(false);
  const [revision, setRevision] = useState(plan.updatedAt),
    [saved, setSaved] = useState(plan.layout);
  const [recovery, setRecovery] = useState<RecoveryDraft | null>(null),
    [draftReady, setDraftReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [colorPreview, setColorPreview] = useState<{
    id: string;
    group: symbol;
  } | null>(null);
  const layout = history.present;
  const customTeamColors = getCustomTeamColors(layout);
  const toolGroups: (typeof TOOLBAR_GROUPS[number] | null)[] = [
    ...TOOLBAR_GROUPS,
    ...customTeamColors.map((color, index) =>
      color ? { title: `Отбор ${index + 3}`, types: FOOTBALL.customTeamTools, color } : null,
    ),
  ];
  const firstCustomCategory = TOOLBAR_GROUPS.length;
  const customTeamIndex = category - firstCustomCategory;
  const customTeamNumber = customTeamColors[customTeamIndex] ? customTeamIndex + 3 : undefined;
  const activeCategory =
    category < firstCustomCategory || customTeamNumber !== undefined ? category : 0;
  const toolGroup = toolGroups[activeCategory] ?? TOOLBAR_GROUPS[0];
  const equipmentCounts = useMemo(
    () => (toolGroup.showCounts ? countEquipment(layout.objects) : null),
    [layout.objects, toolGroup.showCounts],
  );
  const tool =
    customTeamNumber === undefined && selectedTool.startsWith("custom-team-")
      ? "select"
      : selectedTool;
  const validTeamColor = isCustomTeamColor(teamColor);
  const dirty = useMemo(() => !sameExercise(layout, saved), [layout, saved]);
  const object = layout.objects.find((o) => o.id === selected);
  const drawingMovement = isMovementType(tool);
  const drawingArrow =
    drawingMovement && tool !== "line" && tool !== "dashed-line";
  const placing =
    tool !== "select" && !drawingMovement && !isZoneType(tool);
  const usesQuantity = tool !== "select" && tool !== "text";
  const placementCapacity = MAX_ITEMS - layout.objects.length;
  const quantity = Number(placementCount);
  const validQuantity =
    Number.isInteger(quantity) && quantity >= 1 && quantity <= placementCapacity;
  const key = draftKey(userId, clubId, plan.id),
    endpoint = `/api/admin/clubs/${clubId}/training-plans/${plan.id}`;
  const state = useRef({ layout, dirty, revision, saved });
  state.current = { layout, dirty, revision, saved };
  const savingRef = useRef(false);
  const change = useCallback((next: Exercise) => {
    const invalid = validateExercise(next);
    if (invalid) {
      setError(invalid);
      return;
    }
    setHistory((h) => commit(h, next));
    setStatus("");
  }, []);
  function patch(changes: Partial<ExerciseObject>) {
    if (object)
      change({
        ...layout,
        objects: layout.objects.map((o) =>
          o.id === object.id ? { ...o, ...changes } : o,
        ),
      });
  }
  function updateLabel(label: string, fontSize?: number) {
    if (object?.kind === "text" && fontSize !== undefined) {
      if (label === object.label && fontSize === textFontSize(object)) return true;
      const { minWidth, minHeight } = measurePitchText(label, fontSize, object.width);
      if (minWidth > WIDTH * 3 || minHeight > HEIGHT * 3) {
        setError("Текстът е твърде голям за полето. Намалете размера на шрифта.");
        return false;
      }
      patch({
        label,
        fontSize,
        width: Math.max(object.width, minWidth),
        height: Math.max(object.height, minHeight),
      });
    } else if (label !== object?.label) {
      patch({ label });
    }
    return true;
  }
  function updateObjectColor(
    id: string,
    color: string,
    group: symbol,
    preview: boolean,
  ) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    setColorPreview((current) => {
      if (!preview) return null;
      return current?.group === group ? current : { id, group };
    });
    setHistory((h) =>
      commit(
        h,
        {
          ...h.present,
          objects: h.present.objects.map((o) =>
            o.id === id && o.color !== color ? { ...o, color } : o,
          ),
        },
        group,
      ),
    );
    setStatus("");
  }
  function remove() {
    change({
      ...layout,
      objects: layout.objects.filter((o) => o.id !== selected),
    });
    setSelected(null);
  }
  function cancelPlacement() {
    setSelected(null);
    setTool("select");
    setPlacementCount("1");
  }
  function createTeam() {
    if (!validTeamColor) return;
    change(addCustomTeam(layout, teamColor));
    cancelPlacement();
    setAddingTeam(false);
    setCategory(firstCustomCategory + customTeamColors.length);
    addTeamButtonRef.current?.focus();
  }
  function deleteTeam() {
    if (customTeamNumber === undefined) return;
    change(removeCustomTeam(layout, customTeamNumber));
    cancelPlacement();
    addTeamButtonRef.current?.focus();
  }
  function selectCategory(index: number) {
    setCategory(index);
    if (index === TEXT_CATEGORY) {
      cancelPlacement();
      if (tool !== "text") setTool("text");
      return;
    }
    if (
      tool === "text" ||
      (index !== activeCategory &&
        (index >= firstCustomCategory || customTeamNumber !== undefined))
    ) {
      cancelPlacement();
    }
  }
  function cancelPlacementFromControls() {
    const tools = toolsRef.current;
    const button =
      tools?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ??
      tools?.querySelector("button");
    button?.focus();
    cancelPlacement();
  }
  function clearPitch() {
    change({ ...layout, objects: [] });
    cancelPlacement();
  }
  function duplicate() {
    if (!object) return;
    const copy = duplicateObject(object, crypto.randomUUID());
    change({ ...layout, objects: [...layout.objects, copy] });
    if (layout.objects.length < MAX_ITEMS) setSelected(copy.id);
  }
  function onPlaced(placed: ExerciseObject) {
    if (placed.kind === "text") {
      setTool("select");
      setSelection({ id: placed.id, editLabel: true });
      return;
    }
    setSelected(null);
    if (quantity <= 1) {
      setTool("select");
      setPlacementCount("1");
    } else {
      setPlacementCount(String(quantity - 1));
    }
  }
  useEffect(() => {
    try {
      const draft = readDraft(localStorage.getItem(key));
      if (draft && !sameExercise(draft.layout, plan.layout)) setRecovery(draft);
    } catch {
      setStorageError(true);
    }
    setDraftReady(true);
  }, [key, plan.layout]);
  useEffect(() => {
    if (!draftReady || recovery) return;
    const timer = setTimeout(() => {
      try {
        if (dirty)
          localStorage.setItem(
            key,
            JSON.stringify({
              baseRevision: revision,
              layout,
              savedAt: Date.now(),
            } satisfies RecoveryDraft),
          );
        // Remove only this editor's saved snapshot; another tab may have a newer draft.
        else {
          const d = readDraft(localStorage.getItem(key));
          if (d && sameExercise(d.layout, saved)) localStorage.removeItem(key);
        }
      } catch {
        setStorageError(true);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [layout, dirty, revision, saved, key, draftReady, recovery]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!state.current.dirty && !recovery) return;
      if (!recovery) {
        try {
          localStorage.setItem(
            key,
            JSON.stringify({
              baseRevision: state.current.revision,
              layout: state.current.layout,
              savedAt: Date.now(),
            }),
          );
        } catch {
          /* Browser navigation must still show its warning. */
        }
      }
      event.preventDefault();
      event.returnValue = "";
    };
    const persist = () => {
      if (state.current.dirty && !recovery) {
        try {
          localStorage.setItem(
            key,
            JSON.stringify({
              baseRevision: state.current.revision,
              layout: state.current.layout,
              savedAt: Date.now(),
            }),
          );
        } catch {
          setStorageError(true);
        }
      }
    };
    const links = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest("a[href]");
      if (
        anchor &&
        (state.current.dirty || recovery) &&
        !window.confirm("Има незапазени промени. Да напуснете ли редактора?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", persist);
    document.addEventListener("click", links, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("click", links, true);
    };
  }, [key, recovery]);
  // Install shortcuts using current render values; typing never edits canvas objects.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as Element).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (e.key === "Escape") {
        if (!e.defaultPrevented) cancelPlacement();
        return;
      }
      if (recovery) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setHistory((h) => (e.shiftKey ? redo(h) : undo(h)));
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        setHistory(redo);
      } else if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "d" &&
        object
      ) {
        e.preventDefault();
        duplicate();
      } else if ((e.key === "Delete" || e.key === "Backspace") && object) {
        e.preventDefault();
        remove();
      } else if (
        object &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 2;
        patch({
          x: Math.max(
            0,
            Math.min(
              WIDTH,
              object.x +
                (e.key === "ArrowRight"
                  ? step
                  : e.key === "ArrowLeft"
                    ? -step
                    : 0),
            ),
          ),
          y: Math.max(
            0,
            Math.min(
              HEIGHT,
              object.y +
                (e.key === "ArrowDown"
                  ? step
                  : e.key === "ArrowUp"
                    ? -step
                    : 0),
            ),
          ),
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  async function save(asCopy = false) {
    if (savingRef.current || recovery) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    setStatus("");
    const snapshot = state.current.layout,
      base = state.current.revision;
    try {
      const res = await fetch(
        asCopy ? `/api/admin/clubs/${clubId}/training-plans` : endpoint,
        {
          method: asCopy ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            asCopy
              ? {
                  title: `${plan.title.slice(0, 185)} — копие`,
                  description: plan.description ?? "",
                  layout: snapshot,
                }
              : { layout: snapshot, expectedUpdatedAt: base },
          ),
        },
      );
      const payload = await res.json();
      if (res.status === 409) {
        setConflict(true);
        throw new Error(payload.error);
      }
      if (!res.ok) throw new Error(payload.error || "Грешка при запис.");
      if (asCopy) {
        setStatus("Копието е запазено. Текущият план остава отворен.");
        setCopyId(payload.plan.id);
      } else {
        setSaved(snapshot);
        setRevision(payload.plan.updatedAt);
        setConflict(false);
        setStatus("Промените са запазени.");
        try {
          const d = readDraft(localStorage.getItem(key));
          if (d && sameExercise(d.layout, snapshot))
            localStorage.removeItem(key);
        } catch {
          setStorageError(true);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Няма връзка със сървъра. Промените остават в редактора.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  const [copyId, setCopyId] = useState<string | null>(null);
  async function reload() {
    if (
      !window.confirm(
        "Да заменим текущата рисунка с последния запис от сървъра?",
      )
    )
      return;
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" }),
        data = await response.json();
      if (!response.ok || validateExercise(data.plan?.layout))
        throw new Error(data.error || "Невалиден запис.");
      setHistory({ past: [], present: data.plan.layout, future: [] });
      setSaved(data.plan.layout);
      setRevision(data.plan.updatedAt);
      setConflict(false);
      setSelected(null);
      try {
        localStorage.removeItem(key);
      } catch {
        setStorageError(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Грешка при зареждане.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  function restoreDraft(restore: boolean) {
    if (restore && recovery) {
      change(recovery.layout);
      if (recovery.baseRevision !== revision) setConflict(true);
    }
    try {
      if (!restore) localStorage.removeItem(key);
    } catch {
      setStorageError(true);
    }
    setRecovery(null);
  }
  function reorder(delta: number) {
    if (!object) return;
    const next = [...layout.objects],
      at = next.findIndex((o) => o.id === object.id),
      to = Math.max(0, Math.min(next.length - 1, at + delta));
    next.splice(at, 1);
    next.splice(to, 0, object);
    change({ ...layout, objects: next });
  }
  return (
    <main className="ke-page">
      <div className="ke-inner">
        <header className="ke-header">
          <button
            type="button"
            onClick={() => {
              if (
                (!dirty && !recovery) ||
                window.confirm(
                  "Има незапазени промени. Да напуснете ли редактора?",
                )
              )
                router.push(`/admin/training-plans?clubId=${clubId}`);
            }}
          >
            <ArrowLeft size={18} />
            Назад
          </button>
          <div>
            <h1>{plan.title}</h1>
          </div>
          <button
            type="button"
            className="ke-primary"
            disabled={saving || !dirty || !!recovery || conflict}
            onClick={() => void save()}
          >
            <Save size={18} />
            {saving ? "Записване…" : "Запази"}
          </button>
        </header>
        <div className="ke-feedback" aria-live="polite">
          <span>
            {dirty ? "Незапазени промени" : "Всички промени са запазени"} ·{" "}
            {layout.objects.length}/{MAX_ITEMS}
          </span>
          {status && <p>{status}</p>}
          {copyId && (
            <a href={`/admin/training-plans/${copyId}/konva?clubId=${clubId}`}>
              Отвори запазеното копие
            </a>
          )}
          {error && (
            <p role="alert" className="ke-error">
              {error}
            </p>
          )}
          {storageError && (
            <p className="ke-error">
              Локалното възстановяване не е налично. Запазвайте чрез бутона
              „Запази“.
            </p>
          )}
        </div>
        {recovery && (
          <section className="ke-notice" aria-label="Локално възстановяване">
            <h2>Открита е незапазена рисунка</h2>
            <p>
              {recovery.baseRevision !== revision
                ? "Записът на сървъра е променен. Възстановете рисунката и я запазете като копие или я отхвърлете."
                : "Да възстановим ли локалните промени?"}
            </p>
            <button type="button" onClick={() => restoreDraft(true)}>
              Възстанови
            </button>
            <button type="button" onClick={() => restoreDraft(false)}>
              Отхвърли
            </button>
          </section>
        )}
        {conflict && (
          <section className="ke-notice">
            <p>Има по-нов запис. Текущата рисунка е запазена в редактора.</p>
            <button
              type="button"
              disabled={saving || !!recovery}
              onClick={() => void save(true)}
            >
              Запази като нов план
            </button>
            <button
              type="button"
              disabled={saving || !!recovery}
              onClick={() => void reload()}
            >
              Зареди от сървъра
            </button>
          </section>
        )}
        <fieldset disabled={!!recovery} className="ke-workspace">
          <legend className="ke-sr">Инструменти за упражнението</legend>
          <div className="ke-layout">
            <div className="ke-sidebar">
              <div className="ke-toolbar">
                <button
                  type="button"
                  aria-label="Отмени"
                  disabled={!history.past.length}
                  onClick={() => setHistory(undo)}
                >
                  <Undo2 size={18} />
                  Отмени
                </button>
                <button
                  type="button"
                  aria-label="Повтори"
                  disabled={!history.future.length}
                  onClick={() => setHistory(redo)}
                >
                  <Redo2 size={18} />
                  Повтори
                </button>
                <button
                  type="button"
                  disabled={layout.objects.length === 0}
                  onClick={clearPitch}
                >
                  <Trash2 size={18} aria-hidden="true" />
                  Изчисти игрището
                </button>
                <label>
                  Игрище
                  <select
                    value={layout.surface}
                    onChange={(e) =>
                      change({
                        ...layout,
                        surface: e.target.value as Exercise["surface"],
                      })
                    }
                  >
                    {FOOTBALL.surfaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div
                className="ke-categories"
                role="group"
                aria-label="Категории инструменти"
              >
                {toolGroups.map((g, i) => g && (
                  <button
                    type="button"
                    key={g.title}
                    aria-pressed={i === TEXT_CATEGORY ? tool === "text" : activeCategory === i}
                    onClick={() => selectCategory(i)}
                  >
                    {g.color && (
                      <span
                        className="ke-team-swatch"
                        style={{ backgroundColor: g.color }}
                        aria-hidden="true"
                      />
                    )}
                    {g.title}
                  </button>
                ))}
                <button
                  type="button"
                  ref={addTeamButtonRef}
                  aria-expanded={addingTeam}
                  onClick={() => {
                    if (!addingTeam) {
                      cancelPlacement();
                      const suggestion = TEAM_COLOR_SUGGESTIONS.find(
                        (color) => !customTeamColors.includes(color),
                      );
                      setTeamColor(suggestion ?? TEAM_COLOR_SUGGESTIONS[0]);
                    }
                    setAddingTeam(!addingTeam);
                  }}
                >
                  <Plus size={16} aria-hidden="true" /> Добави отбор
                </button>
              </div>
              {addingTeam && (
                <div className="ke-team-setup">
                  <label>
                    Цвят на отбор {customTeamColors.length + 3}
                    <input
                      type="color"
                      value={teamColor}
                      onChange={(e) => setTeamColor(e.currentTarget.value)}
                      aria-invalid={!validTeamColor}
                      aria-describedby={validTeamColor ? undefined : "ke-team-color-error"}
                    />
                  </label>
                  {!validTeamColor && (
                    <p id="ke-team-color-error" className="ke-error" role="alert">
                      {CUSTOM_TEAM_COLOR_ERROR}
                    </p>
                  )}
                  <div className="ke-toolbar">
                    <button
                      type="button"
                      onClick={() => {
                        setAddingTeam(false);
                        addTeamButtonRef.current?.focus();
                      }}
                    >
                      Отказ
                    </button>
                    <button
                      type="button"
                      className="ke-primary"
                      disabled={!validTeamColor}
                      onClick={createTeam}
                    >
                      Създай отбор
                    </button>
                  </div>
                </div>
              )}
              {activeCategory !== TEXT_CATEGORY && (
                <div
                  className="ke-tools"
                  ref={toolsRef}
                  role="group"
                  aria-label={toolGroup.title}
                >
                  {toolGroup.types.map((t) => {
                    const label = EQUIPMENT_LABELS[t];
                    const count = equipmentCounts ? equipmentCounts[t] ?? 0 : undefined;
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={tool === t}
                        aria-label={
                          count === undefined ? undefined : `${label}, брой на игрището: ${count}`
                        }
                        onClick={() => {
                          if (tool === t) {
                            cancelPlacement();
                            return;
                          }
                          setSelected(null);
                          setPlacementCount("1");
                          setTool(t);
                          const defaultPath = FOOTBALL.defaultPaths[t];
                          if (defaultPath) setPathMode(defaultPath);
                        }}
                      >
                        {isMovementType(t) ? (
                          <MovementPreview type={t} />
                        ) : isZoneType(t) ? (
                          <ZonePreview type={t} />
                        ) : (
                          <EquipmentPreview type={t} />
                        )}
                        <span>
                          {label}
                          {count !== undefined && (
                            <span className="ke-equipment-count" aria-hidden="true">
                              {count}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div
                className="ke-mode"
                hidden={tool === "select" && customTeamNumber === undefined}
              >
                {customTeamNumber !== undefined && (
                  <button type="button" onClick={deleteTeam}>
                    <Trash2 size={16} aria-hidden="true" />
                    Изтрий отбор
                  </button>
                )}
                {usesQuantity && (
                  <div
                    className="ke-placement-count"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelPlacementFromControls();
                      }
                    }}
                  >
                    <label>
                      Брой обекти за поставяне
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={Math.max(1, placementCapacity)}
                        step={1}
                        value={placementCount}
                        disabled={placementCapacity === 0}
                        aria-invalid={placementCapacity > 0 && !validQuantity}
                        aria-describedby={
                          !validQuantity ? "ke-placement-limit" : undefined
                        }
                        onChange={(e) => setPlacementCount(e.target.value)}
                      />
                    </label>
                    {!validQuantity && (
                      <p id="ke-placement-limit" className="ke-error">
                        {placementCapacity === 0
                          ? "Достигнахте максималния брой обекти."
                          : `Въведете цяло число от 1 до ${placementCapacity}.`}
                      </p>
                    )}
                    <button type="button" onClick={cancelPlacementFromControls}>
                      Откажи поставянето
                    </button>
                    <p>Или натиснете <kbd>Esc</kbd>.</p>
                  </div>
                )}
                {drawingMovement && (
                  <fieldset
                    className="ke-path-modes"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelPlacementFromControls();
                      }
                    }}
                  >
                    <legend>Начин на рисуване</legend>
                    {DRAWING_MODES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={pathMode === value}
                        onClick={() => setPathMode(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </fieldset>
                )}
                {tool !== "select" && (
                  <p>
                    {tool === "text"
                      ? "Изберете място на игрището за текста. Esc отменя."
                      : placing
                        ? "Изберете място за всеки обект."
                        : drawingArrow
                          ? "Плъзнете по игрището, за да нарисувате стрелка."
                          : "Плъзнете по игрището, за да нарисувате линия или фигура."}
                  </p>
                )}
              </div>
            </div>
            <div className="ke-pitch-area">
              <Canvas
                exercise={layout}
                selected={selected}
                tool={
                  recovery || (usesQuantity && !validQuantity) ? "select" : tool
                }
                placementOnly={tool !== "select"}
                customTeamNumber={customTeamNumber}
                pathMode={pathMode}
                colorPreviewId={
                  colorPreview?.group === history.group &&
                  colorPreview?.id === selected
                    ? colorPreview.id
                    : undefined
                }
                selectedLabel={object ? objectLabel(object) : undefined}
                objectActions={object && (
                  <ObjectActions
                    key={object.id}
                    object={object}
                    editLabelOnMount={selection?.editLabel ?? false}
                    onColorChange={(color, group, preview) =>
                      updateObjectColor(object.id, color, group, preview)
                    }
                    onLabelChange={updateLabel}
                    onDuplicate={duplicate}
                    onRemove={remove}
                    onReorder={reorder}
                    canDuplicate={layout.objects.length < MAX_ITEMS}
                    canMoveBack={layout.objects[0].id !== object.id}
                    canMoveForward={layout.objects.at(-1)!.id !== object.id}
                  />
                )}
                onSelect={setSelected}
                onCommit={change}
                onPlaced={onPlaced}
                onError={setError}
              />
            </div>
          </div>
        </fieldset>
      </div>
    </main>
  );
}
