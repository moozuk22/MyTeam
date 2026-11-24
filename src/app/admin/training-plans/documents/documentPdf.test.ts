import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ capture: vi.fn(), addImage: vi.fn(), output: vi.fn(), construct: vi.fn() }));
vi.mock("html2canvas-pro", () => ({ default: mocks.capture }));
vi.mock("jspdf", () => ({ jsPDF: class {
  constructor(options: unknown) { mocks.construct(options); }
  addImage = mocks.addImage;
  output = mocks.output;
} }));
import { createDocumentPdf, documentPdfFilename } from "./documentPdf";
afterEach(() => vi.clearAllMocks());
it("exports the complete sheet on one A4 landscape page and releases its canvas", async () => {
  const paper = {} as HTMLElement;
  const canvas = { width: 2120, height: 1460 };
  const blob = new Blob(["pdf"], { type: "application/pdf" });
  mocks.capture.mockResolvedValue(canvas);
  mocks.output.mockReturnValue(blob);
  expect(await createDocumentPdf(paper)).toBe(blob);
  expect(mocks.capture).toHaveBeenCalledWith(paper, expect.objectContaining({ width: 1060, height: 730, scale: 2 }));
  const preview = { style: {} };
  const clone = { style: {}, closest: vi.fn((selector: string) => selector === ".td-preview" ? preview : null) };
  mocks.capture.mock.calls[0][1].onclone({}, clone);
  expect(clone.style).toEqual({ transform: "none" });
  expect(preview.style).toEqual({ width: "1060px", maxWidth: "none", height: "730px", overflow: "visible" });
  expect(mocks.construct).toHaveBeenCalledWith({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  expect(mocks.addImage).toHaveBeenCalledWith(canvas, "PNG", 8, 8, 281, 281 * 730 / 1060, undefined, "FAST");
  expect(canvas).toEqual({ width: 0, height: 0 });
});
it("releases the canvas if PDF creation fails", async () => {
  const canvas = { width: 2120, height: 1460 };
  mocks.capture.mockResolvedValue(canvas);
  mocks.addImage.mockImplementationOnce(() => { throw new Error("PDF failed"); });
  await expect(createDocumentPdf({} as HTMLElement)).rejects.toThrow("PDF failed");
  expect(canvas).toEqual({ width: 0, height: 0 });
});
it("releases each page canvas before it captures the next page", async () => {
  const pages = [{ style: {} }, { style: {} }];
  const paper = { querySelectorAll: () => pages } as unknown as HTMLElement;
  const canvases = [{ width: 2120, height: 1460 }, { width: 2120, height: 1460 }];
  mocks.capture.mockImplementation(async (page: unknown) => {
    // The canvas of the page before is already released.
    if (page === pages[1]) expect(canvases[0]).toEqual({ width: 0, height: 0 });
    return canvases[pages.indexOf(page as { style: object })];
  });
  const addPage = vi.fn();
  const { addDocumentPages } = await import("./documentPdf");
  await addDocumentPages({ addImage: mocks.addImage, addPage } as unknown as import("jspdf").jsPDF, paper, true);
  expect(addPage).toHaveBeenCalledTimes(1);
  expect(canvases).toEqual([{ width: 0, height: 0 }, { width: 0, height: 0 }]);
});
it("uses a safe filename and retains Bulgarian text", () => {
  expect(documentPdfFilename('План: "Пасове" / 1')).toBe("План   Пасове    1.pdf");
  expect(documentPdfFilename("  ")).toBe("План-конспект.pdf");
  expect(documentPdfFilename("а".repeat(150))).toHaveLength(124);
});
