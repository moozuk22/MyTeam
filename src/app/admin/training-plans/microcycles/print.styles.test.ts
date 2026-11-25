import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Next.js keeps this stylesheet after a client navigation from a microcycle to its plan.
// An unscoped rule would hide the plan document in print.
it("hides page content in print only on the microcycle page", () => {
  const css = readFileSync(new URL("./workspace.css", import.meta.url), "utf8");
  const print = css.slice(css.indexOf("@media print"));
  expect(print).not.toMatch(/body\s+\*\s*\{\s*visibility:\s*hidden/);
  expect(print).toMatch(/body:where\(:has\(\.mc-page\)\)\s+\*\s*\{\s*visibility:\s*hidden/);
});
