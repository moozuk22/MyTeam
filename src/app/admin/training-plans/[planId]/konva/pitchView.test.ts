import { describe, expect, it } from "vitest";
import { PITCH_QUADRANTS } from "@/lib/exercise/model";
import { fitPitchPreview, landscapePitchRotation, pitchObjectRotation, pitchViewport } from "./pitchView";

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

describe("print pitch rotation", () => {
  it.each([[0, 0], [90, 180], [180, 180], [270, 0]] as const)(
    "renders full pitches from %i° at %i°", (saved, result) => {
      expect(landscapePitchRotation(pitchViewport(PITCH_QUADRANTS), saved)).toBe(result);
    },
  );

  it("uses the visible cropped aspect ratio and preserves square views", () => {
    const tall = pitchViewport(["top-left", "bottom-left"]);
    expect(landscapePitchRotation(tall, 0)).toBe(90);
    expect(landscapePitchRotation(tall, 90)).toBe(90);
    const square = { x: 0, y: 0, width: 300, height: 300, clipFunc: undefined };
    expect(landscapePitchRotation(square, 270)).toBe(270);
  });

  it("keeps upright objects at their individual angle and rotates field-relative geometry", () => {
    for (const kind of ["player", "equipment", "text"]) {
      expect(180 + pitchObjectRotation(kind, 15, 180)).toBe(15);
    }
    for (const kind of ["movement", "zone"]) {
      expect(180 + pitchObjectRotation(kind, 15, 180)).toBe(195);
    }
  });
});
