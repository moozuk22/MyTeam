import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { blankDocument } from "@/lib/exercise/document";
const hooks = vi.hoisted(() => ({ ready: true, pdf: vi.fn(), paper: null as null | { querySelector: ReturnType<typeof vi.fn> }, setState: vi.fn(), states: 0, effects: 0, cleanup: undefined as undefined | (() => void) }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.states++;
    return [index === 4 ? (hooks.ready ? 1 : 0) : index === 6 ? hooks.ready : initial, hooks.setState];
  },
  useRef: (initial: unknown) => ({ current: initial === null ? hooks.paper : initial }),
  useCallback: (callback: unknown) => callback,
  useLayoutEffect: () => {},
  useEffect: (effect: () => undefined | (() => void)) => { if (hooks.effects++ === 0) hooks.cleanup = effect(); },
}));
vi.mock("./documentPdf", () => ({ createDocumentPdf: hooks.pdf, documentPdfFilename: () => "План.pdf" }));
import DocumentSheet from "./DocumentSheet";
let print: ReturnType<typeof vi.fn>;
let dataset: Record<string, string>;
beforeEach(() => {
  hooks.ready = true;hooks.paper = null;hooks.pdf.mockReset();hooks.states = 0;hooks.effects = 0;hooks.cleanup = undefined;hooks.setState.mockClear();
  print = vi.fn();dataset = {};
  vi.stubGlobal("window", Object.assign(new EventTarget(), { print }));
  vi.stubGlobal("document", { documentElement: { dataset } });
});
afterEach(() => { hooks.cleanup?.();vi.unstubAllGlobals(); });
function findPrint(node: ReactNode, label = "Печат"): (() => void) | undefined {
  if (Array.isArray(node)) return node.map(child => findPrint(child, label)).find(Boolean);
  if (!node || typeof node !== "object" || !("props" in node)) return;
  const element = node as ReactElement<{ children?: ReactNode; onClick?: () => void }>;
  if (element.type === "button" && element.props.children === label) return element.props.onClick;
  return findPrint(element.props.children, label);
}
function click(canPrint: boolean, checkPrint: () => Promise<boolean>, label = "Печат") {
  const button = findPrint(DocumentSheet({ content: blankDocument(), pending: false, canPrint, checkPrint }), label);
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

it("rejects PDF downloads without access and after access expires", async () => {
  const check = vi.fn().mockResolvedValue(false);
  click(false, check, "Изтегли PDF");
  expect(check).not.toHaveBeenCalled();
  hooks.states = 0;hooks.effects = 0;
  click(true, check, "Изтегли PDF");
  await vi.waitFor(() => expect(check).toHaveBeenCalledOnce());
  expect(hooks.pdf).not.toHaveBeenCalled();
  expect(dataset.trainingPrintAuthorized).toBeUndefined();
});
it("downloads a PDF without opening the browser print dialog", async () => {
  const paper = {};
  hooks.paper = { querySelector: vi.fn(() => paper) };
  hooks.pdf.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
  const link = { click: vi.fn(), remove: vi.fn() };
  Object.assign(document, { createElement: vi.fn(() => link), body: { append: vi.fn() } });
  const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  try {
    click(true, async () => true, "Изтегли PDF");
    await vi.waitFor(() => expect(link.click).toHaveBeenCalledOnce());
    expect(hooks.pdf).toHaveBeenCalledWith(paper);
    expect(link).toMatchObject({ href: "blob:test", download: "План.pdf" });
    expect(print).not.toHaveBeenCalled();
    expect(dataset.trainingPrintAuthorized).toBeUndefined();
  } finally { createUrl.mockRestore(); }
});
it("shows an error and restores controls when PDF creation fails", async () => {
  hooks.paper = { querySelector: vi.fn(() => ({})) };
  hooks.pdf.mockRejectedValue(new Error("Canvas unavailable"));
  click(true, async () => true, "Изтегли PDF");
  await vi.waitFor(() => expect(hooks.setState).toHaveBeenCalledWith("PDF файлът не може да се подготви. Опитайте отново."));
  expect(hooks.setState).toHaveBeenLastCalledWith(false);
  expect(print).not.toHaveBeenCalled();
});

it("waits for content readiness before checking PDF access", () => {
  hooks.ready = false;
  const check = vi.fn().mockResolvedValue(true);
  click(true, check, "Изтегли PDF");
  expect(check).not.toHaveBeenCalled();
  expect(hooks.pdf).not.toHaveBeenCalled();
});
it("prevents duplicate PDF requests while the access check is pending", async () => {
  let resolve!: (value: boolean) => void;
  const check = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
  const button = findPrint(DocumentSheet({ content: blankDocument(), pending: false, canPrint: true, checkPrint: check }), "Изтегли PDF")!;
  button();button();
  expect(check).toHaveBeenCalledOnce();
  resolve(false);
  await vi.waitFor(() => expect(hooks.setState).toHaveBeenLastCalledWith(false));
  expect(hooks.pdf).not.toHaveBeenCalled();
});
