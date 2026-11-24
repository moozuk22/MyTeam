import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export function documentPdfFilename(title: string) {
  const name = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").trim().slice(0, 120);
  return `${name || "План-конспект"}.pdf`;
}

export async function createDocumentPdf(paper: HTMLElement): Promise<Blob> {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  await addDocumentPages(pdf, paper, true);
  return pdf.output("blob");
}

/**
 * Adds the pages of one plan to the PDF. The first page goes on the current PDF page when `first` is true.
 * Each canvas is released after its page is added, so a long export keeps only one page canvas in memory.
 */
export async function addDocumentPages(pdf: jsPDF, paper: HTMLElement, first = false) {
  const pageElements = paper.querySelectorAll?.<HTMLElement>(".td-print-page");
  const pages = pageElements?.length ? Array.from(pageElements) : [paper];
  const margin = 8;
  const width = 297 - margin * 2;
  const height = width * 730 / 1060;
  for (const [index, page] of pages.entries()) {
    const canvas = await html2canvas(page, {
      backgroundColor: "#ffffff",
      scale: 2,
      width: 1060,
      height: 730,
      logging: false,
      onclone: (_document, clonedPage) => {
        // Export each page at the same size on phones and desktops.
        clonedPage.style.transform = "none";
        const multipagePaper = clonedPage.closest<HTMLElement>(".td-paper-multipage");
        if (multipagePaper) {
          multipagePaper.style.width = "1060px";
          multipagePaper.style.height = "auto";
          multipagePaper.style.transform = "none";
          multipagePaper.style.overflow = "visible";
        }
        const preview = clonedPage.closest<HTMLElement>(".td-preview");
        if (preview) {
          preview.style.width = "1060px";
          preview.style.maxWidth = "none";
          preview.style.height = "730px";
          preview.style.overflow = "visible";
        }
      },
    });
    try {
      if (index > 0 || !first) pdf.addPage();
      // jsPDF reads the pixels during addImage, so the canvas is not necessary after it.
      pdf.addImage(canvas, "PNG", margin, margin, width, height, undefined, "FAST");
    } finally {
      releaseCanvases([canvas]);
    }
  }
}

/** Frees the memory of the canvases after the export. */
export function releaseCanvases(canvases: HTMLCanvasElement[]) {
  for (const canvas of canvases) {
    canvas.width = 0;
    canvas.height = 0;
  }
}
