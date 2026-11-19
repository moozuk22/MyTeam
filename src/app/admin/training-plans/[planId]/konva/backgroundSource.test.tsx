import { afterEach, expect, it, vi } from "vitest";
import type { ExerciseBackground } from "@/lib/exercise/model";
const hooks = vi.hoisted(() => ({ value: undefined as unknown, effects: [] as (() => void)[] }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: () => [hooks.value, (value: unknown) => { hooks.value = value; }],
  useEffect: (effect: () => void) => { hooks.effects.push(effect); },
}));
vi.mock("react-konva", () => Object.fromEntries(
  ["Circle", "Ellipse", "Group", "Image", "Line", "Rect", "Shape", "Text"].map((name) => [name, name]),
));
import { PitchBackground } from "./Visuals";
afterEach(() => { hooks.value = undefined; hooks.effects = []; vi.unstubAllGlobals(); });
it("renders a relative image URL and hides a previous image while its replacement loads", () => {
  class BrowserImage {
    onload?: () => void;
    private source = "";
    set src(value: string) { this.source = new URL(value, "http://localhost").href; this.onload?.(); }
    get src() { return this.source; }
  }
  vi.stubGlobal("window", { Image: BrowserImage });
  const background: ExerciseBackground = {
    src: "/api/admin/clubs/11111111-1111-4111-8111-111111111111/training-plans/images/22222222-2222-4222-8222-222222222222",
    x: 525, y: 350, width: 100, height: 100, rotation: 0,
  };
  expect(PitchBackground({ surface: "blank", background }).props.image).toBeUndefined();
  hooks.effects.splice(0).forEach((effect) => effect());
  expect(PitchBackground({ surface: "blank", background }).props.image).toBeInstanceOf(BrowserImage);
  expect(PitchBackground({ surface: "blank", background: { ...background, src: background.src.replace("22222222", "33333333") } }).props.image).toBeUndefined();
});

it("renders a built-in pitch without an imported image", () => {
  expect(PitchBackground({ surface: "full" }).props.image).toBeUndefined();
});
