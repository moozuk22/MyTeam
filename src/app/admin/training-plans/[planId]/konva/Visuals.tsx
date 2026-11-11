import { memo } from "react";
import { Circle, Ellipse, Group, Line, Rect, Shape, Text } from "react-konva";
import { FOOTBALL } from "@/lib/exercise/football";
import {
  HEIGHT,
  WIDTH,
  type Exercise,
  type ExerciseObject,
} from "@/lib/exercise/model";
import {
  arrowheadPoints,
  movementPoints,
  offsetPolyline,
} from "@/lib/exercise/geometry";

export const Pitch = memo(function Pitch({
  surface,
}: {
  surface: Exercise["surface"];
}) {
  return (
    <Group listening={false}>
      <Rect
        width={WIDTH}
        height={HEIGHT}
        fill={surface === "blank" ? "#203c30" : "#275f3d"}
      />
      {surface !== "blank" && (
        <>
          {Array.from({ length: 10 }, (_, i) => (
            <Rect
              key={i}
              x={i * 105}
              y={0}
              width={105}
              height={HEIGHT}
              fill={i % 2 ? "#ffffff" : "#000000"}
              opacity={0.035}
            />
          ))}
          <Rect
            x={25}
            y={25}
            width={1000}
            height={650}
            stroke="#d9e5d7"
            strokeWidth={2}
          />
          {surface === "full" ? (
            <>
              <Line
                points={[525, 25, 525, 675]}
                stroke="#d9e5d7"
                strokeWidth={2}
              />
              <Circle
                x={525}
                y={350}
                radius={85}
                stroke="#d9e5d7"
                strokeWidth={2}
              />
              <Circle x={525} y={350} radius={3} fill="#d9e5d7" />
              {[false, true].map((right) => (
                <Group
                  key={String(right)}
                  x={right ? 1050 : 0}
                  scaleX={right ? -1 : 1}
                >
                  <Rect
                    x={25}
                    y={175}
                    width={155}
                    height={350}
                    stroke="#d9e5d7"
                    strokeWidth={2}
                  />
                  <Rect
                    x={25}
                    y={270}
                    width={55}
                    height={160}
                    stroke="#d9e5d7"
                    strokeWidth={2}
                  />
                  <Circle x={135} y={350} radius={3} fill="#d9e5d7" />
                  <Line
                    points={[185, 280, 205, 310, 212, 350, 205, 390, 185, 420]}
                    tension={0.5}
                    stroke="#d9e5d7"
                    strokeWidth={2}
                  />
                  <Rect
                    x={10}
                    y={315}
                    width={15}
                    height={70}
                    stroke="#d9e5d7"
                    strokeWidth={2}
                  />
                </Group>
              ))}
            </>
          ) : (
            <>
              <Rect
                x={285}
                y={25}
                width={480}
                height={220}
                stroke="#d9e5d7"
                strokeWidth={2}
              />
              <Rect
                x={415}
                y={25}
                width={220}
                height={75}
                stroke="#d9e5d7"
                strokeWidth={2}
              />
              <Circle x={525} y={185} radius={3} fill="#d9e5d7" />
              <Line
                points={[420, 248, 470, 280, 525, 290, 580, 280, 630, 248]}
                tension={0.5}
                stroke="#d9e5d7"
                strokeWidth={2}
              />
              <Rect
                x={475}
                y={10}
                width={100}
                height={15}
                stroke="#d9e5d7"
                strokeWidth={2}
              />
              <Line
                points={[410, 675, 430, 610, 525, 570, 620, 610, 640, 675]}
                tension={0.5}
                stroke="#d9e5d7"
                strokeWidth={2}
              />
            </>
          )}
        </>
      )}
    </Group>
  );
});

