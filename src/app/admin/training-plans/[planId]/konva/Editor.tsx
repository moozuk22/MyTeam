"use client";

import { useTrainingPlanAccess, trainingSubscriptionMessage, trainingSubscriptionInactiveMessage } from "@/lib/exercise/useTrainingPlanAccess";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Cone,
  Copy,
  Goal as GoalIcon,
  Hand,
  ImagePlus,
  Info,
  Maximize2,
  Minimize2,
  Minus,
  MousePointer2,
  NotebookText,
  Pencil,
  Plus,
  Redo2,
  RotateCw,
  Save,
  ScanLine,
  SquareDashed,
  Trash2,
  Type,
  Users,
  Waypoints,
  Undo2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { trainingPlanSearch } from "@/lib/exercise/planLocation";
import { countEquipment, FOOTBALL } from "@/lib/exercise/football";
import {
  HEIGHT,
  CUSTOM_TEAM_COLOR_ERROR,
  MAX_TEXT_FONT_SIZE,
  PITCH_QUADRANTS,
  PITCH_ROTATIONS,
  WIDTH,
  addCustomTeam,
  createObject,
  getCustomTeamColors,
  getPitchQuadrants,
  isCustomTeamColor,
  isLineType,
  isMovementType,
  isInPitchQuadrants,
  isZoneType,
  removeCustomTeam,
  textFontSize,
  validateExercise,
  type Exercise,
  type ExerciseObject,
  type ExerciseTool,
  type PitchQuadrant,
} from "@/lib/exercise/model";
import { createExerciseObjectId } from "@/lib/exercise/objectId";
import {
  arrowheadPoints,
  commit,
  duplicateObject,
  duplicateObjects,
  movementPoints,
  shotShafts,
  redo,
  undo,
  type History,
} from "@/lib/exercise/geometry";
import {
  draftKey,
  matchesDraft,
  readDraft,
  sameExercise,
  type RecoveryDraft,
} from "@/lib/exercise/drafts";
import { MAX_ITEMS, MAX_PLAN_DESCRIPTION_LENGTH, MAX_PLAN_TITLE_LENGTH } from "@/lib/trainingPlans";
import Canvas from "./Canvas";
import { EquipmentPreview } from "./Visuals";
import { pitchView, pitchViewport } from "./pitchView";
import { BACKGROUND_IMAGE_TYPES, placeBackgroundImage, readBackgroundImage } from "./backgroundImage";
import { measurePitchText } from "./textLayout";

const EQUIPMENT_LABELS = FOOTBALL.labels;
const TOOLBAR_GROUPS = FOOTBALL.tools;
const BALLS_AND_GOALS_CATEGORY = TOOLBAR_GROUPS.findIndex(({ types }) => types.includes("ball"));
const LINES_AND_AREAS_CATEGORY = TOOLBAR_GROUPS.findIndex(({ types }) => types.includes("line"));
const FIRST_TEAM_CATEGORY = TOOLBAR_GROUPS.findIndex(({ types }) => types.includes("team1-player-1"));
const QUICK_TOOLS = [
  ["run", ArrowRight, "Движения"],
  ["balls-and-goals", GoalIcon, TOOLBAR_GROUPS[BALLS_AND_GOALS_CATEGORY].title],
  ["cone", Cone, "Конус"],
  ["line", Pencil, "Линия"],
  ["text", Type, "Текст"],
  ["team1-player-1", Users, "Състезател"],
] as const;
const COMPACT_EDITOR = "(max-width: 899px), (max-height: 479px)";

