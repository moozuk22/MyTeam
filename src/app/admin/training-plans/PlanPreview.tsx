"use client";

import { useEffect, useRef, useState } from "react";
import { Group, Layer, Stage } from "react-konva";
import { getPitchQuadrants, isInPitchQuadrants, type Exercise } from "@/lib/exercise/model";
import { ObjectVisual, Pitch, usePitchIcons } from "./[planId]/konva/Visuals";
import { fitPitchPreview, pitchViewport } from "./[planId]/konva/pitchView";

export default function PlanPreview({ exercise }: { exercise: Exercise }) {
  const icons = usePitchIcons();
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([{ contentRect: { width, height } }]) =>
      setSize({ width, height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const quadrants = getPitchQuadrants(exercise);
  const rotation = exercise.pitchRotation ?? 0;
  const { width, height, viewLayer } = fitPitchPreview(pitchViewport(quadrants), rotation, size);

  return (
    <div className="tp-preview-canvas" ref={host}>
      {width > 0 && height > 0 ? (
        <Stage width={width} height={height} listening={false}>
          <Layer {...viewLayer} listening={false}>
            <Pitch surface={exercise.surface} />
            {exercise.objects.filter((object) => isInPitchQuadrants(object, quadrants)).map((object) => (
              <Group key={object.id} x={object.x} y={object.y}
                rotation={object.kind === "movement" || object.kind === "zone" ? object.rotation : object.rotation - rotation}>
                <ObjectVisual object={object} icons={icons} />
              </Group>
            ))}
          </Layer>
        </Stage>
      ) : (
        <div className="tp-preview-skeleton" role="status" aria-label="Зареждане" aria-busy="true" />
      )}
    </div>
  );
}
