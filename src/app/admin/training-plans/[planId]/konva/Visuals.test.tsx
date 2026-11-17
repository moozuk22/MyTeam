import { afterEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { ExerciseObject } from "@/lib/exercise/model";

vi.mock("react-konva", () => Object.fromEntries(
  ["Circle", "Ellipse", "Group", "Image", "Line", "Rect", "Shape", "Text"].map(name => [name, name]),
));
import { ObjectVisual } from "./Visuals";

const renderObject = (ObjectVisual as unknown as {
  type: (props: { object: ExerciseObject; icons: { marker: HTMLImageElement }; monochrome: boolean }) => ReactElement;
}).type;

afterEach(() => vi.unstubAllGlobals());

it.each(["#f59e0b", "#00ff00"])("renders equipment %s in monochrome and preserves normal color", (color) => {
  const tintContext = {
    canvas: { width: 0, height: 0 }, clearRect: vi.fn(), drawImage: vi.fn(),
    fillRect: vi.fn(), fillStyle: "", globalCompositeOperation: "",
  };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => tintContext }) });
  const image = {} as HTMLImageElement;
  const object = { kind: "equipment", equipment: "marker", width: 40, height: 40, color } as ExerciseObject;
  for (const monochrome of [true, false]) {
    const element = renderObject({ object, icons: { marker: image }, monochrome });
    const icon = (element.type as (props: unknown) => ReactElement)(element.props);
    if (!monochrome && color === "#f59e0b") {
      expect(icon.type).toBe("Image");
      expect((icon.props as { image: unknown }).image).toBe(image);
    } else {
      expect(icon.type).toBe("Shape");
      const drawImage = vi.fn();
      (icon.props as { sceneFunc: (context: unknown) => void }).sceneFunc({ drawImage });
      expect(tintContext.fillStyle).toBe(monochrome ? "#202020" : color);
      expect(drawImage.mock.calls[0][0]).toBe(tintContext.canvas);
    }
  }
  expect(object.color).toBe(color);
});
