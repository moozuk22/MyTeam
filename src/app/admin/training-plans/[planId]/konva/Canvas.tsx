"use client";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
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
  type Point,
} from "@/lib/exercise/model";
import type { EquipmentType } from "@/lib/trainingPlans";
import {
  clamp,
  drawnObject,
  localPoint,
  worldPoint,
} from "@/lib/exercise/geometry";
import { ObjectVisual, Pitch } from "./Visuals";
export type CanvasProps = {
  exercise: Exercise;
  selected: string | null;
  tool: EquipmentType | "select";
  pathMode: "straight" | "curve" | "freehand";
  onSelect: (id: string | null) => void;
  onCommit: (next: Exercise) => void;
  onError: (message: string) => void;
};
export default function Canvas({
  exercise,
  selected,
  tool,
  pathMode,
  onSelect,
  onCommit,
  onError,
}: CanvasProps) {
  const host = useRef<HTMLDivElement>(null),
    stage = useRef<Konva.Stage>(null),
    transformer = useRef<Konva.Transformer>(null);
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
  const gesture = useRef<{
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
      o.points?.forEach((p, i) => {
        const handle = handles.current.get(`${o.id}:${i}`);
        if (handle) {
          handle.stopDrag();
          handle.position(worldPoint(p, o));
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
  useEffect(() => {
    const node = selected ? nodes.current.get(selected) : null;
    const object = exercise.objects.find((o) => o.id === selected);
    transformer.current?.nodes(
      node && object?.kind !== "movement" ? [node] : [],
    );
  }, [selected, exercise, width]);
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
    if (exercise.objects.length >= 200) {
      onError("Позволени са до 200 обекта.");
      return;
    }
    const object = createObject(tool, p, crypto.randomUUID());
    if (object.kind === "movement") {
      object.path = pathMode;
    }
    gesture.current = {
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
    const object =
      g.object.kind === "movement" || g.object.kind === "zone"
        ? drawnObject(g.object, g.start, p, [...g.samples, p])
        : { ...g.object, ...p };
    clear();
    const current = latest.current.exercise;
    const next = { ...current, objects: [...current.objects, object] };
    if (!validateExercise(next)) {
      onCommit(next);
      onSelect(object.id);
    }
  }
  const selectedObject = exercise.objects.find((o) => o.id === selected);
  const rendered = exercise.objects.map((o) =>
    preview?.id === o.id ? preview : o,
  );
  return (
    <div
      className="ke-canvas"
      ref={host}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Игрище за рисуване. Използвайте инструментите и списъка с обекти за управление с клавиатура."
    >
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
            {rendered.map((o) => (
              <Group
                key={o.id}
                ref={(node) => {
                  if (node) nodes.current.set(o.id, node);
                  else nodes.current.delete(o.id);
                }}
                id={o.id}
                x={o.x}
                y={o.y}
                rotation={o.rotation}
                draggable
                onPointerDown={(e) => {
                  // Existing objects always take precedence over placing a new one.
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
                  <Shape
                    fill="#000000"
                    sceneFunc={() => {}}
                    hitFunc={(ctx, shape) => {
                      const w = Math.max(o.width, 28 / scale),
                        h = Math.max(o.height, 28 / scale);
                      ctx.beginPath();
                      ctx.rect(-w / 2, -h / 2, w, h);
                      ctx.fillStrokeShape(shape);
                    }}
                  />
                )}
                <ObjectVisual object={o} hitWidth={24 / scale} />
              </Group>
            ))}
            {preview && !exercise.objects.some((o) => o.id === preview.id) && (
              <Group
                x={preview.x}
                y={preview.y}
                listening={false}
                opacity={0.75}
              >
                <ObjectVisual
                  object={preview}
                  showArrowhead={preview.path !== "freehand"}
                />
              </Group>
            )}
          </Layer>
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
              borderStroke="#c4fa82"
              anchorStroke="#204721"
              anchorFill="#dfffdf"
              boundBoxFunc={(old, next) =>
                next.width < 8 || next.height < 8 ? old : next
              }
            />
            {selectedObject?.kind === "movement" &&
              (preview?.id === selected ? preview : selectedObject).points?.map(
                (p, i) => {
                  const object =
                      preview?.id === selected ? preview : selectedObject,
                    world = worldPoint(p, object);
                  if (
                    object.path === "freehand" &&
                    i !== 0 &&
                    i !== object.points!.length - 1
                  )
                    return null;
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
                        previewAtFrame({
                          ...selectedObject,
                          points: selectedObject.points!.map((q, j) =>
                            i === j ? point : q,
                          ),
                        });
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                        if (cancelling.current) return;
                        const point = localPoint(
                          { x: e.target.x(), y: e.target.y() },
                          selectedObject,
                        );
                        const next = {
                          ...selectedObject,
                          points: selectedObject.points!.map((q, j) =>
                            i === j ? point : q,
                          ),
                        };
                        clear();
                        applyObject(next);
                      }}
                    />
                  );
                },
              )}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
