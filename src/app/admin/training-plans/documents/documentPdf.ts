import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export function documentPdfFilename(title: string) {
  const name = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").trim().slice(0, 120);
  return `${name || "План-конспект"}.pdf`;
}

export async function createDocumentPdf(paper: HTMLElement): Promise<Blob> {
  const pageElements = paper.querySelectorAll?.<HTMLElement>(".td-print-page");
  const pages = pageElements?.length ? Array.from(pageElements) : [paper];
  const canvases: HTMLCanvasElement[] = [];
  try {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    const width = 281;
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
          const preview = clonedPage.closest<HTMLElement>(".td-preview");
          if (preview) {
            preview.style.width = "1060px";
            preview.style.maxWidth = "none";
            preview.style.height = "730px";
            preview.style.overflow = "visible";
          }
        },
      });
      canvases.push(canvas);
      if (index > 0) pdf.addPage();
      pdf.addImage(canvas, "PNG", 8, 8, width, width * 730 / 1060, undefined, "FAST");
    }
    return pdf.output("blob");
  } finally {
    for (const canvas of canvases) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
