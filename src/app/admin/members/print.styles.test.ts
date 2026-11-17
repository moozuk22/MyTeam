import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("hides page content only while the attendance print dialog is present", () => {
  const css = readFileSync(new URL("./page.css", import.meta.url), "utf8");
  const print = css.slice(css.indexOf("@media print"));
  expect(print).not.toMatch(/body\s+\*\s*\{\s*visibility:\s*hidden/);
  expect(print).toMatch(/body:where\(:has\(\.acd-dialog\)\)\s+\*\s*\{\s*visibility:\s*hidden/);
  expect(print).toMatch(/\.acd-dialog,\s*\.acd-dialog\s+\*\s*\{\s*visibility:\s*visible/);
});
