"use client";
import {
  memo,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Konva from "konva";
import { Circle, Group, Layer, Rect, Shape, Stage, Transformer } from "react-konva";
import {
  HEIGHT,
  PITCH_QUADRANTS,
  WIDTH,
  createObject,
  getCustomTeamColors,
  getPitchQuadrants,
  isInPitchQuadrants,
  isLineType,
  nextPlayerLabel,
  textFontSize,
  validateExercise,
  type Exercise,
  type ExerciseObject,
  type ExerciseTool,
  type Point,
} from "@/lib/exercise/model";
import { createExerciseObjectId } from "@/lib/exercise/objectId";
import { MAX_ITEMS } from "@/lib/trainingPlans";
import {
  clamp,
  clampGroupTranslation,
  drawnObject,
  localPoint,
  movementHandlePoint,
  moveMovementHandle,
  selectionToolbarPosition,
  worldPoint,
} from "@/lib/exercise/geometry";
import {
  ObjectVisual,
  PitchBackground,
  usePitchIcons,
} from "./Visuals";
import { pitchView, pitchViewport } from "./pitchView";
import { measurePitchText, resizePitchText } from "./textLayout";

const BOX_ANCHORS = [
  "top-left", "top-center", "top-right", "middle-left",
  "middle-right", "bottom-left", "bottom-center", "bottom-right",
];
const MULTI_OUTLINE_MARGIN = 3;

const ObjectHitArea = memo(function ObjectHitArea({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <Shape
      fill="#000000"
      sceneFunc={() => {}}
      hitFunc={(ctx, shape) => {
        ctx.beginPath();
        ctx.rect(-width / 2, -height / 2, width, height);
        ctx.fillStrokeShape(shape);
      }}
    />
  );
});

export type CanvasProps = {
  exercise: Exercise;
  visibleObjects: readonly ExerciseObject[];
  surfacePreview?: "full";
  pitchOverlay?: ReactNode;
  selected: string | null;
  multiSelection: ReadonlySet<string> | null;
  multiAnchorId?: string;
  tool: ExerciseTool | "select";
  customTeamNumber?: number;
  placementOnly: boolean;
  pathMode: "straight" | "curve" | "freehand";
  lineArrowhead: boolean;
  objectActions: ReactNode;
  selectedLabel?: string;
  colorPreviewId?: string;
  onSelect: (id: string | null) => void;
  onSelectArea: (ids: string[]) => void;
  onCommit: (next: Exercise) => void;
  onPlaced: (object: ExerciseObject) => void;
  onError: (message: string) => void;
};
export default function Canvas({
  exercise,
  visibleObjects,
  surfacePreview,
  pitchOverlay,
  selected,
  multiSelection,
  multiAnchorId,
  tool,
  customTeamNumber,
  placementOnly,
  pathMode,
  lineArrowhead,
  objectActions,
  selectedLabel,
  colorPreviewId,
  onSelect,
  onSelectArea,
  onCommit,
  onPlaced,
  onError,
}: CanvasProps) {
  const host = useRef<HTMLDivElement>(null),
    stage = useRef<Konva.Stage>(null),
    transformer = useRef<Konva.Transformer>(null),
    toolbar = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, Konva.Group>());
  const handles = useRef(new Map<string, Konva.Circle>());
  const controls = useRef<Konva.Layer>(null);
  const selectionBox = useRef<Konva.Rect>(null);
  const boxGesture = useRef<{
    start: Point;
    pointerId: number;
    targetId: string | null;
    objects?: ExerciseObject[];
    moved: boolean;
  } | null>(null);
  const dragOrigin = useRef<{
    node: Konva.Node;
    parent: Konva.Container;
    index: number;
  } | null>(null);
  const selectionDrag = useRef<{
    leader: ExerciseObject;
    objects: ExerciseObject[];
  } | null>(null);
  const cancelling = useRef(false);
  const [width, setWidth] = useState(0),
    [preview, setPreview] = useState<ExerciseObject | null>(null);
  const icons = usePitchIcons();
  const gesture = useRef<{
    tool: ExerciseTool;
    object: ExerciseObject;
    start: Point;
    samples: Point[];
    pointerId: number;
  } | null>(null);
  const pending = useRef<ExerciseObject | null>(null),
    raf = useRef(0);
  const latest = useRef({ exercise, onCommit, onError });
  useLayoutEffect(() => {
    latest.current = { exercise, onCommit, onError };
  });
  const quadrants = surfacePreview ? PITCH_QUADRANTS : getPitchQuadrants(exercise);
  const viewport = useMemo(() => pitchViewport(quadrants), [quadrants]);
  const pitchRotation = exercise.pitchRotation ?? 0;
  const { viewWidth, viewHeight, scale, viewLayer } = pitchView(viewport, pitchRotation, width);
  function objectRotationOffset(kind: ExerciseObject["kind"]) {
    // Directions and marked areas follow the pitch. Symbols and text face the viewer.
    return kind === "movement" || kind === "zone" ? 0 : pitchRotation;
  }
  function displayedRotation(object: ExerciseObject) {
    return object.rotation - objectRotationOffset(object.kind);
  }
  const selectedObject = visibleObjects.find((o) => o.id === selected);
  const multiAnchor = multiAnchorId ? visibleObjects.find((o) => o.id === multiAnchorId) : undefined;
  const [multiCursor, setMultiCursor] = useState<string | null>(null);
  const cursorIndex = multiSelection
    ? visibleObjects.findIndex((o) => o.id === multiCursor)
    : -1;
  const ignorePitchClick = useRef(false);
  const colorPreviewIndex =
    colorPreviewId && visibleObjects.length > 1
      ? visibleObjects.findIndex((o) => o.id === colorPreviewId)
      : -1;
  const {
    kind,
    x,
    y,
    width: objectWidth,
    height: objectHeight,
    rotation,
    points,
    label,
  } = selectedObject ?? {};
  function previewAtFrame(object: ExerciseObject) {
    pending.current = object;
    if (!raf.current)
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        setPreview(pending.current);
      });
  }
  function isolateObject(node: Konva.Node, hideHandles: boolean) {
    const parent = node.getParent();
    if (!dragOrigin.current && parent && controls.current) {
      dragOrigin.current = { node, parent, index: node.zIndex() };
      node.moveTo(controls.current);
      node.moveToBottom();
    }
    if (hideHandles)
      for (const handle of handles.current.values()) handle.visible(false);
    if (toolbar.current) toolbar.current.hidden = true;
  }
  function restoreDragLayer() {
    const origin = dragOrigin.current;
    if (origin) {
      if (origin.node.getParent() && origin.parent.getStage()) {
        origin.node.moveTo(origin.parent);
        origin.node.zIndex(origin.index);
      }
      dragOrigin.current = null;
    }
    for (const handle of handles.current.values()) handle.visible(true);
    if (toolbar.current) toolbar.current.hidden = false;
  }
  function clear() {
    cancelling.current = true;
    if (transformer.current?.isTransforming())
      transformer.current.stopTransform();
    for (const o of latest.current.exercise.objects) {
      const node = nodes.current.get(o.id);
      if (node) {
        if (node.isDragging()) node.stopDrag();
        node.position(o);
        node.rotation(displayedRotation(o));
        node.scale({ x: 1, y: 1 });
        if (o.kind === "text") resizePitchText(node, o);
      }
      o.points?.forEach((_, i) => {
        const handle = handles.current.get(`${o.id}:${i}`);
        if (handle) {
          handle.stopDrag();
          handle.position(worldPoint(movementHandlePoint(o, i), o));
        }
      });
    }
    if (selectionDrag.current || boxGesture.current?.objects) {
      selectionDrag.current = null;
      controls.current?.batchDraw();
    }
    restoreDragLayer();
    boxGesture.current = null;
    selectionBox.current?.hide();
    cancelling.current = false;
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    pending.current = null;
    gesture.current = null;
    setPreview(null);
  }
  const cancelFromEffect = useEffectEvent(() => clear());

  useLayoutEffect(() => {
    if (surfacePreview || gesture.current || selectionDrag.current || boxGesture.current) cancelFromEffect();
  }, [exercise, multiSelection, surfacePreview, tool, width]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, []);
  useLayoutEffect(() => {
    const node = selected ? nodes.current.get(selected) : null;
    const box = transformer.current;
    const canvas = stage.current;
    const actions = toolbar.current;
    const transformable = node && kind !== "movement";
    box?.nodes(transformable ? [node] : []);
    const anchor = multiAnchor ? nodes.current.get(multiAnchor.id) : node;
    if (!canvas || !actions) return;
    if (!anchor) {
      actions.style.left = "";
      actions.style.top = "";
      return;
    }

    const positionActions = () => {
      if (actions.hidden) return;
      const bounds = anchor.getClientRect({ relativeTo: canvas });
      if (transformable && box) {
        const controlsBounds = box.getClientRect({ relativeTo: canvas });
        bounds.y = controlsBounds.y;
        bounds.height = controlsBounds.height;
      } else if (!multiAnchor) {
        // Keep the toolbar clear of the path handles at every pitch scale.
        bounds.y -= 12;
        bounds.height += 24;
      }
      const position = selectionToolbarPosition(
        bounds,
        { width: actions.offsetWidth, height: actions.offsetHeight },
        { width: canvas.width(), height: canvas.height() },
      );
      if (multiAnchor) {
        // On short pitches the two-row toolbar can otherwise cover its own drag target.
        const center = bounds.y + bounds.height / 2;
        const clearance = 8;
        if (position.y < center + clearance && position.y + actions.offsetHeight > center - clearance) {
          position.y = center < canvas.height() / 2
            ? center + clearance
            : center - actions.offsetHeight - clearance;
        }
      }
      actions.style.left = `${position.x}px`;
      actions.style.top = `${position.y}px`;
    };
    positionActions();
    const observer = new ResizeObserver(positionActions);
    observer.observe(actions);
    return () => observer.disconnect();
  }, [
    selected,
    kind,
    x,
    y,
    objectWidth,
    objectHeight,
    rotation,
    points,
    label,
    width,
    colorPreviewIndex,
    multiAnchor,
    viewport,
    pitchRotation,
  ]);
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" ||
        ((e.ctrlKey || e.metaKey) && ["z", "y"].includes(e.key.toLowerCase()))
      )
        cancelFromEffect();
    };
    const blur = () => cancelFromEffect();
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("blur", blur);
    };
  }, []);
  function position(clampToPitch = true): Point | null {
    const p = stage.current?.getPointerPosition();
    const layer = controls.current;
    if (!p || !scale || !layer) return null;
    const point = layer.getAbsoluteTransform().copy().invert().point(p);
    if (!clampToPitch) return point;
    return {
      x: viewport.x + clamp(point.x - viewport.x, viewport.width),
      y: viewport.y + clamp(point.y - viewport.y, viewport.height),
    };
  }
  function applyObject(object: ExerciseObject) {
    if (!isInPitchQuadrants(object, quadrants)) return false;
    const next = {
      ...latest.current.exercise,
      objects: latest.current.exercise.objects.map((o) =>
        o.id === object.id ? object : o,
      ),
    };
    const error = validateExercise(next);
    if (error) {
      latest.current.onError(error);
      return false;
    }
    latest.current.onCommit(next);
    return true;
  }
  function selectionBounds(start: Point, end: Point) {
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    if (Math.max(width, height) * scale < 4) return null;
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width,
      height,
    };
  }
  function outlineBounds(id: string, margin: number) {
    const node = nodes.current.get(id);
    if (!node) return;
    const bounds = node.getClientRect({ relativeTo: node.getParent() ?? undefined });
    const padding = margin / scale;
    return {
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + 2 * padding,
      height: bounds.height + 2 * padding,
    };
  }
  function outlinedObjectAt(point: Point, directId?: string) {
    const hit = { ...point, width: 0, height: 0 };
    const directBounds = directId ? outlineBounds(directId, MULTI_OUTLINE_MARGIN) : undefined;
    let id = directId ?? null;
    let smallestArea = directBounds ? directBounds.width * directBounds.height : Infinity;
    for (const selectedId of multiSelection ?? []) {
      const bounds = outlineBounds(selectedId, MULTI_OUTLINE_MARGIN);
      if (!bounds || !Konva.Util.haveIntersection(bounds, hit)) continue;
      const area = bounds.width * bounds.height;
      // Prefer the more specific outline when a long path overlaps a smaller object.
      if (area <= smallestArea) {
        id = selectedId;
        smallestArea = area;
      }
    }
    return id;
  }
  function selectHitObject(id: string) {
    const point = position();
    onSelect(point ? outlinedObjectAt(point, id) : id);
  }
  function beginBoxGesture(e: Konva.KonvaEventObject<PointerEvent>, directId?: string) {
    if (!multiSelection || e.evt.button !== 0 || boxGesture.current || selectionDrag.current) return;
    const start = position();
    if (!start || !isInPitchQuadrants(start, quadrants)) return;
    const targetId = outlinedObjectAt(start, directId);
    const objects = targetId && multiSelection.has(targetId)
      ? exercise.objects.filter((object) => multiSelection.has(object.id))
      : undefined;
    if (directId && !objects) return;
    boxGesture.current = { start, pointerId: e.evt.pointerId, targetId, objects, moved: false };
    (e.evt.target as Element).setPointerCapture?.(e.evt.pointerId);
  }
  function down(e: Konva.KonvaEventObject<PointerEvent>) {
    if (e.evt.button !== 0 || gesture.current || boxGesture.current) return;
    if (tool === "select") {
      if (e.target !== stage.current) return;
      if (!multiSelection) {
        onSelect(null);
        return;
      }
      beginBoxGesture(e);
      return;
    }
    const p = position();
    if (!p || !isInPitchQuadrants(p, quadrants)) return;
    if (exercise.objects.length >= MAX_ITEMS) {
      onError(`Позволени са до ${MAX_ITEMS} обекта.`);
      return;
    }
    let customTeam;
    if (tool.startsWith("custom-team-")) {
      if (customTeamNumber === undefined) return;
      const color = getCustomTeamColors(exercise)[customTeamNumber - 3];
      if (!color) return;
      customTeam = { number: customTeamNumber, color };
    }
    const object = createObject(tool, p, createExerciseObjectId(), customTeam);
    if (object.kind === "movement") {
      object.path = pathMode;
      if (exercise.background && isLineType(object.action)) object.color = "#2563eb";
      if (lineArrowhead && isLineType(object.action)) object.arrowhead = true;
    }
    if (object.kind === "text") {
      // Keep the placement tap from focusing the pitch over the new input.
      e.evt.preventDefault();
    }
    if (object.role === "player") {
      object.label = nextPlayerLabel(exercise.objects, object.team);
    }
    gesture.current = {
      tool,
      object,
      start: p,
      samples: [p],
      pointerId: e.evt.pointerId,
    };
    (e.evt.target as Element).setPointerCapture?.(e.evt.pointerId);
  }

  function move(e: Konva.KonvaEventObject<PointerEvent>) {
    const g = gesture.current;
    const box = boxGesture.current;
    const p = position(!box?.objects);
    if (box && p && box.pointerId === e.evt.pointerId) {
      const bounds = selectionBounds(box.start, p);
      if (box.objects) {
        if (!bounds && !box.moved) return;
        box.moved = true;
        ignorePitchClick.current = true;
        translateSelection(box.objects, { x: p.x - box.start.x, y: p.y - box.start.y });
        if (toolbar.current) toolbar.current.hidden = true;
        return;
      }
      if (bounds) {
        selectionBox.current?.setAttrs({ ...bounds, visible: true });
        if (toolbar.current) toolbar.current.hidden = true;
      } else {
        selectionBox.current?.hide();
        if (toolbar.current) toolbar.current.hidden = false;
      }
      return;
    }
    if (!g || !p || g.pointerId !== e.evt.pointerId) return;
    if (g.object.kind !== "movement" && g.object.kind !== "zone") {
      previewAtFrame({ ...g.object, ...p });
      return;
    }
    if (Math.hypot(p.x - g.samples.at(-1)!.x, p.y - g.samples.at(-1)!.y) > 2) {
      g.samples.push(p);
      if (g.samples.length > 1200)
        g.samples = g.samples.filter(
          (_, i) => i % 2 === 0 || i === g.samples.length - 1,
        );
    }
    previewAtFrame(drawnObject(g.object, g.start, p, [...g.samples, p]));
  }
  function up(e: Konva.KonvaEventObject<PointerEvent>) {
    const g = gesture.current;
    const box = boxGesture.current;
    const p = position(!box?.objects);
    if (box && p && box.pointerId === e.evt.pointerId) {
      const bounds = selectionBounds(box.start, p);
      ignorePitchClick.current = true;
      boxGesture.current = null;
      selectionBox.current?.hide();
      if (toolbar.current) toolbar.current.hidden = false;
      if (box.objects && (bounds || box.moved)) {
        const delta = translateSelection(box.objects, { x: p.x - box.start.x, y: p.y - box.start.y });
        commitSelectionMove(delta);
        return;
      }
      if (!bounds) {
        onSelect(box.targetId);
        return;
      }
      const ids = visibleObjects.flatMap(({ id }) => {
        const node = nodes.current.get(id);
        if (!node) return [];
        const rect = node.getClientRect({ relativeTo: node.getParent() ?? undefined });
        return Konva.Util.haveIntersection(bounds, rect) ? [id] : [];
      });
      onSelectArea(ids);
      return;
    }
    if (!g || !p || g.pointerId !== e.evt.pointerId) return;
    if (
      g.tool !== tool ||
      !isInPitchQuadrants(p, quadrants) ||
      (g.tool.startsWith("custom-team-") && g.object.team !== customTeamNumber)
    ) {
      clear();
      return;
    }
    const object =
      g.object.kind === "movement" || g.object.kind === "zone"
        ? drawnObject(g.object, g.start, p, [...g.samples, p])
        : { ...g.object, ...p };
    clear();
    const current = latest.current.exercise;
    if (object.role === "player") {
      object.label = nextPlayerLabel(current.objects, object.team);
    }
    const next = { ...current, objects: [...current.objects, object] };
    if (isInPitchQuadrants(object, quadrants) && !validateExercise(next)) {
      ignorePitchClick.current = object.kind === "text";
      onCommit(next);
      onPlaced(object);
    }
  }
  const rendered = visibleObjects.map((o) =>
    preview?.id === o.id ? preview : o,
  );
  function moveSelection(node: Konva.Node) {
    const drag = selectionDrag.current;
    if (!drag || drag.leader.id !== node.id()) return;
    return translateSelection(drag.objects, {
      x: node.x() - drag.leader.x,
      y: node.y() - drag.leader.y,
    });
  }
  function translateSelection(objects: ExerciseObject[], offset: Point) {
    const delta = clampGroupTranslation(objects, offset, viewport);
    for (const object of objects) {
      nodes.current.get(object.id)?.position({
        x: object.x + delta.x,
        y: object.y + delta.y,
      });
    }
    controls.current?.batchDraw();
    return delta;
  }
  function commitSelectionMove(delta: Point) {
    if (!multiSelection || (!delta.x && !delta.y)) return;
    const current = latest.current.exercise;
    const objects = current.objects.map((object) => multiSelection.has(object.id)
      ? { ...object, x: object.x + delta.x, y: object.y + delta.y }
      : object);
    if (objects.some((object, index) => object !== current.objects[index] && !isInPitchQuadrants(object, quadrants))) {
      clear();
      controls.current?.batchDraw();
      return;
    }
    latest.current.onCommit({ ...current, objects });
  }
  const renderObject = (o: ExerciseObject) => (
    <Group
      key={o.id}
      ref={(node) => {
        if (!node) return;
        nodes.current.set(o.id, node);
        return () => {
          if (nodes.current.get(o.id) === node) nodes.current.delete(o.id);
        };
      }}
      id={o.id}
      x={o.x}
      y={o.y}
      rotation={displayedRotation(o)}
      listening={!placementOnly}
      draggable={!placementOnly && (!multiSelection || multiSelection.has(o.id))}
      onPointerDown={(e) => {
        e.cancelBubble = true;
        if (!multiSelection) onSelect(o.id);
        else if (!multiSelection.has(o.id)) beginBoxGesture(e, o.id);
      }}
      onClick={multiSelection ? (e) => {
        if (e.evt.button === 0 && !ignorePitchClick.current) selectHitObject(o.id);
      } : undefined}
      onTap={multiSelection ? () => {
        if (ignorePitchClick.current) return;
        ignorePitchClick.current = true;
        selectHitObject(o.id);
      } : undefined}
      onDragStart={(e) => {
        e.cancelBubble = true;
        if (multiSelection) {
          if (selectionDrag.current || boxGesture.current) {
            e.target.stopDrag();
            return;
          }
          selectionDrag.current = {
            leader: o,
            objects: exercise.objects.filter((object) => multiSelection.has(object.id)),
          };
          if (toolbar.current) toolbar.current.hidden = true;
          return;
        }
        isolateObject(e.target, true);
        onSelect(o.id);
      }}
      onDragMove={multiSelection ? (e) => {
        e.cancelBubble = true;
        moveSelection(e.target);
      } : undefined}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        if (cancelling.current) return;
        if (multiSelection) {
          const delta = moveSelection(e.target);
          if (!delta) return;
          selectionDrag.current = null;
          if (toolbar.current) toolbar.current.hidden = false;
          commitSelectionMove(delta);
          return;
        }
        restoreDragLayer();
        const node = e.target;
        const next = {
          ...o,
          x: viewport.x + clamp(node.x() - viewport.x, viewport.width),
          y: viewport.y + clamp(node.y() - viewport.y, viewport.height),
        };
        node.position(next);
        if (!applyObject(next)) node.position(o);
      }}
      onTransformStart={(e) => {
        isolateObject(e.target, true);
      }}
      onTransform={o.kind === "text" ? (e) => resizePitchText(e.target, o) : undefined}
      onTransformEnd={(e) => {
        if (cancelling.current) return;
        const node = e.target,
          sx = node.scaleX(),
          sy = node.scaleY();
        const textDimensions = o.kind === "text" ? resizePitchText(node, o) : undefined;
        const next = {
          ...o,
          x: viewport.x + clamp(node.x() - viewport.x, viewport.width),
          y: viewport.y + clamp(node.y() - viewport.y, viewport.height),
          rotation: (node.rotation() + objectRotationOffset(o.kind)) % 360,
          width: Math.max(2, o.width * sx),
          height: Math.max(2, o.height * sy),
          ...(textDimensions ? { ...textDimensions, fontSize: textFontSize(o) } : {}),
        };
        restoreDragLayer();
        node.scale({ x: 1, y: 1 });
        if (o.kind === "text") resizePitchText(node, o);
        if (
          textDimensions &&
          Math.abs(next.width - o.width) < 1e-6 &&
          Math.abs(next.height - o.height) < 1e-6 &&
          Math.abs(next.x - o.x) < 1e-6 &&
          Math.abs(next.y - o.y) < 1e-6 &&
          Math.abs(next.rotation - o.rotation) < 1e-6
        ) {
          node.position(o);
          node.rotation(displayedRotation(o));
          return;
        }
        if (!applyObject(next)) {
          node.position(o);
          node.rotation(displayedRotation(o));
        }
      }}
    >
      {o.kind !== "movement" && (
        <ObjectHitArea
          width={Math.max(o.width, 28 / scale)}
          height={Math.max(o.height, 28 / scale)}
        />
      )}
      <ObjectVisual
        object={o}
        hitWidth={24 / scale}
        icons={icons}
      />
    </Group>
  );
  function drawMultiOutline(
    context: Konva.Context,
    shape: Konva.Shape,
    ids: Iterable<string>,
    margin: number,
  ) {
    context.beginPath();
    for (const id of ids) {
      const bounds = outlineBounds(id, margin);
      if (bounds) context.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    context.strokeShape(shape);
  }
  return (
    <div
      className={viewWidth / viewHeight >= 3 ? "ke-canvas ke-canvas--shallow" : "ke-canvas"}
      style={{ "--ke-pitch-ratio": viewWidth / viewHeight } as CSSProperties}
      ref={host}
      role="group"
      tabIndex={surfacePreview ? undefined : 0}
      onPointerDownCapture={() => {
        ignorePitchClick.current = false;
        if (multiCursor) setMultiCursor(null);
      }}
      onBlur={() => setMultiCursor(null)}
      onClickCapture={(e) => {
        // A pitch gesture can generate a click over the toolbar after it moves.
        if (ignorePitchClick.current && e.detail > 0) {
          ignorePitchClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      aria-label={
        surfacePreview
          ? "Преглед на игрището"
          : placementOnly
          ? "Игрище за поставяне на обекти"
          : multiSelection
            ? "Игрище за множествен избор. Плъзнете от празно място за избор с рамка. Използвайте Page Up и Page Down за преглед и интервал за избор."
          : "Игрище за рисуване. Използвайте Page Up и Page Down за избор на обект."
      }
      onKeyDown={(e) => {
        if (
          surfacePreview ||
          placementOnly ||
          e.target !== e.currentTarget ||
          !visibleObjects.length ||
          e.currentTarget.closest("fieldset:disabled")
        ) {
          return;
        }

        if (multiSelection && e.key === " " && cursorIndex >= 0) {
          e.preventDefault();
          onSelect(visibleObjects[cursorIndex].id);
          return;
        }
        if (e.key !== "PageUp" && e.key !== "PageDown") return;
        e.preventDefault();
        const count = visibleObjects.length;
        const current = multiSelection ? cursorIndex : visibleObjects.findIndex((o) => o.id === selected);
        const step = e.key === "PageDown" ? 1 : -1;
        const start = current < 0 && step < 0 ? 0 : current;
        const next = (start + step + count) % count;
        if (multiSelection) setMultiCursor(visibleObjects[next].id);
        else onSelect(visibleObjects[next].id);
      }}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="ke-sr" role="status">
        {multiSelection
          ? cursorIndex >= 0 && `Обект ${cursorIndex + 1} от ${visibleObjects.length}`
          : selectedLabel ? `Избран обект: ${selectedLabel}` : "Няма избран обект"}
      </span>
      {width > 0 && (
        <Stage
          ref={stage}
          width={width}
          height={viewHeight * scale}
          listening={!surfacePreview}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
        >
          <Layer {...viewLayer} listening={false}>
            <PitchBackground surface={surfacePreview ?? exercise.surface} background={exercise.background} />
          </Layer>
          <Layer {...viewLayer}>
            {(colorPreviewIndex < 0
              ? rendered
              : rendered.slice(0, colorPreviewIndex)
            ).map(renderObject)}
            {preview && !exercise.objects.some((o) => o.id === preview.id) && (
              <Group
                x={preview.x}
                y={preview.y}
                rotation={displayedRotation(preview)}
                listening={false}
                opacity={0.75}
              >
                <ObjectVisual
                  object={preview}
                  icons={icons}
                  showArrowhead={preview.path !== "freehand"}
                />
              </Group>
            )}
          </Layer>
          {/* Keep the surrounding layers still during live color changes. */}
          {colorPreviewIndex >= 0 && (
            <>
              <Layer {...viewLayer}>
                {renderObject(rendered[colorPreviewIndex])}
              </Layer>
              {colorPreviewIndex < rendered.length - 1 && (
                <Layer {...viewLayer}>
                  {rendered.slice(colorPreviewIndex + 1).map(renderObject)}
                </Layer>
              )}
            </>
          )}
          <Layer ref={controls} {...viewLayer}>
            {multiSelection && (
              <Rect
                ref={selectionBox}
                name="selection-box"
                visible={false}
                listening={false}
                fill="#c4fa8233"
                stroke="#c4fa82"
                strokeWidth={1.5 / scale}
                dash={[5 / scale, 3 / scale]}
              />
            )}
            {multiSelection && multiSelection.size > 0 && (
              <Shape
                name="multi-selection-outline"
                listening={false}
                stroke="#c4fa82"
                strokeWidth={2 / scale}
                dash={[5 / scale, 3 / scale]}
                sceneFunc={(context, shape) => drawMultiOutline(context, shape, multiSelection, MULTI_OUTLINE_MARGIN)}
              />
            )}
            {multiSelection && multiCursor && cursorIndex >= 0 && (
              <Shape
                listening={false}
                stroke="#ffffff"
                strokeWidth={2 / scale}
                sceneFunc={(context, shape) => drawMultiOutline(context, shape, [multiCursor], 6)}
              />
            )}
            <Transformer
              ref={transformer}
              onPointerDown={(e) => {
                e.cancelBubble = true;
              }}
              rotateEnabled
              flipEnabled={false}
              padding={12}
              keepRatio={kind !== "zone" && kind !== "text"}
              ignoreStroke={kind === "zone" || kind === "text"}
              enabledAnchors={
                kind === "zone" || kind === "text"
                  ? BOX_ANCHORS
                  : ["top-left", "top-right", "bottom-left", "bottom-right"]
              }
              anchorSize={14}
              rotateAnchorOffset={35}
              rotateAnchorAngle={
                selectedObject && selectedObject.x >= WIDTH / 2 ? -90 : 90
              }
              borderStroke="#c4fa82"
              anchorStroke="#204721"
              anchorFill="#dfffdf"
              boundBoxFunc={(old, next) => {
                if (selectedObject?.kind === "text") {
                  if (transformer.current?.getActiveAnchor() === "rotater") return next;
                  const width = next.width / scale;
                  const height = Math.round(next.height / scale * 1e6) / 1e6;
                  if (width < 2 || height < 2 || width > WIDTH * 3 || height > HEIGHT * 3) return old;
                  const { minWidth, minHeight } = measurePitchText(
                    selectedObject.label ?? "",
                    textFontSize(selectedObject),
                    width,
                  );
                  return width < minWidth || height < minHeight ? old : next;
                }
                // Rotation must work even below the resize minimum on phones.
                if (next.rotation !== old.rotation) return next;
                return next.width < 8 || next.height < 8 ? old : next;
              }}
            />
            {selectedObject?.kind === "movement" &&
              (preview?.id === selected ? preview : selectedObject).points?.map(
                (_, i) => {
                  const object =
                    preview?.id === selected ? preview : selectedObject;
                  if (
                    object.path === "freehand" &&
                    i !== 0 &&
                    i !== object.points!.length - 1
                  )
                    return null;
                  const world = worldPoint(
                    movementHandlePoint(object, i),
                    object,
                  );
                  return (
                    <Circle
                      name="path-handle"
                      key={`${object.id}-${i}`}
                      ref={(node) => {
                        const key = `${object.id}:${i}`;
                        if (node) handles.current.set(key, node);
                        else handles.current.delete(key);
                      }}
                      x={world.x}
                      y={world.y}
                      radius={12 / (scale || 1)}
                      fill={
                        i === 1 && object.path === "curve"
                          ? "#fbbf24"
                          : "#dfffdf"
                      }
                      stroke="#204721"
                      strokeWidth={2}
                      draggable
                      onPointerDown={(e) => {
                        e.cancelBubble = true;
                      }}
                      onDragStart={(e) => {
                        e.cancelBubble = true;
                        const node = nodes.current.get(selectedObject.id);
                        if (node) isolateObject(node, false);
                      }}
                      onDragMove={(e) => {
                        e.cancelBubble = true;
                        const point = localPoint(
                          { x: e.target.x(), y: e.target.y() },
                          selectedObject,
                        );
                        previewAtFrame(
                          moveMovementHandle(selectedObject, i, point),
                        );
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                        if (cancelling.current) return;
                        const point = localPoint(
                          { x: e.target.x(), y: e.target.y() },
                          selectedObject,
                        );
                        const next = moveMovementHandle(
                          selectedObject,
                          i,
                          point,
                        );
                        clear();
                        if (applyObject(next)) {
                          // The committed handle can have the same props as the preview.
                          e.target.position(
                            worldPoint(movementHandlePoint(next, i), next),
                          );
                        }
                      }}
                    />
                  );
                },
              )}
          </Layer>
        </Stage>
      )}
      {width > 0 && pitchOverlay}
      {width > 0 && (selectedObject || multiSelection) && (
        <div
          className={
            multiAnchor
              ? "ke-object-actions ke-object-actions--multi"
              : multiSelection
                ? "ke-object-actions ke-object-actions--multi-empty"
                : "ke-object-actions"
          }
          ref={toolbar}
          role={multiSelection ? undefined : "group"}
          aria-label={multiSelection ? undefined : "Действия за избрания обект"}
        >
          {objectActions}
        </div>
      )}
    </div>
  );
}
