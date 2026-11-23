import { expect, it } from "vitest";
import { equalDrawings, SECTION_TOP } from "./equalDrawings";

function root(tops: number[], boxes: { height: number; drawing: boolean }[]) {
  const properties = new Map<string, string>([["--td-drawing-height", "10px"], ["--td-section-top-height", "10px"]]);
  const order: string[] = [];
  return {
    properties,
    order,
    style: {
      setProperty: (name: string, value: string) => { properties.set(name, value); order.push(name); },
      removeProperty: (name: string) => { properties.delete(name); },
    },
    querySelectorAll: (selector: string) => selector === SECTION_TOP
      ? tops.map((height) => ({ clientHeight: height, offsetHeight: height, querySelector: () => null }))
      : boxes.map(({ height, drawing }) => ({ clientHeight: height, offsetHeight: height, querySelector: () => drawing ? {} : null })),
  };
}

it("gives the heading and requirements of every section the height of the tallest one", () => {
  const sheet = root([42, 96, 61, 40, 55], [{ height: 200, drawing: true }]);
  equalDrawings(sheet);
  expect(sheet.properties.get("--td-section-top-height")).toBe("96px");
});

it("measures the drawing space after it aligns the sections", () => {
  const sheet = root([42, 96], [{ height: 270, drawing: true }, { height: 228, drawing: true }, { height: 100, drawing: false }, { height: 256, drawing: true }]);
  equalDrawings(sheet);
  expect(sheet.properties.get("--td-drawing-height")).toBe("226px");
  expect(sheet.order).toEqual(["--td-section-top-height", "--td-drawing-height"]);
});

it("removes both heights when the plan has no sections or drawings", () => {
  const sheet = root([], [{ height: 100, drawing: false }]);
  equalDrawings(sheet);
  expect(sheet.properties.has("--td-drawing-height")).toBe(false);
  expect(sheet.properties.has("--td-section-top-height")).toBe(false);
});
