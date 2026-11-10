import {
  HEIGHT,
  WIDTH,
  sameExercise,
  type Exercise,
  type ExerciseObject,
  type Point,
} from "./model";
export const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
export function localPoint(p: Point, object: ExerciseObject): Point {
  const angle = (-object.rotation * Math.PI) / 180,
    x = p.x - object.x,
    y = p.y - object.y;
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  };
}
export function worldPoint(p: Point, object: ExerciseObject): Point {
  const a = (object.rotation * Math.PI) / 180;
  return {
    x: object.x + p.x * Math.cos(a) - p.y * Math.sin(a),
    y: object.y + p.x * Math.sin(a) + p.y * Math.cos(a),
  };
}
export function simplify(points: Point[], cap = 300): Point[] {
  const filtered = points.filter(
    (p, i) =>
      !i ||
      Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) >= 2 ||
      i === points.length - 1,
  );
  if (filtered.length <= cap) return filtered;
  return Array.from(
    { length: cap },
    (_, i) => filtered[Math.round((i * (filtered.length - 1)) / (cap - 1))],
  );
}
export function drawnObject(
  object: ExerciseObject,
  start: Point,
  end: Point,
  samples: Point[],
): ExerciseObject {
  if (object.kind === "zone")
    return {
      ...object,
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  const e = { x: end.x - start.x, y: end.y - start.y };
  return {
    ...object,
    points:
      object.path === "freehand"
        ? simplify(samples.map((p) => ({ x: p.x - start.x, y: p.y - start.y })))
        : object.path === "curve"
          ? [
              { x: 0, y: 0 },
              { x: e.x / 2 + e.y * 0.2, y: e.y / 2 - e.x * 0.2 },
              e,
            ]
          : [{ x: 0, y: 0 }, e],
  };
}
export function duplicateObject(o: ExerciseObject, id: string): ExerciseObject {
  return {
    ...structuredClone(o),
    id,
    x: clamp(o.x + (o.x > WIDTH - 40 ? -24 : 24), WIDTH),
    y: clamp(o.y + (o.y > HEIGHT - 40 ? -24 : 24), HEIGHT),
  };
}
export type History = {
  past: Exercise[];
  present: Exercise;
  future: Exercise[];
};
export function commit(h: History, next: Exercise): History {
  return sameExercise(h.present, next)
    ? h
    : { past: [...h.past, h.present].slice(-100), present: next, future: [] };
}
export function undo(h: History): History {
  return h.past.length
    ? {
        past: h.past.slice(0, -1),
        present: h.past.at(-1)!,
        future: [h.present, ...h.future],
      }
    : h;
}
export function redo(h: History): History {
  return h.future.length
    ? {
        past: [...h.past, h.present].slice(-100),
        present: h.future[0],
        future: h.future.slice(1),
      }
    : h;
}
// Sample geometry for both toolbar previews and canvas drawing.
export function movementPoints(o: ExerciseObject): number[] {
  const p = o.points ?? [];
  let samples: Point[] = p;
  if (o.path === "curve" && p.length === 3)
    samples = Array.from({ length: 41 }, (_, i) => {
      const t = i / 40,
        s = 1 - t;
      return {
        x: s * s * p[0].x + 2 * s * t * p[1].x + t * t * p[2].x,
        y: s * s * p[0].y + 2 * s * t * p[1].y + t * t * p[2].y,
      };
    });
  if (o.action === "dribble") {
    const wave: Point[] = [];
    const totalLength = samples.reduce(
      (sum, p, i) =>
        i
          ? sum + Math.hypot(p.x - samples[i - 1].x, p.y - samples[i - 1].y)
          : 0,
      0,
    );
    const step = Math.max(3, totalLength / 600);
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1],
        b = samples[i],
        length = Math.hypot(b.x - a.x, b.y - a.y),
        n = Math.max(1, Math.ceil(length / step));
      for (let j = 0; j < n; j++) {
        const t = j / n,
          phase = wave.length * 0.75,
          offset = Math.sin(phase) * 3;
        wave.push({
          x: a.x + (b.x - a.x) * t - ((b.y - a.y) / (length || 1)) * offset,
          y: a.y + (b.y - a.y) * t + ((b.x - a.x) / (length || 1)) * offset,
        });
      }
    }
    if (samples.length) wave.push(samples.at(-1)!);
    samples = wave;
  }
  return samples.flatMap((q) => [q.x, q.y]);
}
export function offsetPolyline(points: number[], distance: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const before = Math.max(0, i - 2),
      after = Math.min(points.length - 2, i + 2);
    const dx = points[after] - points[before],
      dy = points[after + 1] - points[before + 1],
      length = Math.hypot(dx, dy) || 1;
    result.push(
      points[i] - (dy / length) * distance,
      points[i + 1] + (dx / length) * distance,
    );
  }
  return result;
}
