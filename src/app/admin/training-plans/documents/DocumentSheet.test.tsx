import { expect, it } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { blankDocument } from "@/lib/exercise/document";
import { PrintedTopRow } from "./DocumentSheet";

function printedLabels(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(printedLabels);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<{ children?: ReactNode; label?: string; value?: string }>;
  const own = typeof element.props.label === "string" ? [`${element.props.label}=${element.props.value}`] : [];
  return [...own, ...printedLabels(element.props.children)];
}

it("prints the group next to the microcycle and training number", () => {
  const content = blankDocument("Юноши U15");
  content.session.microcycle = "3";
  content.session.sessionNumber = "2";
  const labels = printedLabels(PrintedTopRow({ content, monochrome: false, onReport: () => {}, attempt: 0 }));
  const group = labels.indexOf("Група=Юноши U15");
  expect(group).toBeGreaterThanOrEqual(0);
  expect(labels.slice(group, group + 4)).toEqual(["Група=Юноши U15", "Период=", "Микроцикъл=3", "Тренировка №=2"]);
});
