import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const css = readFileSync(new URL("./documents.css", import.meta.url), "utf8");

// A page margin gives the browser space for its header and footer: date, page title, page address and page number.
it("prints the plan on a page without a margin", () => {
  expect(css).toMatch(/@page training-note\s*\{\s*size:\s*A4 landscape;\s*margin:\s*0;\s*\}/);
});

// Printers cannot print to the edge of the paper. Each printed page keeps 8 mm of space around the sheet.
it("keeps 8 mm of space around the sheet on each printed page", () => {
  const print = css.slice(css.indexOf("@page training-note"));
  const rule = (selector: string) => print.slice(print.indexOf(`${selector} {`), print.indexOf("}", print.indexOf(`${selector} {`)));
  expect(rule("  .td-preview")).toMatch(/padding:\s*8mm;/);
  expect(rule("  .td-preview-multipage .td-print-page")).toMatch(/height:\s*210mm;[\s\S]*padding:\s*8mm;/);
  expect(rule("  .td-preview-multipage .td-print-page")).toMatch(/box-sizing:\s*border-box;/);
});
