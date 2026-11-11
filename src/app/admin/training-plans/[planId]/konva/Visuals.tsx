import { memo } from "react";
import {
  Circle,
  Ellipse,
  Group,
  Image as KonvaImage,
  Line,
  Rect,
  Shape,
  Text,
} from "react-konva";
import { FOOTBALL } from "@/lib/exercise/football";
import {
  HEIGHT,
  WIDTH,
  createObject,
  type Exercise,
  type ExerciseObject,
  type ExerciseTool,
} from "@/lib/exercise/model";
import {
  arrowheadPoints,
  movementPoints,
  offsetPolyline,
} from "@/lib/exercise/geometry";

// The original PNG has a transparent 15px margin on every side.
const BALL_ICON_CROP = { x: 15, y: 15, width: 170, height: 170 };

export const PITCH_ICON_FILES = {
  ball: "football-ball-5681732.png",
  goal: "football-goal-2451562.png",
  flag: "football-flag-6452452.png",
  ring: "football-hoop-3437627.png",
  barrier: "football-barrier-1540543.png",
  cone: "football-cone-1505455.png",
  ladder: "football-ladder-4212592.png",
  hurdle: "football-hurdle-11798797.png",
  marker: "football-marker-17228453.png",
};
export type PitchIcons = Partial<
  Record<keyof typeof PITCH_ICON_FILES, HTMLImageElement>
>;

const TINTED_ICON_CROPS = {
  goal: { x: 12, y: 50, width: 178, height: 98 },
  flag: { x: 47, y: 19, width: 106, height: 161 },
  ring: { x: 3, y: 3, width: 194, height: 194 },
  artwork: { x: 0, y: 0, width: 512, height: 512 },
};
// The fabric, shaft, and base in the cropped flag artwork.
const FLAG_FILL_REGIONS = [
  [[34, 22], [70, 30], [70, 41], [104, 55], [60, 73], [60, 63], [34, 69]],
  [[27, 15], [34, 15], [34, 147], [27, 147]],
  [[30, 146], [40, 148], [47, 151], [53, 155], [59, 159], [2, 159], [8, 154], [15, 150], [22, 148]],
] as const;
const FLAG_FILL_CLIPS = FLAG_FILL_REGIONS.map((region) =>
  `polygon(${region.map(([x, y]) =>
    `${(x / TINTED_ICON_CROPS.flag.width) * 100}% ${(y / TINTED_ICON_CROPS.flag.height) * 100}%`,
  ).join(", ")})`,
);
const iconTints = new WeakMap<
  HTMLImageElement,
  { color: string; context: CanvasRenderingContext2D }
>();

function tintedIcon(
  image: HTMLImageElement,
  color: string,
  crop: keyof typeof TINTED_ICON_CROPS,
) {
  const tint = iconTints.get(image);
  if (tint?.color === color) return tint.context.canvas;
  const { x, y, width, height } = TINTED_ICON_CROPS[crop];
  // Each icon shares one small tint canvas across its placed instances.
  const context =
    tint?.context ?? document.createElement("canvas").getContext("2d");
  if (!context) return null;
  if (!tint) {
    context.canvas.width = width;
    context.canvas.height = height;
  }
  context.clearRect(0, 0, width, height);
  context.drawImage(image, x, y, width, height, 0, 0, width, height);
  context.globalCompositeOperation = crop === "artwork" ? "color" : "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, width, height);
  if (crop === "artwork") {
    // Restore transparency after recoloring while keeping the original linework.
    context.globalCompositeOperation = "destination-in";
    context.drawImage(image, 0, 0);
  }
  if (crop === "flag") {
    context.globalCompositeOperation = "destination-over";
    context.beginPath();
    for (const region of FLAG_FILL_REGIONS) {
      const [[firstX, firstY], ...points] = region;
      context.moveTo(firstX, firstY);
      for (const [x, y] of points) context.lineTo(x, y);
      context.closePath();
    }
    context.fill();
  }
  context.globalCompositeOperation = "source-over";
  iconTints.set(image, { color, context });
  return context.canvas;
}

function EquipmentIcon({
  image,
  color,
  name,
  width,
  height,
}: {
  image: HTMLImageElement;
  color: string;
  name: keyof typeof TINTED_ICON_CROPS;
  width: number;
  height: number;
}) {
  return (
    <Shape
      x={-width / 2}
      y={-height / 2}
      width={width}
      height={height}
      listening={false}
      sceneFunc={(context) => {
        const tinted = tintedIcon(image, color, name);
        if (tinted) context.drawImage(tinted, 0, 0, width, height);
      }}
    />
  );
}

