"use client";
import {
  memo,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Konva from "konva";
import { Circle, Group, Layer, Shape, Stage, Transformer } from "react-konva";
import {
  HEIGHT,
  WIDTH,
  createObject,
  validateExercise,
  type Exercise,
  type ExerciseObject,
  type ExerciseTool,
  type Point,
} from "@/lib/exercise/model";
import { MAX_ITEMS } from "@/lib/trainingPlans";
import {
  clamp,
  drawnObject,
  localPoint,
  movementHandlePoint,
  moveMovementHandle,
  selectionToolbarPosition,
  worldPoint,
} from "@/lib/exercise/geometry";
import {
  ObjectVisual,
  PITCH_ICON_FILES,
  Pitch,
  type PitchIcons,
} from "./Visuals";

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
  selected: string | null;
  tool: ExerciseTool | "select";
  placementOnly: boolean;
  pathMode: "straight" | "curve" | "freehand";
  objectActions: ReactNode;
  selectedLabel?: string;
  colorPreviewId?: string;
  onSelect: (id: string | null) => void;
  onCommit: (next: Exercise) => void;
  onPlaced: (object: ExerciseObject) => void;
  onError: (message: string) => void;
};
export default function Canvas({
  exercise,
  selected,
  tool,
  placementOnly,
  pathMode,
  objectActions,
  selectedLabel,
  colorPreviewId,
  onSelect,
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
  const dragOrigin = useRef<{
    node: Konva.Node;
    parent: Konva.Container;
    index: number;
  } | null>(null);
  const cancelling = useRef(false);
  const [width, setWidth] = useState(0),
    [preview, setPreview] = useState<ExerciseObject | null>(null);
  const [icons, setIcons] = useState<PitchIcons>({});
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
  const scale = width / WIDTH;
  const selectedObject = exercise.objects.find((o) => o.id === selected);
  const colorPreviewIndex =
    colorPreviewId && exercise.objects.length > 1
      ? exercise.objects.findIndex((o) => o.id === colorPreviewId)
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
        node.rotation(o.rotation);
        node.scale({ x: 1, y: 1 });
      }
      o.points?.forEach((_, i) => {
        const handle = handles.current.get(`${o.id}:${i}`);
        if (handle) {
          handle.stopDrag();
          handle.position(worldPoint(movementHandlePoint(o, i), o));
        }
      });
    }
    restoreDragLayer();
    cancelling.current = false;
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    pending.current = null;
    gesture.current = null;
    setPreview(null);
  }
  const cancelFromEffect = useEffectEvent(() => clear());

  useEffect(() => {
    const images = Object.entries(PITCH_ICON_FILES).map(([name, filename]) => {
      const image = new window.Image();
      image.onload = () => setIcons((current) => ({ ...current, [name]: image }));
      image.src = `/icons/${filename}`;
      return image;
    });
    return () => {
      for (const image of images) image.onload = null;
    };
  }, []);

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
    if (!node || !canvas || !actions || actions.hidden) return;

    const bounds = node.getClientRect({ relativeTo: canvas });
    if (transformable && box) {
      const controlsBounds = box.getClientRect({ relativeTo: canvas });
      bounds.y = controlsBounds.y;
      bounds.height = controlsBounds.height;
    } else {
      // Keep the toolbar clear of the path handles at every pitch scale.
      bounds.y -= 12;
      bounds.height += 24;
    }
    const position = selectionToolbarPosition(
      bounds,
      { width: actions.offsetWidth, height: actions.offsetHeight },
      { width: canvas.width(), height: canvas.height() },
    );
    actions.style.left = `${position.x}px`;
    actions.style.top = `${position.y}px`;
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
  function position(): Point | null {
    const p = stage.current?.getPointerPosition();
    return p && scale
      ? { x: clamp(p.x / scale, WIDTH), y: clamp(p.y / scale, HEIGHT) }
      : null;
  }
  function applyObject(object: ExerciseObject) {
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
  function down(e: Konva.KonvaEventObject<PointerEvent>) {
    if (e.evt.button !== 0 || gesture.current) return;
    if (tool === "select") {
      if (e.target === stage.current) onSelect(null);
      return;
    }
    const p = position();
    if (!p) return;
    if (exercise.objects.length >= MAX_ITEMS) {
      onError(`Позволени са до ${MAX_ITEMS} обекта.`);
      return;
    }
    const object = createObject(tool, p, crypto.randomUUID());
    if (object.kind === "movement") {
      object.path = pathMode;
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
    const p = position();
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
    const g = gesture.current,
      p = position();
    if (!g || !p || g.pointerId !== e.evt.pointerId) return;
    if (g.tool !== tool) {
      clear();
      return;
    }
    const object =
      g.object.kind === "movement" || g.object.kind === "zone"
        ? drawnObject(g.object, g.start, p, [...g.samples, p])
        : { ...g.object, ...p };
    clear();
    const current = latest.current.exercise;
    const next = { ...current, objects: [...current.objects, object] };
    if (!validateExercise(next)) {
      onCommit(next);
      onPlaced(object);
    }
  }
  const rendered = exercise.objects.map((o) =>
    preview?.id === o.id ? preview : o,
  );
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
      rotation={o.rotation}
      listening={!placementOnly}
      draggable={!placementOnly}
      onPointerDown={(e) => {
        e.cancelBubble = true;
        onSelect(o.id);
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
        isolateObject(e.target, true);
        onSelect(o.id);
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        if (cancelling.current) return;
        restoreDragLayer();
        const node = e.target;
        const next = {
          ...o,
          x: clamp(node.x(), WIDTH),
          y: clamp(node.y(), HEIGHT),
        };
        node.position(next);
        applyObject(next);
      }}
      onTransformStart={(e) => {
        isolateObject(e.target, true);
      }}
      onTransformEnd={(e) => {
        if (cancelling.current) return;
        const node = e.target,
          sx = node.scaleX(),
          sy = node.scaleY();
        const next = {
          ...o,
          x: clamp(node.x(), WIDTH),
          y: clamp(node.y(), HEIGHT),
          rotation: ((node.rotation() + 360) % 720) - 360,
          width: Math.max(2, o.width * sx),
          height: Math.max(2, o.height * sy),
        };
        restoreDragLayer();
        node.scale({ x: 1, y: 1 });
        if (!applyObject(next)) {
          node.position(o);
          node.rotation(o.rotation);
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
  return (
    <div
      className="ke-canvas"
      ref={host}
      role="group"
      tabIndex={0}
      aria-label={
        placementOnly
          ? "Игрище за поставяне на обекти"
          : "Игрище за рисуване. Използвайте Page Up и Page Down за избор на обект."
      }
      onKeyDown={(e) => {
        if (
          placementOnly ||
          e.target !== e.currentTarget ||
          (e.key !== "PageUp" && e.key !== "PageDown") ||
          !exercise.objects.length ||
          e.currentTarget.closest("fieldset:disabled")
        ) {
          return;
        }

        e.preventDefault();
        const count = exercise.objects.length;
        const current = exercise.objects.findIndex((o) => o.id === selected);
        const step = e.key === "PageDown" ? 1 : -1;
        const start = current < 0 && step < 0 ? 0 : current;
        const next = (start + step + count) % count;
        onSelect(exercise.objects[next].id);
      }}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="ke-sr" role="status">
        {selectedLabel ? `Избран обект: ${selectedLabel}` : "Няма избран обект"}
      </span>
      {width > 0 && (
        <Stage
          ref={stage}
          width={width}
          height={(width * HEIGHT) / WIDTH}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
        >
          <Layer scaleX={scale} scaleY={scale} listening={false}>
            <Pitch surface={exercise.surface} />
          </Layer>
          <Layer scaleX={scale} scaleY={scale}>
            {(colorPreviewIndex < 0
              ? rendered
              : rendered.slice(0, colorPreviewIndex)
            ).map(renderObject)}
            {preview && !exercise.objects.some((o) => o.id === preview.id) && (
              <Group
                x={preview.x}
                y={preview.y}
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
              <Layer scaleX={scale} scaleY={scale}>
                {renderObject(rendered[colorPreviewIndex])}
              </Layer>
              {colorPreviewIndex < rendered.length - 1 && (
                <Layer scaleX={scale} scaleY={scale}>
                  {rendered.slice(colorPreviewIndex + 1).map(renderObject)}
                </Layer>
              )}
            </>
          )}
          <Layer ref={controls} scaleX={scale} scaleY={scale}>
            <Transformer
              ref={transformer}
              onPointerDown={(e) => {
                e.cancelBubble = true;
              }}
              rotateEnabled
              flipEnabled={false}
              padding={12}
              keepRatio={selectedObject?.kind !== "zone"}
              enabledAnchors={
                selectedObject?.kind === "zone"
                  ? [
                      "top-left",
                      "top-center",
                      "top-right",
                      "middle-left",
                      "middle-right",
                      "bottom-left",
                      "bottom-center",
                      "bottom-right",
                    ]
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
      {width > 0 && selectedObject && (
        <div
          className="ke-object-actions"
          ref={toolbar}
          role="group"
          aria-label="Действия за избрания обект"
        >
          {objectActions}
        </div>
      )}
    </div>
  );
}
