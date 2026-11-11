"use client";
import {
  useCallback,
  useEffect,
  useEffectEvent,
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
  Pencil,
  Redo2,
  Save,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FOOTBALL } from "@/lib/exercise/football";
import {
  HEIGHT,
  WIDTH,
  createObject,
  isMovementType,
  isZoneType,
  validateExercise,
  type Exercise,
  type ExerciseObject,
  type ExerciseTool,
} from "@/lib/exercise/model";
import {
  commit,
  duplicateObject,
  movementPoints,
  offsetPolyline,
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

const EQUIPMENT_LABELS = FOOTBALL.labels;
const TOOLBAR_GROUPS = FOOTBALL.tools;
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
  onColorChange: (color: string, group: symbol, preview: boolean) => void;
  onLabelChange: (label: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onReorder: (delta: number) => void;
  canDuplicate: boolean;
  canMoveBack: boolean;
  canMoveForward: boolean;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const editTitle =
    object.kind === "player" ? "Редактирай номер" : "Редактирай текст";

  function closeLabelEditor() {
    setEditingLabel(false);
    requestAnimationFrame(() => editButton.current?.focus());
  }

  if (editingLabel) {
    return (
      <form
        className="ke-object-label"
        onSubmit={(e) => {
          e.preventDefault();
          const label = new FormData(e.currentTarget).get("label");
          if (typeof label === "string" && label !== object.label) {
            onLabelChange(label);
          }
          closeLabelEditor();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            closeLabelEditor();
          }
        }}
      >
        <input
          autoFocus
          name="label"
          defaultValue={object.label ?? ""}
          maxLength={40}
          aria-label={object.kind === "player" ? "Номер" : "Текст"}
        />
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
  const d = pathData(o.action === "shot" ? offsetPolyline(p, 3) : p);
  const n = p.length,
    a = Math.atan2(p[n - 1] - p[n - 3], p[n - 2] - p[n - 4]);
  const tip = `M${p[n - 2] - Math.cos(a - 0.5) * 9},${p[n - 1] - Math.sin(a - 0.5) * 9} L${p[n - 2]},${p[n - 1]} L${p[n - 2] - Math.cos(a + 0.5) * 9},${p[n - 1] - Math.sin(a + 0.5) * 9}`;
  return (
    <svg viewBox="0 0 85 30" width="70" height="24" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeDasharray={style.dash.join(" ")}
      />
      {o.action === "shot" && (
        <path
          d={pathData(offsetPolyline(p, -3))}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      )}
      {style.arrow && (
        <path d={tip} fill="none" stroke="currentColor" strokeWidth="2" />
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
  const [selected, setSelected] = useState<string | null>(null),
    [tool, setTool] = useState<ExerciseTool | "select">("select");
  const [placementCount, setPlacementCount] = useState("1");
  const toolsRef = useRef<HTMLDivElement>(null);
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
  const dirty = useMemo(() => !sameExercise(layout, saved), [layout, saved]);
  const object = layout.objects.find((o) => o.id === selected);
  const drawingMovement = isMovementType(tool);
  const drawingArrow =
    drawingMovement && tool !== "line" && tool !== "dashed-line";
  const placing =
    tool !== "select" && !drawingMovement && !isZoneType(tool);
  const usesQuantity = placing || drawingArrow;
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
    if (!usesQuantity) {
      setSelected(placed.id);
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
                {TOOLBAR_GROUPS.map((g, i) => (
                  <button
                    type="button"
                    key={g.title}
                    aria-pressed={category === i}
                    onClick={() => setCategory(i)}
                  >
                    {g.title}
                  </button>
                ))}
              </div>
              <div
                className="ke-tools"
                ref={toolsRef}
                role="group"
                aria-label={TOOLBAR_GROUPS[category].title}
              >
                {TOOLBAR_GROUPS[category].types.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tool === t}
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
                    ) : (
                      <EquipmentPreview type={t} />
                    )}
                    <span>{EQUIPMENT_LABELS[t]}</span>
                  </button>
                ))}
              </div>
              <div className="ke-mode">
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
                {category === 0 && !placing && (
                  <fieldset className="ke-path-modes">
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
                <p>
                  {tool === "select"
                    ? "Изберете обект за редакция или го плъзнете за преместване."
                    : placing
                      ? "Изберете място за всеки обект."
                      : drawingArrow
                        ? "Плъзнете по игрището, за да нарисувате стрелка."
                        : "Плъзнете за движение или зона. Escape отменя."}
                </p>
              </div>
            </div>
            <div className="ke-pitch-area">
              <Canvas
                exercise={layout}
                selected={selected}
                tool={
                  recovery || (usesQuantity && !validQuantity) ? "select" : tool
                }
                placementOnly={usesQuantity}
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
                    onColorChange={(color, group, preview) =>
                      updateObjectColor(object.id, color, group, preview)
                    }
                    onLabelChange={(label) => patch({ label })}
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
