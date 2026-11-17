"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { Group, Layer, Stage } from "react-konva";
import { getPitchQuadrants, isInPitchQuadrants, type Exercise } from "@/lib/exercise/model";
import { loadPitchIcons, ObjectVisual, PitchScene, type PitchIcons } from "../[planId]/konva/Visuals";
import { fillPitchArea, landscapePitchRotation, pitchObjectRotation, pitchViewport } from "../[planId]/konva/pitchView";

export type DrawingStatus = "ready" | "failed";
export type DrawingReport = (slot: number, placement: string, layout: Exercise, status: DrawingStatus) => void;

async function loadBackground(source: string | undefined, monochrome: boolean) {
  if (!source) return undefined;
  const image = new Image();
  image.src = source;
  await image.decode();
  if (!monochrome) return image;

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Print canvas unavailable");
  context.filter = "grayscale(1)";
  context.drawImage(image, 0, 0);
  context.filter = "none";
  context.fillStyle = "rgba(255, 255, 255, 0.58)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

export default memo(function PrintDrawing({ layout, title, index, placement, monochrome, onReport }: {
  layout: Exercise; title: string; index: number; placement: string; monochrome: boolean; onReport: DrawingReport;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [assets, setAssets] = useState<{ layout: Exercise; icons: PitchIcons; background?: CanvasImageSource }>();
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.all([loadPitchIcons(), loadBackground(layout.background?.src, monochrome)]).then(([icons, background]) => {
      if (Object.values(icons).some((image) => !image)) throw new Error("Missing pitch icons");
      if (active) setAssets({ layout, icons, background });
    }).catch(() => {
      if (active) onReport(index, placement, layout, "failed");
    });
    return () => { active = false; };
  }, [layout, index, placement, monochrome, onReport]);

  const onLayer = useCallback((layer: Konva.Layer | null) => {
    if (!layer) return;
    layer.getCanvas().setPixelRatio(2);
    const frame = requestAnimationFrame(() => {
      layer.draw();
      onReport(index, placement, layout, "ready");
    });
    return () => cancelAnimationFrame(frame);
  }, [index, layout, placement, onReport]);

  const quadrants = getPitchQuadrants(layout);
  const viewport = pitchViewport(quadrants);
  const rotation = landscapePitchRotation(viewport, layout.pitchRotation ?? 0);
  const { width, height, viewLayer } = fillPitchArea(viewport, rotation, size);
  return <div className="td-drawing" ref={host} role="img" aria-label={title}>
    {assets?.layout === layout && width > 0 && height > 0 &&
      <Stage width={width} height={height} listening={false}>
        <Layer {...viewLayer} listening={false} ref={onLayer}>
          <PitchScene surface={layout.surface} background={layout.background} image={assets.background} monochrome={monochrome} />
          {layout.objects.filter((object) => isInPitchQuadrants(object, quadrants)).map((object) =>
            <Group key={object.id} x={object.x} y={object.y} rotation={pitchObjectRotation(object.kind, object.rotation, rotation)}>
              <ObjectVisual object={object} icons={assets.icons} monochrome={monochrome} />
            </Group>)}
        </Layer>
      </Stage>}
  </div>;
});
