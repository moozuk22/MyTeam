import { describe, expect, it } from "vitest";
import {
  ALLOWED_EQUIPMENT_TYPES,
  DEFAULT_LAYOUT,
  type PlanItem,
} from "@/lib/trainingPlans";
import {
  convertLegacy,
  createObject,
  EMPTY_EXERCISE,
  validateExercise,
  validateSavedLayout,
} from "./model";
import {
  commit,
  drawnObject,
  duplicateObject,
  localPoint,
  movementPoints,
  redo,
  simplify,
  undo,
  worldPoint,
} from "./geometry";
import { draftKey, readDraft, sameExercise } from "./drafts";
import { FOOTBALL } from "./football";
const point = { x: 200, y: 200 };
const cone = createObject("cone", point, "cone");
const exercise = { ...EMPTY_EXERCISE, objects: [cone] };
describe("exercise model and geometry", () => {
  it("round trips every legacy tool through a copy, retaining originals and order", () => {
    const items = ALLOWED_EQUIPMENT_TYPES.map((type, i): PlanItem => ({
      id: String(i),
      type,
      x: 0.3,
      y: 0.3,
      endX: 0.7,
      endY: 0.7,
      rotation: 15,
      scale: 1,
      ...(type === "text" ? { text: "Текст" } : {}),
    }));
    const source = { ...DEFAULT_LAYOUT, items },
      original = structuredClone(source);
    const converted = convertLegacy(source);
    expect(converted.objects).toHaveLength(items.length);
    expect(converted.objects.map((o) => o.id)).toEqual(items.map((o) => o.id));
    expect(source).toEqual(original);
    expect(
      validateSavedLayout(JSON.parse(JSON.stringify(converted))),
    ).toBeNull();
    expect(converted.objects.find((o) => o.action === "line")?.rotation).toBe(
      15,
    );
  });
  it("exposes every supported football tool, including all goal sizes and the pole", () => {
    expect(new Set(FOOTBALL.tools.flatMap((g) => g.types))).toEqual(
      new Set(ALLOWED_EQUIPMENT_TYPES),
    );
  });
  it("rejects unexpected payloads hidden in non-movement objects", () => {
    expect(
      validateExercise({
        ...exercise,
        objects: [{ ...cone, points: [{ x: 0, y: 0, extra: "payload" }] }],
      }),
    ).toBeTruthy();
    expect(validateExercise({ ...exercise, extra: "payload" })).toBeTruthy();
  });
  it("maps freehand points relative to the original anchor", () => {
    const layout = convertLegacy({
      ...DEFAULT_LAYOUT,
      items: [
        {
          id: "free",
          type: "run-free",
          x: 0.3,
          y: 0.4,
          points: [
            { x: 0.3, y: 0.4 },
            { x: 0.5, y: 0.6 },
          ],
          rotation: 90,
          scale: 2,
        },
      ],
    });
    expect(layout.objects[0].points?.[0]).toEqual({ x: 0, y: 0 });
    expect(layout.objects[0].rotation).toBe(0);
  });
  it("rejects non-finite coordinates, duplicate IDs, unknown sports and invalid geometry", () => {
    for (const n of [NaN, Infinity, -Infinity])
      expect(
        validateExercise({ ...exercise, objects: [{ ...cone, x: n }] }),
      ).toBeTruthy();
    expect(
      validateExercise({ ...exercise, objects: [cone, cone] }),
    ).toBeTruthy();
    expect(validateExercise({ ...exercise, sport: "volleyball" })).toBeTruthy();
    expect(
      validateExercise({
        ...exercise,
        objects: Array.from({ length: 201 }, (_, i) => ({
          ...cone,
          id: String(i),
        })),
      }),
    ).toBeTruthy();
    const movement = createObject("run", point, "run");
    expect(
      validateExercise({
        ...exercise,
        objects: [
          {
            ...movement,
            points: [
              { x: 0, y: 0 },
              { x: 0, y: 0 },
            ],
          },
        ],
      }),
    ).toBeTruthy();
    expect(
      validateExercise({
        ...exercise,
        objects: [{ ...movement, path: "curve" }],
      }),
    ).toBeTruthy();
  });
  it("draws zones in every direction with positive dimensions", () => {
    const zone = createObject("rectangle", point, "zone");
    for (const end of [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 100, y: 300 },
      { x: 300, y: 300 },
    ]) {
      const drawn = drawnObject(zone, point, end, []);
      expect(drawn.width).toBe(100);
      expect(drawn.height).toBe(100);
      expect(drawn.x).toBe((point.x + end.x) / 2);
    }
  });
  it("keeps looped freehand paths, simplifies to 300 points and retains endpoints", () => {
    const samples = Array.from({ length: 2000 }, (_, i) => ({
      x: 200 + Math.cos(i / 30) * 100,
      y: 200 + Math.sin(i / 30) * 100,
    }));
    const simplified = simplify(samples);
    expect(simplified.length).toBeLessThanOrEqual(300);
    expect(simplified[0]).toEqual(samples[0]);
    expect(simplified.at(-1)).toEqual(samples.at(-1));
    const start = samples[0],
      loop = drawnObject(
        { ...createObject("run-free", start, "loop") },
        start,
        start,
        [...samples, start],
      );
    expect(validateExercise({ ...exercise, objects: [loop] })).toBeNull();
  });
  it("transforms handles between local and world space after translation and rotation", () => {
    const object = { ...cone, rotation: 67 };
    const p = { x: -21, y: 91 },
      world = worldPoint(p, object),
      local = localPoint(world, object);
    expect(local.x).toBeCloseTo(p.x);
    expect(local.y).toBeCloseTo(p.y);
    const copy = duplicateObject({ ...object, x: 1050, y: 700 }, "copy");
    expect(copy.x).toBe(1026);
    expect(copy.y).toBe(676);
    expect(copy.rotation).toBe(object.rotation);
  });
  it("keeps sampled dribbling geometry bounded even for complex paths", () => {
    const o = {
      ...createObject("dribble-free", point, "dribble"),
      points: Array.from({ length: 300 }, (_, i) => ({
        x: i % 2 ? 3000 : -3000,
        y: i % 2 ? 2000 : -2000,
      })),
    };
    expect(movementPoints(o).length).toBeLessThan(2000);
  });
});
describe("history and recovery", () => {
  it("undoes edits and surface changes, clears redo after editing, bounds history", () => {
    let h = {
      past: [],
      present: EMPTY_EXERCISE,
      future: [],
    } as import("./geometry").History;
    h = commit(h, exercise);
    h = commit(h, { ...exercise, surface: "half" });
    expect(undo(h).present.surface).toBe("full");
    expect(redo(undo(h)).present.surface).toBe("half");
    expect(commit(undo(h), { ...exercise, surface: "blank" }).future).toEqual(
      [],
    );
    for (let i = 0; i < 110; i++)
      h = commit(h, { ...exercise, objects: [{ ...cone, x: i }] });
    expect(h.past).toHaveLength(100);
    expect(commit(h, h.present)).toBe(h);
  });
  it("scopes drafts, accepts stale but valid recovery, rejects corrupt and unsupported content", () => {
    expect(draftKey("user", "club", "plan")).not.toBe(
      draftKey("user2", "club", "plan"),
    );
    const draft = {
      baseRevision: "2026-11-10T10:00:00.000Z",
      layout: exercise,
      savedAt: 1,
    };
    expect(readDraft(JSON.stringify(draft))).toEqual(draft);
    for (const value of [
      null,
      "bad",
      "{}",
      JSON.stringify({ ...draft, layout: { version: 3 } }),
    ])
      expect(readDraft(value)).toBeNull();
    const submitted = structuredClone(exercise),
      edited = { ...exercise, objects: [{ ...cone, x: 400 }] };
    expect(sameExercise(submitted, edited)).toBe(false);
  });
});
