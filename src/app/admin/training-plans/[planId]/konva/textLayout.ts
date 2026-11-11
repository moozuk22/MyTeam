import Konva from "konva";
import type { ExerciseObject } from "@/lib/exercise/model";

const graphemes = typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("bg", { granularity: "grapheme" })
  : undefined;

export function measurePitchText(label: string, fontSize: number, width: number) {
  const text = new Konva.Text({ text: label, fontSize });
  let minWidth = 2;
  const segments = graphemes
    ? Array.from(graphemes.segment(label), ({ segment }) => segment)
    : Array.from(label);
  for (const segment of segments) {
    minWidth = Math.max(minWidth, Math.ceil(text.measureSize(segment).width));
  }
  text.width(Math.max(minWidth, width));
  const minHeight = Math.max(2, Math.ceil(text.height()));
  text.destroy();
  return { minWidth, minHeight };
}

export function resizePitchText(node: Konva.Node, object: ExerciseObject) {
  const text = (node as Konva.Group).findOne<Konva.Text>("Text");
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  if (!text || scaleX <= 0 || scaleY <= 0) return;
  const width = object.width * scaleX;
  // Transformer matrix calculations can put an exact line height just below
  // the boundary due to floating-point error.
  const height = Math.round(object.height * scaleY * 1e6) / 1e6;
  // Keep the text at its own font size while the transformer scales its box.
  text.setAttrs({
    scaleX: 1 / scaleX,
    scaleY: 1 / scaleY,
    width,
    height,
  });
  return { width, height };
}
