import {
  HEIGHT,
  WIDTH,
  sameExercise,
  type Exercise,
  type ExerciseObject,
  type Point,
} from "./model";
import { FOOTBALL } from "./football";
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
export function movementHandlePoint(object: ExerciseObject, index: number): Point {
  const points = object.points!;
  if (object.path !== "curve" || index !== 1) return points[index];

  const [start, control, end] = points;
  return {
    x: (start.x + 2 * control.x + end.x) / 4,
    y: (start.y + 2 * control.y + end.y) / 4,
  };
}
export function moveMovementHandle(
  object: ExerciseObject,
  index: number,
  position: Point,
): ExerciseObject {
  const points = object.points!.slice();
  if (object.path === "curve" && index === 1) {
    const [start, , end] = points;
    // Solve the quadratic midpoint for its control point.
    points[index] = {
      x: 2 * position.x - (start.x + end.x) / 2,
      y: 2 * position.y - (start.y + end.y) / 2,
    };
  } else {
    points[index] = position;
  }
  return { ...object, points };
}
export function simplify(points: Point[], cap = 300): Point[] {
  const filtered: Point[] = [];
  for (const [i, p] of points.entries()) {
    const previous = filtered.at(-1);
    if (!previous) {
      filtered.push(p);
      continue;
    }
    const distance = Math.hypot(p.x - previous.x, p.y - previous.y);
    if (distance >= 2 || (distance > 0 && i === points.length - 1)) {
      filtered.push(p);
    }
  }
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
const ARROWHEAD_LENGTH = 14;

function straightenArrowEnd(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const tip = points[points.length - 1];
  // Leave room for the spline to transition before reaching the wings.
  let remaining = ARROWHEAD_LENGTH * 1.5;
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < remaining && i > 1) {
      remaining -= length;
      continue;
    }
    const fraction = Math.min(remaining / length, 1);
    const start = {
      x: b.x + (a.x - b.x) * fraction,
      y: b.y + (a.y - b.y) * fraction,
    };
    const dx = tip.x - start.x;
    const dy = tip.y - start.y;
    if (dx === 0 && dy === 0) return points;
    return [
      ...points.slice(0, fraction === 1 ? i - 1 : i),
      start,
      { x: start.x + dx * 0.25, y: start.y + dy * 0.25 },
      { x: start.x + dx * 0.5, y: start.y + dy * 0.5 },
      tip,
    ];
  }
  return points;
}

// Sample geometry for both toolbar previews and canvas drawing.
export function movementPoints(o: ExerciseObject): number[] {
  const p = o.points ?? [];
  let samples: Point[] = p;
  if (o.path === "freehand") {
    // Drawings saved before endpoint deduplication can repeat the final point.
    samples = p.filter(
      (q, i) => i === 0 || q.x !== p[i - 1].x || q.y !== p[i - 1].y,
    );
    if (o.action && FOOTBALL.actions[o.action].arrow) {
      samples = straightenArrowEnd(samples);
    }
  }
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
    let remainingLength = totalLength;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1],
        b = samples[i],
        length = Math.hypot(b.x - a.x, b.y - a.y),
        n = Math.max(1, Math.ceil(length / step));
      for (let j = 0; j < n; j++) {
        const t = j / n,
          phase = wave.length * 0.75,
          distanceToEnd = remainingLength - length * t;
        // Fade the wave into a centered shaft under the arrowhead.
        const amplitude = clamp(
          (distanceToEnd - ARROWHEAD_LENGTH) / ARROWHEAD_LENGTH,
          1,
        );
        const offset = Math.sin(phase) * 3 * amplitude;
        wave.push({
          x: a.x + (b.x - a.x) * t - ((b.y - a.y) / (length || 1)) * offset,
          y: a.y + (b.y - a.y) * t + ((b.x - a.x) / (length || 1)) * offset,
        });
      }
      remainingLength -= length;
    }
    if (samples.length) wave.push(samples.at(-1)!);
    samples = wave;
  }
  return samples.flatMap((q) => [q.x, q.y]);
}
export function arrowheadPoints(points: number[], tension: number): number[] {
  const n = points.length;
  if (n < 4) return [];

  const x = points[n - 2], y = points[n - 1];
  let dx = x - points[n - 4], dy = y - points[n - 3];
  const lastLength = Math.hypot(dx, dy);
  if (lastLength === 0) return [];

  if (tension && n >= 6) {
    // Konva ends an open smoothed line with a quadratic. Its tangent points
    // from the final control point to the endpoint.
    const previousLength = Math.hypot(
      points[n - 4] - points[n - 6],
      points[n - 3] - points[n - 5],
    );
    const weight = tension * lastLength / (previousLength + lastLength);
    dx -= weight * (x - points[n - 6]);
    dy -= weight * (y - points[n - 5]);
  }
  const angle = Math.atan2(dy, dx);
  return [
    x - Math.cos(angle - 0.5) * ARROWHEAD_LENGTH,
    y - Math.sin(angle - 0.5) * ARROWHEAD_LENGTH,
    x,
    y,
    x - Math.cos(angle + 0.5) * ARROWHEAD_LENGTH,
    y - Math.sin(angle + 0.5) * ARROWHEAD_LENGTH,
  ];
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