export const ObjectVisual = memo(function ObjectVisual({
  object: o,
  hitWidth = 24,
  showArrowhead = true,
}: {
  object: ExerciseObject;
  hitWidth?: number;
  showArrowhead?: boolean;
}) {
  const w = o.width,
    h = o.height,
    c = o.color;
  if (o.kind === "movement") {
    const points = movementPoints(o),
      style = FOOTBALL.actions[o.action!];
    const tension = o.path === "freehand" ? 0.25 : 0;
    return (
      <Group>
        <Line
          points={o.action === "shot" ? offsetPolyline(points, 3) : points}
          stroke={c}
          strokeWidth={3}
          dash={style.dash}
          tension={tension}
          hitStrokeWidth={hitWidth}
          lineCap="round"
          lineJoin="round"
        />
        {o.action === "shot" && (
          <Line
            points={offsetPolyline(points, -3)}
            stroke={c}
            strokeWidth={3}
            listening={false}
            tension={tension}
          />
        )}
        {style.arrow && showArrowhead && (
          <Line
            points={arrowheadPoints(points, tension)}
            stroke={c}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </Group>
    );
  }
  if (o.kind === "player")
    return (
      <Group>
        <Circle
          radius={w / 2}
          scaleY={h / w}
          fill={c}
          stroke="#ffffff"
          strokeWidth={2}
        />
        <Text
          text={o.label || "1"}
          x={-w / 2}
          y={-h / 2 + h * 0.17}
          width={w}
          height={h * 0.66}
          fontSize={h * 0.55}
          align="center"
          fill="#ffffff"
          fontStyle="bold"
        />
      </Group>
    );
  if (o.kind === "text")
    return (
      <Text
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        text={o.label}
        fontSize={h * 0.7}
        fill={c}
        align="center"
      />
    );
  if (o.kind === "zone")
    return (
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          if (o.shape === "circle")
            ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
          else if (o.shape === "triangle") {
            ctx.moveTo(0, -h / 2);
            ctx.lineTo(w / 2, h / 2);
            ctx.lineTo(-w / 2, h / 2);
            ctx.closePath();
          } else ctx.rect(-w / 2, -h / 2, w, h);
          ctx.fillStrokeShape(shape);
          if (o.hatched) {
            ctx.save();
            ctx.clip();
            ctx.beginPath();
            for (let x = -w / 2 - h; x <= w / 2; x += 12) {
              ctx.moveTo(x, h / 2);
              ctx.lineTo(x + h, -h / 2);
            }
            ctx.strokeStyle = c;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
          }
        }}
        fill={o.hatched ? `${c}20` : `${c}08`}
        stroke={c}
        strokeWidth={2}
      />
    );
  const type = o.equipment!;
  if (type.startsWith("goal"))
    return (
      <Group>
        <Rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          stroke={c}
          strokeWidth={3}
        />
        {[0.25, 0.5, 0.75].map((n) => (
          <Line
            key={n}
            points={[-w / 2 + w * n, -h / 2, -w / 2 + w * n, h / 2]}
            stroke={c}
            strokeWidth={1}
          />
        ))}
        <Line points={[-w / 2, 0, w / 2, 0]} stroke={c} strokeWidth={1} />
      </Group>
    );
  if (type === "ball" || type === "balls")
    return (
      <Group>
        {(type === "balls" ? [-0.5, 0.5] : [0]).map((n, i) => (
          <Group key={i} x={n * w}>
            <Circle
              radius={w / 2}
              fill={c}
              stroke="#17261e"
              strokeWidth={1.5}
            />
            <Line
              points={[
                0,
                -h * 0.2,
                w * 0.2,
                0,
                w * 0.1,
                h * 0.2,
                -w * 0.1,
                h * 0.2,
                -w * 0.2,
                0,
              ]}
              closed
              fill="#17261e"
            />
          </Group>
        ))}
      </Group>
    );
  if (type === "ring" || type.startsWith("marker"))
    return (
      <Ellipse
        radiusX={w / 2}
        radiusY={h / 2}
        fill={type === "ring" ? undefined : c}
        stroke={type === "ring" ? c : "#171d19"}
        strokeWidth={type === "ring" ? 4 : 1.5}
      />
    );
  if (type === "ladder")
    return (
      <Group>
        <Line
          points={[-w / 2, -h / 2, -w / 2, h / 2]}
          stroke={c}
          strokeWidth={3}
        />
        <Line
          points={[w / 2, -h / 2, w / 2, h / 2]}
          stroke={c}
          strokeWidth={3}
        />
        {Array.from({ length: 7 }, (_, i) => (
          <Line
            key={i}
            points={[-w / 2, -h / 2 + (i * h) / 6, w / 2, -h / 2 + (i * h) / 6]}
            stroke={c}
            strokeWidth={2}
          />
        ))}
      </Group>
    );
  if (type === "hurdle")
    return (
      <Line
        points={[-w / 2, h / 2, -w / 2, -h / 2, w / 2, -h / 2, w / 2, h / 2]}
        stroke={c}
        strokeWidth={5}
      />
    );
  if (type === "pole" || type === "flag")
    return (
      <Group>
        <Line points={[0, h / 2, 0, -h / 2]} stroke={c} strokeWidth={4} />
        {type === "flag" && (
          <Line points={[0, -h / 2, w, -h / 3, 0, 0]} closed fill={c} />
        )}
      </Group>
    );
  if (type === "mannequin")
    return (
      <Group>
        <Circle y={-h * 0.35} radius={w * 0.25} stroke={c} strokeWidth={3} />
        <Rect
          x={-w / 2}
          y={-h * 0.15}
          width={w}
          height={h * 0.5}
          cornerRadius={5}
          stroke={c}
          strokeWidth={3}
        />
        <Line
          points={[
            -w * 0.25,
            h * 0.35,
            -w * 0.25,
            h / 2,
            w * 0.25,
            h / 2,
            w * 0.25,
            h * 0.35,
          ]}
          stroke={c}
          strokeWidth={3}
        />
      </Group>
    );
  return (
    <Group>
      <Line
        points={[0, -h / 2, w * 0.4, h * 0.35, -w * 0.4, h * 0.35]}
        closed
        fill={c}
        stroke="#1e2920"
        strokeWidth={1.5}
      />
      <Ellipse
        y={h * 0.35}
        radiusX={w / 2}
        radiusY={h * 0.12}
        fill={c}
        stroke="#1e2920"
        strokeWidth={1.5}
      />
    </Group>
  );
});