function Mannequin({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  return (
    <Group>
      <Circle
        y={-height * 0.36}
        radius={width * 0.21}
        fill={color}
        stroke="#17261e"
        strokeWidth={1.5}
      />
      <Line
        points={[
          -width * 0.15, -height * 0.19, -width * 0.47, -height * 0.1,
          -width * 0.31, height * 0.21, width * 0.31, height * 0.21,
          width * 0.47, -height * 0.1, width * 0.15, -height * 0.19,
        ]}
        closed
        fill={color}
        stroke="#17261e"
        strokeWidth={1.5}
        lineJoin="round"
      />
      <Line
        points={[0, height * 0.21, 0, height * 0.44]}
        stroke={color}
        strokeWidth={2.5}
      />
      <Line
        points={[-width * 0.32, height * 0.44, width * 0.32, height * 0.44]}
        stroke={color}
        strokeWidth={3}
        lineCap="round"
      />
    </Group>
  );
}

type IconCrop = { x: number; y: number; width: number; height: number };
type CroppedIcon = { name: keyof PitchIcons; crop: IconCrop };
const COLOR_ICONS: Partial<Record<ExerciseTool, CroppedIcon>> = {
  mannequin: { name: "barrier", crop: { x: 0, y: 5, width: 173, height: 503 } },
  wall: { name: "barrier", crop: { x: 0, y: 5, width: 512, height: 503 } },
  cone: { name: "cone", crop: TINTED_ICON_CROPS.artwork },
  ladder: { name: "ladder", crop: { x: 156, y: 0, width: 200, height: 512 } },
  hurdle: { name: "hurdle", crop: { x: 151, y: 16, width: 210, height: 94 } },
  marker: { name: "marker", crop: { x: 10, y: 97, width: 492, height: 318 } },
};
const GOAL_PREVIEW_SCALE =
  34 / createObject("goal-full", { x: 0, y: 0 }, "preview").width;

export function EquipmentPreview({ type }: { type: ExerciseTool }) {
  if (type === "pole")
    return <span className="ke-equipment-preview ke-equipment-preview--pole" aria-hidden="true" />;

  const ball = type === "ball" || type === "balls";
  const tintedName = type.startsWith("goal")
    ? "goal"
    : type === "flag" || type === "ring" ? type : null;
  const icon: CroppedIcon | undefined = ball
    ? { name: "ball", crop: BALL_ICON_CROP }
    : tintedName
      ? { name: tintedName, crop: TINTED_ICON_CROPS[tintedName] }
      : COLOR_ICONS[type];
  if (!icon) return null;

  const { x, y, width, height } = icon.crop;
  const availableWidth = type === "balls" ? 16 : 34;
  const scale = Math.min(availableWidth / width, 24 / height);
  const goal = tintedName === "goal"
    ? createObject(type, { x: 0, y: 0 }, "preview")
    : null;
  const previewWidth = goal ? goal.width * GOAL_PREVIEW_SCALE : width * scale;
  const previewHeight = goal ? goal.height * GOAL_PREVIEW_SCALE : height * scale;
  const sourceSize = ball || tintedName ? 200 : 512;
  const scaleX = previewWidth / width;
  const scaleY = previewHeight / height;
  const artwork = `url("/icons/${PITCH_ICON_FILES[icon.name]}") ${-x * scaleX}px ${-y * scaleY}px / ${sourceSize * scaleX}px ${sourceSize * scaleY}px no-repeat`;

  if (ball)
    return (
      <span className="ke-equipment-preview" aria-hidden="true">
        <span className="ke-ball-previews">
          {(type === "balls" ? [0, 1] : [0]).map((index) => (
            <span
              key={index}
              style={{
                width: previewWidth,
                height: previewHeight,
                background: `#fff ${artwork}`,
              }}
            />
          ))}
        </span>
      </span>
    );

  return (
    <span className="ke-equipment-preview" aria-hidden="true">
      {type === "flag" && FLAG_FILL_CLIPS.map((clipPath) => (
        <span
          key={clipPath}
          style={{
            width: width * scale,
            height: height * scale,
            backgroundColor: "#f59e0b",
            clipPath,
          }}
        />
      ))}
      <span
        style={{
          width: previewWidth,
          height: previewHeight,
          ...(tintedName
            ? {
                backgroundColor: tintedName === "goal" ? "#ffffff" : "#f59e0b",
                mask: artwork,
              }
            : { background: artwork }),
        }}
      />
    </span>
  );
}

function ColorEquipmentIcon({
  image,
  object,
  crop,
}: {
  image: HTMLImageElement;
  object: ExerciseObject;
  crop: IconCrop;
}) {
  const scale = Math.min(object.width / crop.width, object.height / crop.height);
  const width = crop.width * scale;
  const height = crop.height * scale;
  if (object.color === "#f59e0b")
    return (
      <KonvaImage
        image={image}
        crop={crop}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        listening={false}
      />
    );
  return (
    <Shape
      x={-width / 2}
      y={-height / 2}
      width={width}
      height={height}
      listening={false}
      sceneFunc={(context) => {
        const tinted = tintedIcon(image, object.color, "artwork") ?? image;
        context.drawImage(
          tinted,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          width,
          height,
        );
      }}
    />
  );
}

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
  icons,
}: {
  object: ExerciseObject;
  hitWidth?: number;
  showArrowhead?: boolean;
  icons: PitchIcons;
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
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          if (o.shape === "circle")
            ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          else if (o.shape === "triangle") {
            ctx.moveTo(w / 2, 0);
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();
          } else ctx.rect(0, 0, w, h);
          ctx.fillStrokeShape(shape);
          if (o.hatched) {
            ctx.save();
            ctx.clip();
            ctx.beginPath();
            for (let x = -h; x <= w; x += 12) {
              ctx.moveTo(x, h);
              ctx.lineTo(x + h, 0);
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
  const isMarker = type.startsWith("marker");
  const colorIcon = COLOR_ICONS[isMarker ? "marker" : type];
  const colorImage = colorIcon && icons[colorIcon.name];
  if (colorIcon && colorImage)
    return <ColorEquipmentIcon image={colorImage} object={o} crop={colorIcon.crop} />;
  const iconName = type.startsWith("goal")
    ? "goal"
    : type === "flag" || type === "ring" ? type : null;
  const image = iconName && icons[iconName];
  if (iconName && image)
    return (
      <EquipmentIcon
        image={image}
        name={iconName}
        color={c}
        width={w}
        height={h}
      />
    );
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
            <Ellipse
              radiusX={w / 2}
              radiusY={h / 2}
              fill={c}
              stroke="#17261e"
              strokeWidth={1.5}
            />
            {icons.ball ? (
              <KonvaImage
                image={icons.ball}
                crop={BALL_ICON_CROP}
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                listening={false}
              />
            ) : (
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
            )}
          </Group>
        ))}
      </Group>
    );
  if (type === "ring")
    return (
      <Ellipse
        radiusX={w / 2}
        radiusY={h / 2}
        stroke={c}
        strokeWidth={4}
      />
    );
  if (isMarker)
    return (
      <Group>
        <Line
          points={[
            -w * 0.2, -h * 0.33, w * 0.2, -h * 0.33,
            w * 0.48, h * 0.19, w * 0.29, h * 0.44,
            -w * 0.29, h * 0.44, -w * 0.48, h * 0.19,
          ]}
          closed
          fill={c}
          stroke="#17261e"
          strokeWidth={1.5}
          lineJoin="round"
        />
        <Ellipse
          y={-h * 0.33}
          radiusX={w * 0.2}
          radiusY={h * 0.14}
          fill="#17261e"
          stroke={c}
          strokeWidth={1.5}
        />
      </Group>
    );
  if (type === "ladder")
    return (
      <Group>
        <Line
          points={[-w / 2, -h / 2, -w / 2, h / 2]}
          stroke={c}
          strokeWidth={4}
          lineCap="round"
        />
        <Line
          points={[w / 2, -h / 2, w / 2, h / 2]}
          stroke={c}
          strokeWidth={4}
          lineCap="round"
        />
        {Array.from({ length: 7 }, (_, i) => (
          <Line
            key={i}
            points={[-w / 2, -h / 2 + (i * h) / 6, w / 2, -h / 2 + (i * h) / 6]}
            stroke={c}
            strokeWidth={3}
          />
        ))}
      </Group>
    );
  if (type === "hurdle")
    return (
      <Group>
        <Line
          points={[
            -w * 0.39, h * 0.32, -w * 0.39, -h * 0.39,
            w * 0.39, -h * 0.39, w * 0.39, h * 0.32,
          ]}
          stroke={c}
          strokeWidth={4}
          lineJoin="round"
        />
        {[-1, 1].map((side) => (
          <Line
            key={side}
            points={[side * w * 0.27, h * 0.39, side * w * 0.48, h * 0.39]}
            stroke={c}
            strokeWidth={3}
            lineCap="round"
          />
        ))}
      </Group>
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
  if (type === "mannequin") return <Mannequin width={w} height={h} color={c} />;
  if (type === "wall")
    return (
      <Group>
        {[-1, 0, 1].map((position) => (
          <Group key={position} x={(position * w) / 3}>
            <Mannequin width={w * 0.3} height={h} color={c} />
          </Group>
        ))}
      </Group>
    );
  return (
    <Group>
      <Line
        points={[
          -w * 0.12, -h * 0.44, w * 0.12, -h * 0.44,
          w * 0.39, h * 0.29, -w * 0.39, h * 0.29,
        ]}
        closed
        fill={c}
        stroke="#1e2920"
        strokeWidth={1.5}
        lineJoin="round"
      />
      <Ellipse
        y={h * 0.33}
        radiusX={w / 2}
        radiusY={h * 0.12}
        fill={c}
        stroke="#1e2920"
        strokeWidth={1.5}
      />
    </Group>
  );
});
