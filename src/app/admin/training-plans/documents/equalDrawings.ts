type Box = { clientHeight: number; querySelector: (selector: string) => unknown };
type Root = {
  style: { setProperty: (name: string, value: string) => void; removeProperty: (name: string) => void };
  querySelectorAll: (selector: string) => ArrayLike<Box>;
};

/** The padding of `.td-printed-diagrams`: 1px at the top and 1px at the bottom. */
const PADDING = 2;

/**
 * Gives all drawings of the plan the same height. The height is the smallest space that a section has for its drawing.
 * The space does not depend on the drawing, because the drawing box has a minimum height of 0.
 */
export function equalDrawings(root: Root) {
  root.style.removeProperty("--td-drawing-height");
  const heights = Array.from(root.querySelectorAll(".td-printed-diagrams"))
    .filter((box) => box.querySelector(".td-drawing"))
    .map((box) => box.clientHeight - PADDING);
  if (heights.length) root.style.setProperty("--td-drawing-height", `${Math.max(0, Math.min(...heights))}px`);
}
