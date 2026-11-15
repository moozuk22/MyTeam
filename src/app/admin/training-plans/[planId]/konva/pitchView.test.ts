import { describe, expect, it } from "vitest";
import { PITCH_QUADRANTS } from "@/lib/exercise/model";
import { fitPitchPreview, pitchViewport } from "./pitchView";

describe("fitPitchPreview", () => {
  it.each([
    { quadrants: PITCH_QUADRANTS, rotation: 0, width: 381, height: 254 },
    { quadrants: PITCH_QUADRANTS, rotation: 90, width: 169, height: 254 },
    { quadrants: ["top-left", "top-right"], rotation: 0, width: 381, height: 127 },
  ] as const)("fits a pitch rotated $rotation° inside fractional card bounds", ({ quadrants, rotation, width, height }) => {
    const view = fitPitchPreview(pitchViewport(quadrants), rotation, { width: 381.75, height: 254.5 });

    expect(view.width).toBe(width);
    expect(view.height).toBe(height);
    expect(view.viewLayer.scaleX).toBe(view.viewLayer.scaleY);
  });
});
