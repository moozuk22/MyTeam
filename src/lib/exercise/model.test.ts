import { describe, expect, it } from "vitest";
import {
  ALLOWED_EQUIPMENT_TYPES,
  DEFAULT_LAYOUT,
  type PlanItem,
} from "@/lib/trainingPlans";
import {
  convertLegacy,
  addCustomTeam,
  createObject,
  EMPTY_EXERCISE,
  getCustomTeamColors,
  nextPlayerLabel,
  removeCustomTeam,
  validateExercise,
  validateSavedLayout,
} from "./model";
import {
  arrowheadPoints,
  commit,
  drawnObject,
  duplicateObject,
  duplicateObjects,
  localPoint,
  movementHandlePoint,
  movementPoints,
  moveMovementHandle,
  redo,
  selectionToolbarPosition,
  simplify,
  shotShafts,
  undo,
  worldPoint,
} from "./geometry";
import { draftKey, readDraft, sameExercise } from "./drafts";
import { countEquipment, FOOTBALL } from "./football";
const point = { x: 200, y: 200 };
const cone = createObject("cone", point, "cone");
const exercise = { ...EMPTY_EXERCISE, objects: [cone] };
describe("exercise model and geometry", () => {
  it("duplicates a selection together when it is near the edge of the pitch", () => {
    const objects = [
      { ...cone, x: 1000, y: 650 },
      createObject("text", { x: 1050, y: 700 }, "label"),
    ];
    const ids = ["copy-cone", "copy-label"];
    const copies = duplicateObjects(objects, () => ids.shift()!);
    expect(copies).toEqual([
      { ...objects[0], id: "copy-cone", x: 976, y: 626 },
      { ...objects[1], id: "copy-label", x: 1026, y: 676 },
    ]);
  });

  it("preserves explicit text font sizes and accepts older text without one", () => {
    const text = createObject("text", point, "text");
    expect(validateSavedLayout({ ...EMPTY_EXERCISE, objects: [text] })).toBeNull();
    const sized = { ...text, fontSize: 24.5 };
    expect(validateSavedLayout(JSON.parse(JSON.stringify({
      ...EMPTY_EXERCISE, objects: [sized],
    })))).toBeNull();
    for (const fontSize of [0, -4, 10000, "24", Infinity]) {
      expect(validateSavedLayout({
        ...EMPTY_EXERCISE, objects: [{ ...text, fontSize }],
      })).toBeTruthy();
    }
    expect(validateSavedLayout({
      ...EMPTY_EXERCISE, objects: [{ ...cone, fontSize: 24 }],
    })).toBeTruthy();
  });

  it("counts placed equipment by type and groups older markers under Шапка", () => {
    const objects = [
      cone,
      createObject("cone", point, "cone-2"),
      createObject("wall", point, "wall"),
      createObject("mannequin", point, "mannequin"),
      createObject("marker", point, "marker"),
      createObject("marker-blue", point, "old-marker"),
      createObject("team1-player-1", point, "player"),
    ];
    expect(countEquipment(objects)).toEqual({
      cone: 2,
      wall: 1,
      mannequin: 1,
      marker: 2,
    });
  });

  it("adds more teams to an existing third-team exercise and keeps their colors and numbers", () => {
    const thirdTeam = { number: 3, color: "#a855f7" };
    const fourthTeam = { number: 4, color: "#22d3ee" };
    const fifthTeam = { number: 5, color: "#f472b6" };
    const existing = { ...EMPTY_EXERCISE, thirdTeamColor: thirdTeam.color };
    expect(validateSavedLayout(existing)).toBeNull();
    expect(getCustomTeamColors(existing)).toEqual([thirdTeam.color]);
    const layout = addCustomTeam(existing, fourthTeam.color);
    expect(layout).not.toHaveProperty("thirdTeamColor");
    const history = commit({ past: [], present: existing, future: [] }, layout);
    expect(undo(history).present).toEqual(existing);
    expect(redo(undo(history)).present).toEqual(layout);
    expect(validateSavedLayout(JSON.parse(JSON.stringify(layout)))).toBeNull();
    const extended = addCustomTeam(layout, fifthTeam.color);
    expect(getCustomTeamColors(extended)).toEqual(
      [thirdTeam, fourthTeam, fifthTeam].map((team) => team.color),
    );

    const figures = FOOTBALL.customTeamTools.map((type) =>
      createObject(type, point, type, fourthTeam),
    );
    expect(figures.map(({ team, color, role }) => [team, color, role])).toEqual([
      [4, fourthTeam.color, "coach"],
      [4, fourthTeam.color, "goalkeeper"],
      [4, fourthTeam.color, "player"],
    ]);
    expect(nextPlayerLabel(figures, 4)).toBe("2");
    expect(nextPlayerLabel(figures, 5)).toBe("1");
    expect(validateSavedLayout({ ...extended, objects: figures })).toBeNull();
    expect(validateSavedLayout({ ...existing, objects: figures })).toBeTruthy();
    for (const color of ["#3B82F6", "#ef4444", "#invalid", 42]) {
      expect(validateSavedLayout({ ...layout, customTeamColors: [color] })).toBeTruthy();
    }
  });

  it("removes one custom team and its figures while retaining the other team numbers", () => {
    const thirdTeam = { number: 3, color: "#a855f7" };
    const fourthTeam = { number: 4, color: "#22d3ee" };
    const figures = FOOTBALL.customTeamTools.map((tool) =>
      createObject(tool, point, tool, thirdTeam),
    );
    const remaining = createObject("custom-team-player", point, "remaining", fourthTeam);
    const layout = {
      ...exercise,
      customTeamColors: [thirdTeam.color, fourthTeam.color],
      objects: [cone, ...figures, remaining],
    };
    const deleted = removeCustomTeam(layout, 3);
    expect(deleted.customTeamColors).toEqual([null, fourthTeam.color]);
    expect(deleted.objects).toEqual([cone, remaining]);
    expect(validateSavedLayout(JSON.parse(JSON.stringify(deleted)))).toBeNull();
    expect(validateSavedLayout({ ...deleted, objects: layout.objects })).toBeTruthy();
    expect(removeCustomTeam(layout, 2)).toBe(layout);
    expect(removeCustomTeam(deleted, 3)).toBe(deleted);
    expect(addCustomTeam(deleted, "#f472b6").customTeamColors)
      .toEqual([null, fourthTeam.color, "#f472b6"]);
    expect(removeCustomTeam({ ...exercise, thirdTeamColor: thirdTeam.color }, 3))
      .toEqual({ ...exercise, customTeamColors: [null] });
    const history = commit({ past: [], present: layout, future: [] }, deleted);
    expect(undo(history).present).toEqual(layout);
    expect(redo(undo(history)).present).toEqual(deleted);
  });

  it("defaults newly placed Team 1 figures to blue and Team 2 figures to red", () => {
    const teamTools = ALLOWED_EQUIPMENT_TYPES.filter((type) =>
      type.startsWith("team"),
    );

    for (const type of teamTools) {
      const object = createObject(type, point, type);
      expect(object.color).toBe(type.startsWith("team1") ? "#3b82f6" : "#ef4444");
    }
  });

  it("offers one recolorable marker and round trips a wall alongside older markers", () => {
    const tools = FOOTBALL.tools.flatMap(({ types }) => types);
    expect(tools.filter((type) => type.startsWith("marker"))).toEqual(["marker"]);
    expect(FOOTBALL.labels.marker).toBe("Шапка");
    expect(tools).toContain("wall");

    const objects = [
      createObject("wall", point, "wall"),
      { ...createObject("marker", point, "marker"), color: "#aa00ff" },
      createObject("marker-blue", point, "old-marker"),
    ];
    const saved = JSON.parse(JSON.stringify({ ...EMPTY_EXERCISE, objects }));
    expect(validateSavedLayout(saved)).toBeNull();
    expect(saved.objects).toEqual(objects);
    expect(objects[0].width).toBeGreaterThan(objects[0].height);
    expect(objects[2].color).toBe("#3b82f6");
  });

  it("centers the selection toolbar above the object and keeps it inside the pitch at corners", () => {
    const toolbar = { width: 246, height: 54 };
    const pitch = { width: 304, height: 202 };
    const bounds = { x: 142, y: 100, width: 20, height: 20 };
    expect(selectionToolbarPosition(bounds, toolbar, pitch)).toEqual({
      x: 29,
      y: 38,
    });
    expect(
      selectionToolbarPosition({ ...bounds, x: -5, y: -5 }, toolbar, pitch),
    ).toEqual({ x: 8, y: 23 });
    expect(
      selectionToolbarPosition({ ...bounds, x: 294, y: 192 }, toolbar, pitch),
    ).toEqual({ x: 50, y: 130 });
  });
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
    expect(converted.objects.filter((o) => o.team === 1).map((o) => o.color))
      .toEqual(Array(5).fill("#ef4444"));
    expect(converted.objects.filter((o) => o.team === 2).map((o) => o.color))
      .toEqual(Array(5).fill("#3b82f6"));
    expect(source).toEqual(original);
    expect(
      validateSavedLayout(JSON.parse(JSON.stringify(converted))),
    ).toBeNull();
    expect(converted.objects.find((o) => o.action === "line")?.rotation).toBe(
      15,
    );
  });
  it("keeps legacy tool variants out of the toolbar", () => {
    const legacyVariants = [
      "run-free", "dribble-free", "long-pass",
      "marker-blue", "marker-orange", "marker-yellow",
      "team1-player-2", "team1-player-more", "team2-player-2", "team2-player-more",
    ];
    expect(new Set(FOOTBALL.tools.flatMap((g) => g.types))).toEqual(
      new Set([
        ...ALLOWED_EQUIPMENT_TYPES.filter((type) => !legacyVariants.includes(type)),
        "wall",
      ]),
    );
  });
  it("numbers newly placed players per team and skips occupied labels", () => {
    const first = createObject("team1-player-1", point, "first");
    const edited = { ...createObject("team1-player-1", point, "edited"), label: "3" };
    const coach = createObject("team1-coach", point, "coach");
    const keeper = createObject("team1-goalkeeper", point, "keeper");
    const objects = [cone, first, coach, keeper];

    expect(nextPlayerLabel(objects, 1)).toBe("2");
    expect(nextPlayerLabel(objects, 2)).toBe("1");
    const fourth = { ...createObject("team1-player-1", point, "fourth"), label: "4" };
    expect(nextPlayerLabel([...objects, edited, fourth], 1)).toBe("2");
    expect(nextPlayerLabel([coach, keeper], 1)).toBe("1");
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
  it("keeps one endpoint when the pointer stops before releasing a freehand arrow", () => {
    const turn = { x: 260, y: 200 };
    const end = { x: 260, y: 150 };
    const movement = createObject("run-free", point, "run");
    const drawn = drawnObject(movement, point, end, [point, turn, end, end]);
    expect(drawn.points).toEqual([
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: -50 },
    ]);
  });
  it("aligns the arrowhead with the smoothed end of an older freehand drawing", () => {
    const movement = {
      ...createObject("run-free", point, "run"),
      points: [
        { x: 0, y: 0 },
        { x: 60, y: 0 },
        { x: 60, y: -50 },
        { x: 60, y: -50 },
      ],
    };
    const points = movementPoints(movement);
    expect(points.slice(0, 4)).toEqual([0, 0, 60, 0]);
    expect(points.slice(-2)).toEqual([60, -50]);
    expect(points.slice(-4, -2)).not.toEqual([60, -50]);
    const [leftX, leftY, tipX, tipY, rightX, rightY] = arrowheadPoints(
      points,
      0.25,
    );
    expect([tipX, tipY]).toEqual([60, -50]);
    const dx = tipX - (leftX + rightX) / 2;
    const dy = tipY - (leftY + rightY) / 2;
    expect(dy).toBeLessThan(0);
    expect(dx).toBeCloseTo(0);
  });
  it("centers the dribbling arrowhead on the line after a freehand turn", () => {
    const movement = {
      ...createObject("dribble-free", point, "dribble"),
      points: [
        { x: 0, y: 0 },
        { x: 60, y: 0 },
        { x: 60, y: -50 },
      ],
    };
    const points = movementPoints(movement);
    const [firstX, firstY, tipX, tipY, secondX, secondY] = arrowheadPoints(
      points,
      0.25,
    );
    expect([tipX, tipY]).toEqual([60, -50]);
    expect((firstX + secondX) / 2).toBeCloseTo(tipX);
    expect(Math.min(firstX, secondX)).toBeLessThan(tipX);
    expect(Math.max(firstX, secondX)).toBeGreaterThan(tipX);
    expect(firstY).toBeCloseTo(secondY);
    expect(firstY).toBeGreaterThan(tipY);
    expect(points.at(-6)).toBe(60);
    expect(points.at(-4)).toBe(60);
    expect(points[3]).not.toBe(0);
  });
  it.each(["run", "dribble", "pass", "long-pass", "shot"] as const)(
    "uses a straight centerline under the freehand %s arrowhead after a late turn",
    (tool) => {
      const movement = {
        ...createObject(tool, point, tool),
        path: "freehand" as const,
        points: [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 88, y: -3 },
          { x: 91, y: -7 },
        ],
      };
      const points = movementPoints(movement);
      const [firstX, firstY, secondX, secondY, tipX, tipY] = points.slice(-6);
      expect([tipX, tipY]).toEqual([91, -7]);
      expect(
        (secondX - firstX) * (tipY - secondY) -
          (secondY - firstY) * (tipX - secondX),
      ).toBeCloseTo(0);
      expect(
        (tipX - secondX) * (secondX - firstX) +
          (tipY - secondY) * (secondY - firstY),
      ).toBeGreaterThan(0);
    },
  );
  it.each(["straight", "curve", "freehand"] as const)(
    "joins both %s shot lines to the arrowhead wings",
    (path) => {
      const shot = {
        ...createObject("shot", point, "shot"),
        path,
        points: path === "straight"
          ? [{ x: 0, y: 0 }, { x: 60, y: -50 }]
          : [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: -50 }],
      };
      const center = movementPoints(shot);
      const head = arrowheadPoints(
        center,
        path === "freehand" ? 0.25 : 0,
      );
      const shafts = shotShafts(center, head);
      const [leftX, leftY, tipX, tipY, rightX, rightY] = head;
      expect([tipX, tipY]).toEqual([60, -50]);
      for (const [index, [wingX, wingY]] of [[leftX, leftY], [rightX, rightY]].entries()) {
        const [endX, endY] = shafts[index].slice(-2);
        const fraction = Math.hypot(endX - tipX, endY - tipY) / 14;
        expect(fraction).toBeGreaterThan(0);
        expect(fraction).toBeLessThan(1);
        expect(endX).toBeCloseTo(tipX + (wingX - tipX) * fraction);
        expect(endY).toBeCloseTo(tipY + (wingY - tipY) * fraction);
      }
      expect(Math.hypot(
        shafts[0].at(-2)! - shafts[1].at(-2)!,
        shafts[0].at(-1)! - shafts[1].at(-1)!,
      )).toBeCloseTo(6);
    },
  );
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
  it("places the yellow handle on the curve and drags the curve through the new handle position", () => {
    const curve = {
      ...createObject("pass", point, "pass"),
      path: "curve" as const,
      points: [
        { x: 5, y: 10 },
        { x: 110, y: -130 },
        { x: 200, y: 40 },
      ],
    };
    const handle = movementHandlePoint(curve, 1);
    expect(movementPoints(curve).slice(40, 42)).toEqual([handle.x, handle.y]);

    const target = { x: 125, y: -65 };
    const moved = moveMovementHandle(curve, 1, target);
    expect(movementPoints(moved).slice(40, 42)).toEqual([target.x, target.y]);
    expect(moved.points?.[0]).toEqual(curve.points[0]);
    expect(moved.points?.[2]).toEqual(curve.points[2]);
    expect(moveMovementHandle(curve, 1, handle)).toEqual(curve);
    expect(moveMovementHandle(curve, 2, target).points?.[2]).toEqual(target);
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
  it("undoes a live color adjustment in one step and starts a new step for another picker session", () => {
    const history = { past: [], present: exercise, future: [] };
    const colored = (color: string) => ({
      ...exercise,
      objects: [{ ...cone, color }],
    });
    const adjustment = Symbol();
    const first = commit(history, colored("#123456"), adjustment);
    const second = commit(first, colored("#654321"), adjustment);
    expect(second.present).toEqual(colored("#654321"));
    expect(undo(second).present).toEqual(exercise);
    expect(redo(undo(second)).present).toEqual(second.present);
    expect(commit(second, exercise, adjustment).past).toHaveLength(0);
    expect(undo(commit(second, colored("#abcdef"), Symbol())).present).toEqual(
      second.present,
    );
  });
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
