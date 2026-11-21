import { expect, it } from "vitest";
import { equalDrawings } from "./equalDrawings";

function root(boxes: { height: number; drawing: boolean }[]) {
  const properties = new Map<string, string>([["--td-drawing-height", "10px"]]);
  return {
    properties,
    style: {
      setProperty: (name: string, value: string) => { properties.set(name, value); },
      removeProperty: (name: string) => { properties.delete(name); },
    },
    querySelectorAll: () => boxes.map(({ height, drawing }) => ({ clientHeight: height, querySelector: () => drawing ? {} : null })),
  };
}

it("gives all drawings the smallest space of a section with a drawing", () => {
  const sheet = root([{ height: 270, drawing: true }, { height: 228, drawing: true }, { height: 100, drawing: false }, { height: 256, drawing: true }]);
  equalDrawings(sheet);
  expect(sheet.properties.get("--td-drawing-height")).toBe("226px");
});

it("removes the height when the plan has no drawings", () => {
  const sheet = root([{ height: 100, drawing: false }]);
  equalDrawings(sheet);
  expect(sheet.properties.has("--td-drawing-height")).toBe(false);
});
