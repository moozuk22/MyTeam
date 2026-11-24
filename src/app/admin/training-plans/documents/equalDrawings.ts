type Box = { clientHeight: number; offsetHeight: number; querySelector: (selector: string) => unknown };
type Root = {
  style: { setProperty: (name: string, value: string) => void; removeProperty: (name: string) => void };
  querySelectorAll: (selector: string) => ArrayLike<Box>;
};

/** The padding of `.td-printed-diagrams`: 1px at the top and 1px at the bottom. */
const PADDING = 2;
/** The heading and the requirements of a section, above its drawing. */
export const SECTION_TOP = ".td-printed-section > .td-printed-split:first-child";

/**
 * Aligns the drawings of all sections and gives them the same height.
 * First, the heading and requirements of every section get the height of the tallest one, so all drawings start at the same level.
 * Then the drawings get the smallest space that a section has for its drawing.
 * The space does not depend on the drawing, because the drawing box has a minimum height of 0.
 */
export function equalDrawings(root: Root) {
  root.style.removeProperty("--td-section-top-height");
  root.style.removeProperty("--td-drawing-height");
  const tops = Array.from(root.querySelectorAll(SECTION_TOP)).map((box) => box.offsetHeight);
  if (tops.length) root.style.setProperty("--td-section-top-height", `${Math.max(...tops)}px`);
  const heights = Array.from(root.querySelectorAll(".td-printed-diagrams"))
    .filter((box) => box.querySelector(".td-drawing"))
    .map((box) => box.clientHeight - PADDING);
  if (heights.length) root.style.setProperty("--td-drawing-height", `${Math.max(0, Math.min(...heights))}px`);
}
