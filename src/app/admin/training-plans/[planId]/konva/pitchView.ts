import type Konva from "konva";
import { HEIGHT, PITCH_QUADRANT_BOUNDS, WIDTH, type PitchQuadrant, type PitchRotation } from "@/lib/exercise/model";

export function pitchViewport(quadrants: readonly PitchQuadrant[]) {
  const origins = quadrants.map((part) => PITCH_QUADRANT_BOUNDS[part]);
  const x = Math.min(...origins.map((origin) => origin.x));
  const y = Math.min(...origins.map((origin) => origin.y));
  const width = Math.max(...origins.map((origin) => origin.x)) - x + WIDTH / 2;
  const height = Math.max(...origins.map((origin) => origin.y)) - y + HEIGHT / 2;
  const clipFunc = width * height > origins.length * (WIDTH / 2) * (HEIGHT / 2)
    ? (context: Konva.Context) => {
        for (const origin of origins) context.rect(origin.x, origin.y, WIDTH / 2, HEIGHT / 2);
      }
    : undefined;
  return { x, y, width, height, clipFunc };
}

export function pitchView(viewport: ReturnType<typeof pitchViewport>, rotation: PitchRotation, width: number) {
  const sideways = rotation === 90 || rotation === 270;
  const viewWidth = sideways ? viewport.height : viewport.width;
  const viewHeight = sideways ? viewport.width : viewport.height;
  const scale = width / viewWidth;
  const viewLayer = {
    rotation,
    offsetX: viewport.x + (rotation === 180 || rotation === 270 ? viewport.width : 0),
    offsetY: viewport.y + (rotation === 90 || rotation === 180 ? viewport.height : 0),
    scaleX: scale,
    scaleY: scale,
    clipFunc: viewport.clipFunc,
  };
  return { viewWidth, viewHeight, scale, viewLayer };
}
