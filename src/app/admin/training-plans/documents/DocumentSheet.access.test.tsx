import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { blankDocument } from "@/lib/exercise/document";
const hooks = vi.hoisted(() => ({ setState: vi.fn(), effects: 0, cleanup: undefined as undefined | (() => void) }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => [initial, hooks.setState],
  useRef: (initial: unknown) => ({ current: initial }),
  useCallback: (callback: unknown) => callback,
  useLayoutEffect: () => {},
  useEffect: (effect: () => undefined | (() => void)) => { if (hooks.effects++ === 0) hooks.cleanup = effect(); },
}));
import DocumentSheet from "./DocumentSheet";
let print: ReturnType<typeof vi.fn>;
let dataset: Record<string, string>;
beforeEach(() => {
  hooks.effects = 0;hooks.cleanup = undefined;hooks.setState.mockClear();
  print = vi.fn();dataset = {};
  vi.stubGlobal("window", Object.assign(new EventTarget(), { print }));
  vi.stubGlobal("document", { documentElement: { dataset } });
});
afterEach(() => { hooks.cleanup?.();vi.unstubAllGlobals(); });
function findPrint(node: ReactNode): (() => void) | undefined {
  if (Array.isArray(node)) return node.map(findPrint).find(Boolean);
  if (!node || typeof node !== "object" || !("props" in node)) return;
  const element = node as ReactElement<{ children?: ReactNode; onClick?: () => void }>;
  if (element.type === "button" && element.props.children === "Печат") return element.props.onClick;
  return findPrint(element.props.children);
}
function click(canPrint: boolean, checkPrint: () => Promise<boolean>) {
  const button = findPrint(DocumentSheet({ content: blankDocument(), pending: false, canPrint, checkPrint }));
  expect(button).toBeTypeOf("function");button!();
}
it("does not start a print check without initial access", async () => {
  const check = vi.fn().mockResolvedValue(true);click(false, check);
  expect(check).not.toHaveBeenCalled();expect(print).not.toHaveBeenCalled();
  expect(hooks.setState).toHaveBeenCalledWith("Не можете да запазвате или печатате, защото нямате активен абонамент за планове за тренировки.");
});
it("rejects access that expired after the preview opened", async () => {
  const check = vi.fn().mockResolvedValue(false);click(true, check);
  await vi.waitFor(() => expect(check).toHaveBeenCalledOnce());
  expect(print).not.toHaveBeenCalled();expect(dataset.trainingPrintAuthorized).toBeUndefined();
});
it("keeps print access until afterprint and clears it on completion", async () => {
  click(true, async () => true);
  await vi.waitFor(() => expect(print).toHaveBeenCalledOnce());
  expect(dataset.trainingPrintAuthorized).toBe("true");
  window.dispatchEvent(new Event("afterprint"));expect(dataset.trainingPrintAuthorized).toBeUndefined();
});
it("clears print access if the browser cannot open printing", async () => {
  print.mockImplementation(() => { throw new Error("Unavailable"); });click(true, async () => true);
  await vi.waitFor(() => expect(print).toHaveBeenCalledOnce());
  expect(dataset.trainingPrintAuthorized).toBeUndefined();
});
