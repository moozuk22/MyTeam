import { describe, expect, it } from "vitest";
import { buildArrowHeadPath, buildSmoothPath, getNormalizedDrawPoint } from "./geometry";

describe("training-plan drawing geometry", () => {
  it("normalizes pointer coordinates and keeps out-of-pitch drags inside the pitch", () => {
    const surface = {
      getBoundingClientRect: () => ({ left: 20, top: 40, width: 200, height: 100 }),
    } as SVGSVGElement;

    expect(getNormalizedDrawPoint(surface, 120, 65)).toEqual({ x: 0.5, y: 0.25 });
    expect(getNormalizedDrawPoint(surface, -50, 200)).toEqual({ x: 0, y: 1 });
  });

  it("does not draw incomplete freehand gestures or zero-length arrowheads", () => {
    expect(buildSmoothPath([])).toBe("");
    expect(buildSmoothPath([{ x: 0.5, y: 0.5 }])).toBe("");
    expect(buildArrowHeadPath({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBe("");
  });

  it("scales freehand coordinates into the SVG viewBox and ends at the last point", () => {
    expect(buildSmoothPath([{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.6 }, { x: 0.9, y: 1 }]))
      .toBe("M 10 20 Q 10 20, 30 40 Q 50 60, 70 80 T 90 100");
  });

  it("points arrowheads toward the gesture endpoint in either direction", () => {
    expect(buildArrowHeadPath({ x: 0, y: 0 }, { x: 1, y: 0 }))
      .toBe("M 100 0 L 97.2 1.8 L 97.2 -1.8 Z");
    expect(buildArrowHeadPath({ x: 1, y: 0 }, { x: 0, y: 0 }))
      .toBe("M 0 0 L 2.8 -1.8 L 2.8 1.8 Z");
  });
});