function subscribeToCompactEditor(callback: () => void) {
  const query = window.matchMedia(COMPACT_EDITOR);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function isCompactEditor() {
  return window.matchMedia(COMPACT_EDITOR).matches;
}

function isCompactEditorOnServer() {
  return false;
}

const TEXT_CATEGORY = TOOLBAR_GROUPS.findIndex((group) => group.types[0] === "text");
const TEAM_COLOR_SUGGESTIONS = ["#facc15", "#a855f7", "#fb923c", "#22d3ee", "#f472b6", "#a3e635"];
// Original quadrant indices in screen order after rotation.
const PITCH_QUADRANT_ORDER = {
  0: [0, 1, 2, 3],
  90: [2, 0, 3, 1],
  180: [3, 2, 1, 0],
  270: [1, 3, 0, 2],
} as const;
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
  onToggleArrowhead,
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
  onToggleArrowhead: () => void;
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
      {isLineType(object.action) && (
        <button
          type="button"
          aria-label="Връх на стрелка"
          title="Връх на стрелка"
          aria-pressed={!!object.arrowhead}
          onClick={onToggleArrowhead}
        >
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
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
    id: string | null;
    title: string;
    description?: string | null;
    categoryId?: string | null;
    layout: Exercise;
    updatedAt: string;
  };
  categories: readonly { id: string; name: string }[];
  clubId: string;
  userId: string;
  coachGroupId?: string;
  initialPanel?: "description" | "equipment";
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
function MovementPreview({ type, arrowhead }: { type: ExerciseTool; arrowhead: boolean }) {
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
  const head = style.arrow || arrowhead ? arrowheadPoints(p, 0, 9) : [];
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
export default function Editor({ plan, categories = [], clubId, userId, coachGroupId, initialPanel }: EditorProps) {
  const subscription = useTrainingPlanAccess(clubId);
  const router = useRouter();
  const [planId, setPlanId] = useState(plan.id);
  const [showDetails, setShowDetails] = useState(!plan.id || initialPanel === "description");
  const compact = useSyncExternalStore(subscribeToCompactEditor, isCompactEditor, isCompactEditorOnServer);
  const [toolsOpen, setToolsOpen] = useState(initialPanel === "equipment");
  const [showPitchOptions, setShowPitchOptions] = useState(false);
  const toolsDialog = useRef<HTMLDialogElement>(null);
  const toolsDrag = useRef<{ pointerId: number; startY: number } | null>(null);
  const toolsTrigger = useRef<HTMLButtonElement>(null);
  const toolsHeadingId = useId();
  const importImageButton = useRef<HTMLButtonElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [importingImage, setImportingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const pitchOptionsId = useId();
  const pitchOptionsRef = useRef<HTMLFieldSetElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [panning, setPanning] = useState(false);
  const [browsingTools, setBrowsingTools] = useState(initialPanel === "equipment");
  const titleInput = useRef<HTMLInputElement>(null);
  const titleErrorId = useId();
  const detailsId = useId();
  const toolsId = useId();
  const teamsHeadingId = useId();
  const [history, setHistory] = useState<History>({
    past: [],
    present: plan.layout,
    future: [],
  });
  const [selection, setSelection] = useState<{ id: string; editLabel: boolean } | null>(null),
    [selectedTool, setTool] = useState<ExerciseTool | "select">("select");
  const selected = selection?.id ?? null;
  const [multiSelection, setMultiSelection] = useState<Set<string> | null>(null);
  const multiActive = multiSelection !== null;
  const [pitchSelection, setPitchSelection] = useState<readonly PitchQuadrant[] | null>(null);
  const pitchPicker = useRef<HTMLDivElement>(null);
  const pitchPickerTrigger = useRef<HTMLButtonElement>(null);
  function setSelected(id: string | null) {
    setSelection((current) => {
      if (current?.id === id) return current;
      return id ? { id, editLabel: false } : null;
    });
  }
  const toolsRef = useRef<HTMLDivElement>(null);
  const addTeamButtonRef = useRef<HTMLButtonElement>(null);
  const [addingTeam, setAddingTeam] = useState(false);
  const [teamColor, setTeamColor] = useState(TEAM_COLOR_SUGGESTIONS[0]);
  const [pathMode, setPathMode] = useState<"straight" | "curve" | "freehand">(
    "straight",
  );
  const [lineArrowhead, setLineArrowhead] = useState(false);
  const [category, setCategory] = useState(
    initialPanel === "equipment" ? TOOLBAR_GROUPS.findIndex(({ types }) => types.includes("cone")) : 0,
  ),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false),
    [conflict, setConflict] = useState(false);
  const [revision, setRevision] = useState(plan.updatedAt),
    [saved, setSaved] = useState(plan.layout);
  const [title, setTitle] = useState(plan.title);
  const [titleRequired, setTitleRequired] = useState(false);
  const titleInvalid = titleRequired && !title.trim();
  const [savedTitle, setSavedTitle] = useState(plan.title);
  const initialCategoryId = plan.categoryId ?? null;
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [savedCategoryId, setSavedCategoryId] = useState(initialCategoryId);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [newCategoryName, setNewCategoryName] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const categorySelect = useRef<HTMLSelectElement>(null);
  const initialDescription = plan.description ?? "";
  const [description, setDescription] = useState(initialDescription);
  const [savedDescription, setSavedDescription] = useState(initialDescription);
  const [recovery, setRecovery] = useState<RecoveryDraft | null>(null),
    [draftReady, setDraftReady] = useState(false);
  const recoveryDialog = useRef<HTMLDialogElement>(null);
  const conflictDialog = useRef<HTMLDialogElement>(null);
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const leaveTitleId = useId();
  const leaveDescriptionId = useId();
  const [leavePath, setLeavePath] = useState<string | null>(null);
  const warningDialog = useRef<HTMLDialogElement>(null);
  const warningTitleId = useId();
  const warningDescriptionId = useId();
  const [confirmReload, setConfirmReload] = useState(false);
  const reloadCancelButton = useRef<HTMLButtonElement>(null);
  const reloadButton = useRef<HTMLButtonElement>(null);
  const [remainingPitchObjects, setRemainingPitchObjects] = useState<ExerciseObject[] | null>(null);
  const conflictTitleId = useId();
  const conflictDescriptionId = useId();
  const [showConflict, setShowConflict] = useState(false);
  const recoveryTitleId = useId();
  const recoveryDescriptionId = useId();
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
    category < firstCustomCategory || customTeamNumber !== undefined ? category : FIRST_TEAM_CATEGORY;
  const pitchOptionsVisible = showPitchOptions && (compact || activeCategory === LINES_AND_AREAS_CATEGORY);
  const teamsOpen = !pitchOptionsVisible && activeCategory >= FIRST_TEAM_CATEGORY;
  const toolGroup = toolGroups[activeCategory] ?? TOOLBAR_GROUPS[0];
  const quadrants = getPitchQuadrants(layout);
  const pitchRotation = layout.pitchRotation ?? 0;
  const { viewWidth, viewHeight } = pitchView(
    pitchViewport(pitchSelection ? PITCH_QUADRANTS : quadrants),
    pitchRotation,
    1,
  );
  const visibleObjects = useMemo(
    () => quadrants.length === PITCH_QUADRANTS.length
      ? layout.objects
      : layout.objects.filter((object) => isInPitchQuadrants(object, quadrants)),
    [layout.objects, quadrants],
  );
  const equipmentCounts = useMemo(
    () => (toolGroup.showCounts ? countEquipment(visibleObjects) : null),
    [visibleObjects, toolGroup.showCounts],
  );
  const tool =
    customTeamNumber === undefined && selectedTool.startsWith("custom-team-")
      ? "select"
      : selectedTool;
  const ballsAndGoalsActive = (tool !== "select" && TOOLBAR_GROUPS[BALLS_AND_GOALS_CATEGORY].types.includes(tool)) ||
    (browsingTools && activeCategory === BALLS_AND_GOALS_CATEGORY);
  const selectionActive = tool === "select" && !multiActive &&
    (compact ? !panning : !pitchOptionsVisible && !ballsAndGoalsActive && !teamsOpen);
  const validTeamColor = isCustomTeamColor(teamColor);
  const layoutDirty = useMemo(() => !sameExercise(layout, saved), [layout, saved]);
  const dirty = layoutDirty ||
    title.trim() !== savedTitle ||
    description.trim() !== savedDescription ||
    categoryId !== savedCategoryId;
  const object = visibleObjects.find((o) => o.id === selected);
  const batch = useMemo(
    () => multiSelection ? visibleObjects.filter((o) => multiSelection.has(o.id)) : [],
    [visibleObjects, multiSelection],
  );
  const batchIds = useMemo(() => new Set(batch.map((o) => o.id)), [batch]);
  const multiAnchorId = multiSelection && [...multiSelection].find((id) => batchIds.has(id));
  const canDuplicateBatch = batch.length > 0 && layout.objects.length + batch.length <= MAX_ITEMS;
  const drawingMovement = isMovementType(tool);
  const drawingLine = isLineType(tool);
  const drawingArrow = drawingMovement && (!drawingLine || lineArrowhead);
  const placing =
    tool !== "select" && !drawingMovement && !isZoneType(tool);
  const newDraftId = coachGroupId ? `new:${coachGroupId}` : "new";
  const initialDraftKey = draftKey(userId, clubId, plan.id ?? newDraftId);
  const key = draftKey(userId, clubId, planId ?? newDraftId);
  const search = trainingPlanSearch(clubId, coachGroupId);
  const collectionEndpoint = `/api/admin/clubs/${clubId}/training-plans`;
  const endpoint = `${collectionEndpoint}/${planId}`;
  const lastWrittenDraft = useRef<string | null>(null);
  const state = useRef({ layout, title, description, categoryId, dirty, revision, saved });
  state.current = { layout, title, description, categoryId, dirty, revision, saved };
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
    if (!object) return;
    const updated = { ...object, ...changes };
    if (!isInPitchQuadrants(updated, quadrants)) return;
    change({
      ...layout,
      objects: layout.objects.map((o) => o.id === object.id ? updated : o),
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
    targets: string | ReadonlySet<string>,
    color: string,
    group: symbol,
    preview: boolean,
  ) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    setColorPreview((current) => {
      if (!preview || typeof targets !== "string") return null;
      return current?.group === group ? current : { id: targets, group };
    });
    setHistory((h) =>
      commit(
        h,
        {
          ...h.present,
          objects: h.present.objects.map((o) =>
            o.color !== color &&
              (typeof targets === "string" ? o.id === targets : targets.has(o.id))
              ? { ...o, color }
              : o,
          ),
        },
        group,
      ),
    );
    setStatus("");
  }
  function remove() {
    if (multiActive && !batch.length) return;
    change({
      ...layout,
      objects: layout.objects.filter((o) => multiActive ? !batchIds.has(o.id) : o.id !== selected),
    });
    setSelected(null);
    if (multiActive) setMultiSelection(new Set());
  }
  function cancelPlacement() {
    setBrowsingTools(false);
    setSelected(null);
    setMultiSelection(null);
    setTool("select");
    setPanning(false);
  }
  function openPitchPicker(trigger: HTMLButtonElement) {
    cancelPlacement();
    setToolsOpen(false);
    pitchPickerTrigger.current = trigger;
    setPitchSelection((current) => current ?? quadrants);
    requestAnimationFrame(() => {
      pitchPicker.current?.scrollIntoView({ block: "nearest" });
      pitchPicker.current?.querySelector<HTMLButtonElement>(".ke-pitch-quadrants button:not(:disabled)")
        ?.focus({ preventScroll: true });
    });
  }
  function selectBlankField() {
    setPitchSelection(null);
    cancelPlacement();
    change({ ...layout, surface: "blank", quadrants: undefined });
  }
  function rotatePitch() {
    cancelPlacement();
    const next = (PITCH_ROTATIONS.indexOf(pitchRotation) + 1) % PITCH_ROTATIONS.length;
    change({ ...layout, pitchRotation: PITCH_ROTATIONS[next] });
  }
  function toggleQuadrant(quadrant: PitchQuadrant) {
    setPitchSelection((current) => {
      if (!current) return current;
      const enabled = current.includes(quadrant);
      if (enabled && current.length === 1) return current;
      return PITCH_QUADRANTS.filter((part) =>
        part === quadrant ? !enabled : current.includes(part),
      );
    });
  }
  function closePitchPicker(objects?: ExerciseObject[]) {
    if (objects && pitchSelection) {
      change({ ...layout, surface: "full", quadrants: [...pitchSelection], objects });
    }
    setPitchSelection(null);
    cancelPlacement();
    requestAnimationFrame(() => {
      const trigger = pitchPickerTrigger.current;
      if (trigger?.getClientRects().length) trigger.focus({ preventScroll: true });
      else toolsTrigger.current?.focus({ preventScroll: true });
    });
  }
  function applyPitchSelection() {
    if (!pitchSelection) return;
    const objects = pitchSelection.length === PITCH_QUADRANTS.length
      ? layout.objects
      : layout.objects.filter((object) => isInPitchQuadrants(object, pitchSelection));
    if (objects.length < layout.objects.length) setRemainingPitchObjects(objects);
    else closePitchPicker(objects);
  }
  function selectAllVisibleObjects() {
    if (!multiActive) cancelPlacement();
    setMultiSelection((current) =>
      new Set([...(current ?? []), ...visibleObjects.map((object) => object.id)]),
    );
  }
  function selectOnPitch(id: string | null) {
    if (!multiActive) {
      setSelected(id);
      return;
    }
    setMultiSelection((current) => {
      if (!current) return current;
      if (!id) return current.size ? new Set() : current;
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function createTeam() {
    if (!validTeamColor) return;
    change(addCustomTeam(layout, teamColor));
    cancelPlacement();
    setBrowsingTools(compact);
    setAddingTeam(false);
    setCategory(firstCustomCategory + customTeamColors.length);
    addTeamButtonRef.current?.focus();
  }
  function deleteTeam() {
    if (customTeamNumber === undefined) return;
    change(removeCustomTeam(layout, customTeamNumber));
    cancelPlacement();
    setBrowsingTools(compact);
    setCategory(FIRST_TEAM_CATEGORY);
    addTeamButtonRef.current?.focus();
  }
  function cancelPlacementFromControls() {
    const tools = toolsRef.current;
    const button =
      tools?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ??
      tools?.querySelector("button") ??
      pageRef.current?.querySelector<HTMLButtonElement>(".ke-quick-tools button");
    button?.focus();
    cancelPlacement();
  }
  function clearPitch() {
    change({ ...layout, objects: layout.objects.filter((object) => !isInPitchQuadrants(object, quadrants)) });
    cancelPlacement();
  }
  function duplicate() {
    if (multiActive) {
      if (!canDuplicateBatch) return;
      const shifted = duplicateObjects(batch, createExerciseObjectId);
      const copies = shifted.every((copy) => isInPitchQuadrants(copy, quadrants))
        ? shifted
        : shifted.map((copy, index) => ({ ...copy, x: batch[index].x, y: batch[index].y }));
      change({ ...layout, objects: [...layout.objects, ...copies] });
      setMultiSelection(new Set(copies.map((o) => o.id)));
      return;
    }
    if (!object) return;
    const copy = duplicateObject(object, createExerciseObjectId());
    if (!isInPitchQuadrants(copy, quadrants)) {
      copy.x = object.x;
      copy.y = object.y;
    }
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
  }
  useEffect(() => {
    try {
      const draft = readDraft(localStorage.getItem(initialDraftKey));
      if (draft && !matchesDraft(draft, plan.layout, plan.title, initialDescription, initialCategoryId)) setRecovery(draft);
    } catch {
      setStorageError(true);
    }
    setDraftReady(true);
  }, [initialDraftKey, plan.layout, plan.title, initialDescription, initialCategoryId]);
  useEffect(() => {
    if (recovery) recoveryDialog.current?.showModal();
  }, [recovery]);
  useEffect(() => {
    if (showConflict) conflictDialog.current?.showModal();
  }, [showConflict]);
  useEffect(() => {
    if (leavePath) leaveDialog.current?.showModal();
  }, [leavePath]);
  useEffect(() => {
    if (remainingPitchObjects) warningDialog.current?.showModal();
  }, [remainingPitchObjects]);
  useEffect(() => {
    if (confirmReload) reloadCancelButton.current?.focus();
  }, [confirmReload]);
  useEffect(() => {
    if (!draftReady || recovery) return;
    const timer = setTimeout(() => {
      try {
        if (dirty) {
          const draft = JSON.stringify({
            baseRevision: revision,
            layout,
            title,
            description,
            categoryId,
            savedAt: Date.now(),
          } satisfies RecoveryDraft);
          localStorage.setItem(key, draft);
          lastWrittenDraft.current = draft;
        }
        // Remove only this editor's saved snapshot; another tab may have a newer draft.
        else {
          const d = readDraft(localStorage.getItem(key));
          if (d && matchesDraft(d, saved, savedTitle, savedDescription, savedCategoryId)) localStorage.removeItem(key);
        }
      } catch {
        setStorageError(true);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [layout, title, description, categoryId, dirty, revision, saved, savedTitle, savedDescription, savedCategoryId, key, draftReady, recovery]);
  const persistDraft = useCallback(() => {
    const current = state.current;
    if (!current.dirty || recovery) return;
    try {
      const draft = JSON.stringify({
        baseRevision: current.revision,
        layout: current.layout,
        title: current.title,
        description: current.description,
        categoryId: current.categoryId,
        savedAt: Date.now(),
      } satisfies RecoveryDraft);
      localStorage.setItem(key, draft);
      lastWrittenDraft.current = draft;
    } catch {
      setStorageError(true);
    }
  }, [key, recovery]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!state.current.dirty && !recovery) return;
      persistDraft();
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", persistDraft);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("pagehide", persistDraft);
    };
  }, [persistDraft, recovery]);
  // Install shortcuts using current render values; typing never edits canvas objects.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (recovery || conflictDialog.current?.open || leaveDialog.current?.open ||
        warningDialog.current?.open || toolsDialog.current?.open) return;
      if (
        (e.target as Element).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (pitchSelection) {
        if (e.key === "Escape") {
          e.preventDefault();
          closePitchPicker();
        }
        return;
      }
      if (e.key === "Escape") {
        if (!e.defaultPrevented) cancelPlacement();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setHistory((h) => (e.shiftKey ? redo(h) : undo(h)));
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        setHistory(redo);
      } else if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "d" &&
        (object || batch.length)
      ) {
        e.preventDefault();
        duplicate();
      } else if ((e.key === "Delete" || e.key === "Backspace") && (object || batch.length)) {
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
  async function addCategory() {
    if (!newCategoryName?.trim() || addingCategory || savingRef.current) return;
    setAddingCategory(true);
    setCategoryError("");
    try {
      const response = await fetch(`${collectionEndpoint}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Грешка при добавяне на категория.");
      const category: EditorProps["categories"][number] = payload.category;
      setCategoryOptions((current) => current.some(({ id }) => id === category.id)
        ? current
        : [...current, category].sort((a, b) => a.name.localeCompare(b.name, "bg")));
      setCategoryId(category.id);
      setNewCategoryName(null);
      setStatus("");
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "Грешка при добавяне на категория.");
    } finally {
      setAddingCategory(false);
      categorySelect.current?.focus();
    }
  }
  async function save(asCopy = false) {
    if (!subscription.access?.canSave) { setError(trainingSubscriptionMessage); return; }
    if (savingRef.current || importingImage || recovery || pitchSelection || addingCategory) return;
    const snapshotTitle = state.current.title.trim();
    if (!snapshotTitle) {
      closeConflict();
      setError("");
      setTitleRequired(true);
      setShowDetails(true);
      requestAnimationFrame(() => titleInput.current?.focus());
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    setStatus("");
    const snapshot = state.current.layout,
      snapshotDescription = state.current.description.trim(),
      snapshotCategoryId = state.current.categoryId,
      base = state.current.revision;
    const creating = planId === null;
    try {
      const res = await fetch(
        asCopy || creating ? collectionEndpoint : endpoint,
        {
          method: asCopy || creating ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: asCopy ? `${snapshotTitle.slice(0, 185)} — копие` : snapshotTitle,
            description: snapshotDescription,
            categoryId: snapshotCategoryId,
            layout: snapshot,
            ...(asCopy || creating ? { coachGroupId } : { expectedUpdatedAt: base }),
          }),
        },
      );
      const payload = await res.json();
      if (res.status === 409 && !asCopy && !creating) {
        setConflict(true);
        setShowConflict(true);
        return;
      }
      if (!res.ok) throw new Error(payload.error || "Грешка при запис.");
      if (asCopy) {
        setStatus("Копието е запазено. Текущият план остава отворен.");
        setCopyId(payload.plan.id);
        closeConflict();
      } else {
        if (creating) {
          setPlanId(payload.plan.id);
          // Keep the canvas mounted so edits made during the save stay in the editor.
          window.history.replaceState(null, "", `/admin/training-plans/${payload.plan.id}/konva?${search}`);
        }
        setSaved(snapshot);
        setTitle(snapshotTitle);
        setSavedTitle(snapshotTitle);
        setDescription(snapshotDescription);
        setSavedDescription(snapshotDescription);
        setRevision(payload.plan.updatedAt);
        setSavedCategoryId(snapshotCategoryId);
        setConflict(false);
        setStatus(creating ? "Планът е създаден." : "Промените са запазени.");
        try {
          const storedDraft = localStorage.getItem(key);
          const d = readDraft(storedDraft);
          if ((creating && storedDraft && storedDraft === lastWrittenDraft.current) ||
              (d && matchesDraft(d, snapshot, snapshotTitle, snapshotDescription, snapshotCategoryId)))
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
  function closeConflict() {
    conflictDialog.current?.close();
    setShowConflict(false);
    setConfirmReload(false);
  }
  function cancelReload() {
    setConfirmReload(false);
    requestAnimationFrame(() => reloadButton.current?.focus());
  }
  async function reload() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${endpoint}?inlineBackground=1`, { cache: "no-store" }),
        data = await response.json();
      if (!response.ok || validateExercise(data.plan?.layout))
        throw new Error(data.error || "Невалиден запис.");
      setHistory({ past: [], present: data.plan.layout, future: [] });
      setSaved(data.plan.layout);
      setCategoryId(data.plan.categoryId ?? null);
      setSavedCategoryId(data.plan.categoryId ?? null);
      setTitle(data.plan.title);
      setTitleRequired(false);
      setSavedTitle(data.plan.title);
      setDescription(data.plan.description ?? "");
      setSavedDescription(data.plan.description ?? "");
      setRevision(data.plan.updatedAt);
      setConflict(false);
      closeConflict();
      setSelected(null);
      setPitchSelection(null);
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
  function closeWarning() {
    warningDialog.current?.close();
    setRemainingPitchObjects(null);
  }
  function restoreDraft(restore: boolean) {
    if (restore && recovery) {
      change(recovery.layout);
      if (recovery.title !== undefined) setTitle(recovery.title);
      if (recovery.description !== undefined) setDescription(recovery.description);
      if (recovery.categoryId !== undefined) setCategoryId(recovery.categoryId);
      if (planId && recovery.baseRevision !== revision) {
        setConflict(true);
        setShowConflict(true);
      }
      // The recovered content still belongs to its original server revision.
      // Keep that base for draft persistence and optimistic save checks.
      setRevision(recovery.baseRevision);
    }
    try {
      if (!restore) localStorage.removeItem(key);
    } catch {
      setStorageError(true);
    }
    recoveryDialog.current?.close();
    setRecovery(null);
  }
  function reorder(delta: number) {
    if (multiActive) {
      const rest = layout.objects.filter((o) => !batchIds.has(o.id));
      change({ ...layout, objects: delta < 0 ? [...batch, ...rest] : [...rest, ...batch] });
      return;
    }
    if (!object) return;
    const next = [...layout.objects],
      at = next.findIndex((o) => o.id === object.id),
      to = Math.max(0, Math.min(next.length - 1, at + delta));
    next.splice(at, 1);
    next.splice(to, 0, object);
    change({ ...layout, objects: next });
  }
  useEffect(() => {
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === pageRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === pageRef.current) await document.exitFullscreen();
      else await pageRef.current?.requestFullscreen();
    } catch {
      setError("Неуспешно отваряне на цял екран.");
    }
  }

  function navigateAway(path: string) {
    if (dirty || recovery) setLeavePath(path);
    else router.push(path);
  }

  function closeLeaveDialog() {
    leaveDialog.current?.close();
    setLeavePath(null);
  }

  function selectTool(next: ExerciseTool) {
    cancelPlacement();
    if (tool === next) return;
    setTool(next);
    const defaultPath = FOOTBALL.defaultPaths[next];
    if (defaultPath) setPathMode(defaultPath);
  }

  const showToolsSheet = compact && toolsOpen && !showDetails && !pitchSelection && !recovery && !showConflict && !leavePath;
  useEffect(() => {
    const dialog = toolsDialog.current;
    if (!dialog) return;
    if (showToolsSheet && !dialog.open) dialog.showModal();
    if (!showToolsSheet && dialog.open) dialog.close();
  }, [compact, showToolsSheet]);

  function startToolsDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || toolsDrag.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    toolsDrag.current = { pointerId: event.pointerId, startY: event.clientY };
    toolsDialog.current?.setAttribute("data-dragging", "");
  }

  function moveToolsDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = toolsDrag.current;
    if (drag?.pointerId !== event.pointerId) return;
    toolsDialog.current?.style.setProperty("--ke-tools-offset", `${Math.max(0, event.clientY - drag.startY)}px`);
  }

  function finishToolsDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = toolsDrag.current;
    if (drag?.pointerId !== event.pointerId) return;
    toolsDrag.current = null;
    const dialog = toolsDialog.current;
    dialog?.removeAttribute("data-dragging");
    if (event.type === "pointerup" && event.clientY - drag.startY >= 72) {
      dialog?.close();
      setToolsOpen(false);
    }
    dialog?.style.removeProperty("--ke-tools-offset");
  }

  function selectQuickTool(next: (typeof QUICK_TOOLS)[number][0]) {
    setShowDetails(false);
    setShowPitchOptions(false);
    setAddingTeam(false);
    if (next === "balls-and-goals") {
      cancelPlacement();
      setCategory(BALLS_AND_GOALS_CATEGORY);
      setBrowsingTools(true);
      requestAnimationFrame(() => toolsRef.current?.querySelector("button")?.focus());
    } else {
      setCategory(TOOLBAR_GROUPS.findIndex(({ types }) => types.includes(next)));
      selectTool(next);
    }
  }

  async function importBackground(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setImportingImage(true);
    setImageError("");
    try {
      const image = await readBackgroundImage(file);
      const current = state.current.layout;
      change({ ...current, background: placeBackgroundImage(image, current) });
      selectQuickTool("line");
      setToolsOpen(false);
      setPathMode("freehand");
      setLineArrowhead(false);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Изображението не може да бъде отворено.");
    } finally {
      setImportingImage(false);
    }
  }

  function removeBackground() {
    const next = { ...layout };
    delete next.background;
    change(next);
    setImageError("");
    importImageButton.current?.focus();
  }

  function togglePitchOptions() {
    if (!pitchOptionsVisible) {
      if (!compact) {
        setShowDetails(false);
        setCategory(LINES_AND_AREAS_CATEGORY);
      }
      cancelPlacement();
      setAddingTeam(false);
      if (compact) {
        requestAnimationFrame(() => pitchOptionsRef.current?.querySelector("button")?.focus());
      }
    }
    setShowPitchOptions(!pitchOptionsVisible);
  }

  const imageControls = (
    <div className="ke-image-controls" role="group" aria-label="Фоново изображение">
      <button ref={importImageButton} type="button" disabled={importingImage || saving}
        onClick={() => imageInput.current?.click()}>
        <ImagePlus size={18} aria-hidden="true" />
        {layout.background ? "Смени изображението" : "Внеси изображение"}
      </button>
      <input ref={imageInput} type="file" hidden accept={BACKGROUND_IMAGE_TYPES.join(",")}
        aria-label="Избери изображение" onChange={importBackground} />
      {layout.background && (
        <button type="button" disabled={importingImage || saving}
          title="Премахни изображението" aria-label="Премахни изображението" onClick={removeBackground}>
          <Trash2 size={18} aria-hidden="true" />
        </button>
      )}
      {importingImage && <span role="status">Обработка на изображението…</span>}
      {imageError && <p className="ke-error" role="alert">{imageError}</p>}
    </div>
  );

  const selectionControls = (
    <>
      <button type="button" aria-label="Избор на обект" title="Избор на обект"
        aria-pressed={selectionActive}
        onClick={() => {
          cancelPlacement();
          setShowPitchOptions(false);
          if (teamsOpen) setCategory(0);
          setAddingTeam(false);
          setToolsOpen(false);
        }}>
        <MousePointer2 size={19} aria-hidden="true" />
        <span>Избор</span>
      </button>
      <button type="button" title="Избери всички"
        disabled={batch.length === visibleObjects.length} onClick={() => {
          selectAllVisibleObjects();
          setShowPitchOptions(false);
          setToolsOpen(false);
        }}>
        <SquareDashed size={19} aria-hidden="true" />
        <span>Избери всички</span>
      </button>
    </>
  );

  const drawingHint = (
    <div className="ke-drawing-hint">
      <Info size={15} aria-hidden="true" />
      <span>
        {panning
          ? "Превъртете, за да преместите изгледа."
          : tool === "select"
          ? multiActive ? "Изберете обекти или очертайте област." : "Изберете инструмент или обект на игрището."
          : tool === "text"
          ? "Изберете място на игрището за текста."
          : placing
            ? "Изберете място за всеки обект."
            : drawingArrow
              ? "Плъзнете по игрището, за да нарисувате стрелка."
              : "Плъзнете по игрището, за да нарисувате линия или фигура."}
        {compact
          ? " За да спрете рисуването или поставянето, натиснете „Избор“ над игрището."
          : " Натиснете Esc или щракнете с десния бутон, за да отмените и да преминете към „Избор“."}
      </span>
    </div>
  );

  const ToolsPanel = compact ? "dialog" : "div";
  const pitchOptions = (
    <fieldset className="ke-pitch-options" ref={pitchOptionsRef}>
      <legend>Игрище</legend>
      {FOOTBALL.surfaces.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={(pitchSelection ? "full" : layout.surface) === id}
          onClick={id === "blank" ? selectBlankField : (event) => openPitchPicker(event.currentTarget)}
        >
          {label}
        </button>
      ))}
      {layout.surface === "full" && (
        <button className="ke-pitch-parts-button" type="button"
          onClick={(event) => openPitchPicker(event.currentTarget)}>
          Избери части от игрището
        </button>
      )}
      {layout.surface === "half" && (
        <p className="ke-pitch-legacy">Запазено половин игрище</p>
      )}
    </fieldset>
  );
  const panels = (
    <div className="ke-panel-switch" role="group" aria-label="Панел на редактора" inert={!!pitchSelection}>
      <button type="button" ref={toolsTrigger} aria-controls={toolsId}
        aria-expanded={compact ? showToolsSheet : undefined}
        aria-pressed={!showDetails}
        onClick={(event) => {
          if (compact) {
            event.currentTarget.focus({ preventScroll: true });
            setToolsOpen(true);
          }
          setShowDetails(false);
        }}>
        <Waypoints size={17} aria-hidden="true" /> Инструменти
      </button>
      <button type="button" aria-pressed={showDetails} aria-controls={detailsId} onClick={() => {
        setToolsOpen(false);
        setShowDetails(true);
      }}>
        <NotebookText size={17} aria-hidden="true" /> Детайли
      </button>
    </div>
  );

  function changeZoom(value: number) {
    setZoom(value);
    if (value === 100) setPanning(false);
  }

  const zoomControls = (
    <div className="ke-zoom" role="group" aria-label="Мащаб на игрището">
      <button type="button" aria-label="Намали мащаба" title="Намали мащаба" disabled={zoom === 100}
        onClick={() => changeZoom(zoom - 25)}><Minus size={17} aria-hidden="true" /></button>
      <button type="button" aria-label={`Мащаб ${zoom}%, възстанови размера`} title="Възстанови размера"
        onClick={() => changeZoom(100)}>{zoom}%</button>
      <button type="button" aria-label="Увеличи мащаба" title="Увеличи мащаба" disabled={zoom === 200}
        onClick={() => changeZoom(zoom + 25)}><Plus size={17} aria-hidden="true" /></button>
    </div>
  );
  const fullscreenLabel = fullscreen ? "Изход от цял екран" : "Цял екран";
  const fullscreenButton = (
    <button type="button" aria-label={fullscreenLabel} title={fullscreenLabel} onClick={() => void toggleFullscreen()}>
      {fullscreen ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
    </button>
  );
  const historyControls = (
    <div className="ke-quick-history" role="group" aria-label="История">
      <button type="button" aria-label="Отмени последната промяна" title="Отмени"
        disabled={!history.past.length} onClick={() => setHistory(undo)}><Undo2 size={18} aria-hidden="true" /></button>
      <button type="button" aria-label="Повтори последната промяна" title="Повтори"
        disabled={!history.future.length} onClick={() => setHistory(redo)}><Redo2 size={18} aria-hidden="true" /></button>
    </div>
  );

  const multiActions = multiActive && (
    <div className="ke-multi-actions" role="group" aria-label="Действия за множествен избор">
      <p role="status">
        {batch.length ? `Избрани обекти: ${batch.length}` : "Изберете обекти на игрището."}
      </p>
      <button
        type="button"
        disabled={batch.length === visibleObjects.length}
        onClick={selectAllVisibleObjects}
      >
        Избери всички
      </button>
      {batch.length > 0 && (
        <>
          <ObjectColorInput
            color={batch[0].color}
            onCommit={(color, group, preview) => updateObjectColor(batchIds, color, group, preview)}
          />
          <button type="button" aria-label="Дублирай избраните" title="Дублирай избраните" onClick={duplicate} disabled={!canDuplicateBatch}>
            <Copy size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Изтрий избраните" title="Изтрий избраните" onClick={remove}>
            <Trash2 size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Изпрати избраните най-отзад" title="Изпрати избраните най-отзад" onClick={() => reorder(-1)}>
            <ArrowDown size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Премести избраните най-отпред" title="Премести избраните най-отпред" onClick={() => reorder(1)}>
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        </>
      )}
      <button type="button" aria-label="Край на множествения избор" title="Край на множествения избор" onClick={cancelPlacement}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <main className="ke-page" ref={pageRef}>
      <div className="ke-inner">
        {(subscription.error || subscription.access && !subscription.access.canSave) && <div className="ke-feedback ke-subscription-notice tp-subscription-notice" role="status">{subscription.error || trainingSubscriptionInactiveMessage}{subscription.error && <button type="button" onClick={() => void subscription.refresh().catch(() => {})}>Опитай отново</button>}</div>}
        <header className="ke-header">
          <div className="ke-header-bar">
            <button
              type="button"
              className="ke-back"
              aria-label="Към плановете"
              onClick={() => navigateAway(`/admin/training-plans?${search}`)}
            >
              <ArrowLeft size={18} />
              <span>Към плановете</span>
            </button>
            <h1><Waypoints size={24} aria-hidden="true" />{planId ? "Редактор на план" : "Нов план"}</h1>
            <button
              type="button"
              className="ke-primary"
              disabled={saving || importingImage || (!!subscription.access?.canSave && !dirty && !conflict) || !!recovery || !!pitchSelection || addingCategory}
              onClick={() => {
                if (!subscription.access?.canSave) setError(trainingSubscriptionMessage);
                else if (conflict && title.trim()) setShowConflict(true);
                else void save();
              }}
            >
              <Save size={18} />
              {saving ? "Записване…" : "Запази"}
            </button>
            <span className="ke-save-status" role="status">
              {!dirty && planId && <Check size={17} aria-hidden="true" />}
              {dirty ? "Незапазени промени" : status || (planId ? "Промените са запазени" : "Незаписан план")}
            </span>
          </div>
        </header>
        {(copyId || (error && !showConflict) || storageError) && (
          <div className="ke-feedback" aria-live="polite">
            {copyId && (
              <a
                href={`/admin/training-plans/${copyId}/konva?${search}`}
                onClick={(event) => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  navigateAway(event.currentTarget.pathname + event.currentTarget.search);
                }}
              >
                Отвори запазеното копие
              </a>
            )}
            {error && !showConflict && (
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
        )}
        <dialog
          ref={leaveDialog}
          className="ke-dialog"
          aria-labelledby={leaveTitleId}
          aria-describedby={leaveDescriptionId}
          onCancel={(event) => {
            event.preventDefault();
            closeLeaveDialog();
          }}
        >
          <h2 id={leaveTitleId}>Има незапазени промени</h2>
          <p id={leaveDescriptionId}>Да напуснете ли редактора?</p>
          <div className="ke-dialog-actions">
            <button type="button" className="ke-primary" onClick={closeLeaveDialog}>
              Продължи редактирането
            </button>
            <button type="button" onClick={() => {
              if (!leavePath) return;
              persistDraft();
              closeLeaveDialog();
              router.push(leavePath);
            }}>
              Напусни
            </button>
          </div>
        </dialog>
        {recovery && (
          <dialog
            ref={recoveryDialog}
            className="ke-dialog"
            aria-labelledby={recoveryTitleId}
            aria-describedby={recoveryDescriptionId}
            onCancel={(event) => event.preventDefault()}
          >
            <h2 id={recoveryTitleId}>Открити са незапазени промени</h2>
            <p id={recoveryDescriptionId}>
              {planId && recovery.baseRevision !== revision
                ? "Записът на сървъра е променен. Възстановете промените и запазете копие или ги отхвърлете."
                : "Да възстановим ли локалните промени?"}
            </p>
            <div className="ke-dialog-actions">
              <button type="button" className="ke-primary" onClick={() => restoreDraft(true)}>
                Възстанови
              </button>
              <button type="button" onClick={() => restoreDraft(false)}>
                Отхвърли
              </button>
            </div>
          </dialog>
        )}
        {showConflict && (
          <dialog
            ref={conflictDialog}
            className="ke-dialog"
            aria-labelledby={conflictTitleId}
            aria-describedby={conflictDescriptionId}
            onKeyDown={(event) => {
              if (event.key === "Escape" && confirmReload) {
                event.preventDefault();
                if (!savingRef.current) cancelReload();
              }
            }}
            onCancel={(event) => {
              event.preventDefault();
              if (savingRef.current) return;
              if (confirmReload) cancelReload();
              else closeConflict();
            }}
          >
            <h2 id={conflictTitleId}>{confirmReload ? "Зареждане от сървъра" : "Има по-нов запис"}</h2>
            <p id={conflictDescriptionId}>
              {confirmReload
                ? "Да заменим текущите промени с последния запис от сървъра?"
                : "Текущите промени остават в редактора. Можете да ги запазите като нов план или да заредите последния запис от сървъра."}
            </p>
            {error && <p className="ke-error" role="alert">{error}</p>}
            <div className="ke-dialog-actions">
              {confirmReload ? (
                <>
                  <button ref={reloadCancelButton} type="button" className="ke-primary"
                    disabled={saving} onClick={cancelReload}>Отказ</button>
                  <button type="button" disabled={saving} onClick={() => void reload()}>
                    {saving ? "Зареждане…" : "Замени промените"}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="ke-primary"
                    disabled={saving || !!pitchSelection} onClick={() => void save(true)}>
                    Запази като нов план
                  </button>
                  <button ref={reloadButton} type="button" disabled={saving} onClick={() => {
                    setError("");
                    setConfirmReload(true);
                  }}>
                    Зареди от сървъра
                  </button>
                  <button type="button" disabled={saving} onClick={closeConflict}>Отказ</button>
                </>
              )}
            </div>
          </dialog>
        )}
        {remainingPitchObjects && (
          <dialog
            ref={warningDialog}
            className="ke-dialog"
            aria-labelledby={warningTitleId}
            aria-describedby={warningDescriptionId}
            onCancel={(event) => {
              event.preventDefault();
              closeWarning();
            }}
          >
            <h2 id={warningTitleId}>Премахване на обекти</h2>
            <p id={warningDescriptionId}>Обектите в неизбраните части на игрището ще бъдат премахнати.</p>
            <div className="ke-dialog-actions">
              <button type="button" className="ke-primary" onClick={closeWarning}>Отказ</button>
              <button type="button" onClick={() => {
                closeWarning();
                closePitchPicker(remainingPitchObjects);
              }}>
                Приложи и премахни
              </button>
            </div>
          </dialog>
        )}
        <fieldset disabled={!!recovery} className="ke-workspace">
          <legend className="ke-sr">Инструменти за упражнението</legend>
          <div className="ke-layout">
            {compact && panels}
            {compact && !pitchSelection && imageControls}
            <div
              className={pitchSelection ? "ke-pitch-area ke-pitch-area--picker" : "ke-pitch-area"}
              ref={pitchPicker}
              hidden={compact && showDetails && !pitchSelection}
            >
              {!compact && <div className="ke-canvas-toolbar" inert={!!pitchSelection}>
                <div className="ke-quick-tools" role="group" aria-label="Бързи инструменти">
                  {selectionControls}
                  {QUICK_TOOLS.map(([next, Icon, label]) => (
                    <button key={next} type="button" aria-label={label} title={label}
                      aria-pressed={next === "balls-and-goals" ? ballsAndGoalsActive : tool === next ||
                        (next === "team1-player-1" && teamsOpen && !multiActive)}
                      onClick={() => selectQuickTool(next)}>
                      <Icon size={19} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  ))}
                  <button type="button" aria-label="Игрище" title="Игрище" aria-controls={pitchOptionsId}
                    aria-pressed={pitchOptionsVisible}
                    aria-expanded={pitchOptionsVisible} disabled={!!pitchSelection} onClick={togglePitchOptions}>
                    <ScanLine size={19} aria-hidden="true" />
                    <span>Игрище</span>
                  </button>
                </div>
                <div className="ke-canvas-actions">
                  {historyControls}
                  <button type="button" aria-label="Изчисти игрището" title="Изчисти игрището"
                    disabled={visibleObjects.length === 0} onClick={clearPitch}><Trash2 size={18} aria-hidden="true" /></button>
                  <button type="button" aria-label="Завърти игрището на 90°" title="Завърти игрището на 90°"
                    onClick={rotatePitch}><RotateCw size={18} aria-hidden="true" /></button>
                  {zoomControls}
                  {zoom > 100 && (
                    <button type="button" aria-label="Премести изгледа" title="Премести изгледа"
                      aria-pressed={panning} onClick={() => setPanning(!panning)}>
                      <Hand size={17} aria-hidden="true" />
                    </button>
                  )}
                  {fullscreenButton}
                </div>
              </div>}
              {compact && !pitchSelection && (
                <div className="ke-mobile-selection" role="group" aria-label="Избор на игрището">
                  {selectionControls}
                </div>
              )}
              {pitchSelection && (
                <div className="ke-pitch-picker-actions">
                  <p>Изберете части директно върху игрището.</p>
                  <button type="button" className="ke-primary" onClick={applyPitchSelection}>Приложи</button>
                  <button type="button" onClick={() => closePitchPicker()}>Отказ</button>
                </div>
              )}
              {!compact && !pitchSelection && imageControls}
              <div className="ke-pitch-frame"
                data-zoomed={!pitchSelection && zoom > 100}
                style={{ "--ke-zoom": zoom / 100, "--ke-pitch-ratio": viewWidth / viewHeight } as CSSProperties}
                tabIndex={!pitchSelection && zoom > 100 ? 0 : undefined}
                role="region" aria-label="Изглед на игрището">
                <div className="ke-pitch-scroll" inert={panning && !pitchSelection}>
                  <Canvas
                    exercise={layout}
                    visibleObjects={pitchSelection ? layout.objects : visibleObjects}
                    surfacePreview={pitchSelection ? "full" : undefined}
                    pitchOverlay={pitchSelection && (
                      <div className="ke-pitch-quadrants" role="group" aria-label="Части от игрището">
                        {PITCH_QUADRANT_ORDER[pitchRotation].map((index, screenIndex) => {
                          const quadrant = PITCH_QUADRANTS[index];
                          const enabled = pitchSelection.includes(quadrant);
                          return (
                            <button
                              key={quadrant}
                              type="button"
                              aria-label={FOOTBALL.quadrantLabels[PITCH_QUADRANTS[screenIndex]]}
                              aria-pressed={enabled}
                              disabled={enabled && pitchSelection.length === 1}
                              onClick={() => toggleQuadrant(quadrant)}
                            />
                          );
                        })}
                      </div>
                    )}
                    selected={selected}
                    multiSelection={multiActive ? batchIds : null}
                    multiAnchorId={multiAnchorId ?? undefined}
                    tool={recovery ? "select" : tool}
                    placementOnly={tool !== "select"}
                    customTeamNumber={customTeamNumber}
                    pathMode={pathMode}
                    lineArrowhead={lineArrowhead}
                    colorPreviewId={
                      colorPreview?.group === history.group &&
                      colorPreview?.id === selected
                        ? colorPreview.id
                        : undefined
                    }
                    selectedLabel={object ? objectLabel(object) : undefined}
                    objectActions={multiActive ? multiActions : object && (
                      <ObjectActions
                        key={object.id}
                        object={object}
                        editLabelOnMount={selection?.editLabel ?? false}
                        onColorChange={(color, group, preview) =>
                          updateObjectColor(object.id, color, group, preview)
                        }
                        onLabelChange={updateLabel}
                        onToggleArrowhead={() => patch({ arrowhead: object.arrowhead ? undefined : true })}
                        onDuplicate={duplicate}
                        onRemove={remove}
                        onReorder={reorder}
                        canDuplicate={layout.objects.length < MAX_ITEMS}
                        canMoveBack={layout.objects[0].id !== object.id}
                        canMoveForward={layout.objects.at(-1)!.id !== object.id}
                      />
                    )}
                    onSelect={selectOnPitch}
                    onSelectArea={(ids) => setMultiSelection((current) =>
                      current && (ids.length || current.size) ? new Set(ids) : current,
                    )}
                    onCommit={change}
                    onPlaced={onPlaced}
                    onError={setError}
                    onCancelPlacement={cancelPlacement}
                  />
                </div>
              </div>
              {compact && !pitchSelection && (
                <div className="ke-mobile-pitch-controls">
                  <div className="ke-mobile-pitch-actions" role="group" aria-label="Действия с игрището">
                    <button type="button" aria-label="Завърти игрището на 90°" onClick={rotatePitch}>
                      <RotateCw size={17} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Изчисти игрището" disabled={!visibleObjects.length} onClick={clearPitch}>
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="ke-canvas-actions">
                    {historyControls}
                    {zoomControls}
                  </div>
                  {zoom > 100 && (
                    <button type="button" className="ke-mobile-pan" aria-pressed={panning} onClick={() => setPanning(!panning)}>
                      <Hand size={17} aria-hidden="true" /> Премести изгледа
                    </button>
                  )}
                </div>
              )}
              {compact && !pitchSelection && drawingHint}
            </div>
            <div className="ke-sidebar" data-details={showDetails && !pitchSelection}>
              {!compact && panels}
              <div className="ke-plan-details" id={detailsId} hidden={!showDetails || (compact && !!pitchSelection)}>
                <div>
                  <label>
                    <span>Име на плана <span aria-hidden="true">*</span></span>
                    <input
                      ref={titleInput}
                      type="text"
                      value={title}
                      maxLength={MAX_PLAN_TITLE_LENGTH}
                      required
                      aria-invalid={titleInvalid || undefined}
                      aria-describedby={titleInvalid ? titleErrorId : undefined}
                      disabled={saving || !!recovery}
                      onChange={(event) => {
                        setTitle(event.currentTarget.value);
                        setStatus("");
                        if (event.currentTarget.value.trim()) setTitleRequired(false);
                      }}
                    />
                  </label>
                  {titleInvalid && <span id={titleErrorId} className="ke-error ke-plan-title-error" role="alert">Името е задължително.</span>}
                </div>
                <div className="ke-plan-category">
                  <label>
                    Категория
                    <select
                      ref={categorySelect}
                      value={categoryId ?? ""}
                      disabled={saving || !!recovery || addingCategory}
                      onChange={(event) => {
                        setCategoryId(event.currentTarget.value || null);
                        setStatus("");
                      }}
                    >
                      <option value="">Без категория</option>
                      {categoryId && !categoryOptions.some(({ id }) => id === categoryId) && (
                        <option value={categoryId}>Текуща категория</option>
                      )}
                      {categoryOptions.map(({ id, name }) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </label>
                  {newCategoryName === null ? (
                    <button type="button" className="ke-add-category"
                      disabled={saving || !!recovery} onClick={() => setNewCategoryName("")}>
                      <Plus size={18} aria-hidden="true" /> Нова категория
                    </button>
                  ) : (
                    <form className="ke-plan-category" onSubmit={(event) => { event.preventDefault(); void addCategory(); }}>
                      <label>
                        Име на категорията
                        <input autoFocus maxLength={60} value={newCategoryName} readOnly={addingCategory}
                          onChange={(event) => setNewCategoryName(event.target.value)} />
                      </label>
                      {categoryError && <span className="ke-error" role="alert">{categoryError}</span>}
                      <div className="ke-toolbar">
                        <button type="submit" disabled={saving || addingCategory || !newCategoryName.trim()}>
                          {addingCategory ? "Добавяне…" : "Добави"}
                        </button>
                        <button type="button" disabled={addingCategory} onClick={() => {
                          setNewCategoryName(null);
                          setCategoryError("");
                          categorySelect.current?.focus();
                        }}>Отказ</button>
                      </div>
                    </form>
                  )}
                </div>
                <label className="ke-plan-description">
                  Описание
                  <span className="ke-field-icon">
                    <NotebookText size={17} aria-hidden="true" />
                    <textarea
                      value={description}
                      maxLength={MAX_PLAN_DESCRIPTION_LENGTH}
                      rows={6}
                      disabled={saving || !!recovery}
                      onChange={(event) => {
                        setDescription(event.currentTarget.value);
                        setStatus("");
                      }}
                    />
                  </span>
                </label>
              </div>
              <ToolsPanel id={toolsId} ref={(element: HTMLDialogElement | HTMLDivElement | null) => {
                toolsDialog.current = element instanceof HTMLDialogElement ? element : null;
              }}
                className={compact ? "ke-tools-sheet" : undefined}
                hidden={!compact && showDetails}
                aria-labelledby={compact ? toolsHeadingId : undefined}
                onCancel={compact ? (event) => {
                  event.preventDefault();
                  setToolsOpen(false);
                } : undefined}
                onClose={compact ? () => setBrowsingTools(false) : undefined}
                onClick={compact ? (event) => {
                  if (event.target === event.currentTarget) setToolsOpen(false);
                } : undefined}>
                {compact ? (
                  <>
                    <div className="ke-tools-grip" aria-hidden="true"
                      onPointerDown={startToolsDrag}
                      onPointerMove={moveToolsDrag}
                      onPointerUp={finishToolsDrag}
                      onPointerCancel={finishToolsDrag}
                      onLostPointerCapture={finishToolsDrag}
                    />
                    <div className="ke-tools-sheet-header">
                      <h2 id={toolsHeadingId}><Waypoints size={19} aria-hidden="true" /> Инструменти</h2>
                      <button type="button" autoFocus onClick={() => setToolsOpen(false)}>Към игрището</button>
                    </div>
                  </>
                ) : null}
                {compact && (
                  <div className="ke-sheet-categories" role="group" aria-label="Категории инструменти">
                    <button type="button" aria-controls={pitchOptionsId} aria-expanded={pitchOptionsVisible}
                      aria-pressed={pitchOptionsVisible}
                      onClick={togglePitchOptions}>
                      <ScanLine size={19} aria-hidden="true" /> Игрище
                    </button>
                    {QUICK_TOOLS.map(([next, Icon, label]) => {
                      const groupIndex = TOOLBAR_GROUPS.findIndex(({ types }) => types.includes(next === "balls-and-goals" ? "ball" : next));
                      const currentGroup = next === "team1-player-1" ? teamsOpen : activeCategory === groupIndex;
                      const active = !pitchOptionsVisible && currentGroup && (browsingTools || tool !== "select");
                      return (
                        <button key={next} type="button" aria-pressed={active} onClick={() => {
                          if (next === "text") {
                            selectQuickTool(next);
                            setToolsOpen(false);
                          } else if (!active) {
                            cancelPlacement();
                            setShowPitchOptions(false);
                            setCategory(groupIndex);
                            setBrowsingTools(true);
                            setAddingTeam(false);
                          }
                        }}>
                          <Icon size={19} aria-hidden="true" /> {next === "team1-player-1" ? label : TOOLBAR_GROUPS[groupIndex].title}
                        </button>
                      );
                    })}
                  </div>
                )}
                {teamsOpen && (
                  <>
                    <h2 id={teamsHeadingId} className="ke-tool-heading">Отбори</h2>
                    <div
                      className="ke-categories"
                      inert={!!pitchSelection}
                      role="group"
                      aria-labelledby={teamsHeadingId}
                    >
                      {toolGroups.map((g, i) => {
                        if (!g || i < FIRST_TEAM_CATEGORY) return null;
                        return (
                          <button
                            type="button"
                            key={g.title}
                            aria-pressed={activeCategory === i}
                            onClick={() => {
                              if (i !== activeCategory) cancelPlacement();
                              setCategory(i);
                              if (compact && i !== activeCategory) setBrowsingTools(true);
                              setAddingTeam(false);
                            }}
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
                        );
                      })}
                      <button
                        type="button"
                        ref={addTeamButtonRef}
                        aria-expanded={addingTeam}
                        onClick={() => {
                          if (!addingTeam) {
                            cancelPlacement();
                            setBrowsingTools(compact);
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
                  </>
                )}
                {teamsOpen && addingTeam && (
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
                {!pitchOptionsVisible && activeCategory !== TEXT_CATEGORY && (
                  <>
                    <h2 className="ke-tool-heading">{toolGroup.title}</h2>
                    <div
                      className={activeCategory === 0 ? "ke-tools ke-tools--movement" : "ke-tools"}
                      inert={!!pitchSelection}
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
                              selectTool(t);
                              if (compact && !isMovementType(t)) setToolsOpen(false);
                            }}
                          >
                            {isMovementType(t) ? (
                              <MovementPreview type={t} arrowhead={lineArrowhead && isLineType(t)} />
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
                  </>
                )}
                <div id={pitchOptionsId} hidden={!pitchOptionsVisible} inert={!!pitchSelection}>
                  {pitchOptionsVisible && pitchOptions}
                </div>
                <div className="ke-mode" hidden={!!pitchSelection || pitchOptionsVisible || (compact && !drawingMovement)} onKeyDown={(e) => {
                  if (!compact && tool !== "select" && e.key === "Escape") {
                    e.preventDefault();
                    cancelPlacementFromControls();
                  }
                }}>
                  {drawingMovement && (
                    <div className="ke-path-modes" role="group" aria-label="Начин на рисуване">
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
                    </div>
                  )}
                  {drawingLine && (
                    <button
                      type="button"
                      className="ke-arrowhead-toggle"
                      aria-pressed={lineArrowhead}
                      onClick={() => setLineArrowhead(!lineArrowhead)}
                    >
                      <ArrowRight size={16} aria-hidden="true" />
                      Връх на стрелка
                    </button>
                  )}
                  {!compact && drawingHint}
                </div>
                {teamsOpen && customTeamNumber !== undefined && (
                  <button type="button" className="ke-delete-team" onClick={deleteTeam}>
                    <Trash2 size={16} aria-hidden="true" />
                    Изтрий отбор
                  </button>
                )}
              </ToolsPanel>
            </div>
          </div>
        </fieldset>
      </div>
    </main>
  );
}
