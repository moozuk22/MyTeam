import { memo, useEffect, useState } from "react";
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
  textFontSize,
  type Exercise,
  type ExerciseObject,
  type ExerciseTool,
} from "@/lib/exercise/model";
import {
  arrowheadPoints,
  movementPoints,
  shotShafts,
} from "@/lib/exercise/geometry";

// The original PNG has a transparent 15px margin on every side.
const BALL_ICON_CROP = { x: 15, y: 15, width: 170, height: 170 };

const GOAL_ICON_FILES: Record<string, string> = {
  "goal-small": "goal-front-compact.svg",
  "goal-full": "goal-front.svg",
  "goal-7m": "goal-front-large.svg",
  "goal-5m": "goal-front-wide.svg",
  "goal-3m": "goal-front-compact.svg",
  "goal-1m": "goal-front-green.svg",
};

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

let pitchIconsPromise: Promise<PitchIcons> | undefined;

export function loadPitchIcons() {
  pitchIconsPromise ??= Promise.all(Object.entries(PITCH_ICON_FILES).map(([name, filename]) =>
    new Promise<readonly [string, HTMLImageElement | undefined]>((resolve) => {
      const image = new window.Image();
      image.onload = () => resolve([name, image]);
      image.onerror = () => resolve([name, undefined]);
      image.src = `/icons/${filename}`;
    }),
  )).then((entries) => {
    if (entries.some(([, image]) => !image)) pitchIconsPromise = undefined;
    return Object.fromEntries(entries);
  });
  return pitchIconsPromise;
}

function goalIconUrl(type: ExerciseTool) {
  return GOAL_ICON_FILES[type] ? `/icons/${GOAL_ICON_FILES[type]}` : `/icons/${PITCH_ICON_FILES.goal}`;
}

function useGoalIcon(type: ExerciseTool) {
  const [image, setImage] = useState<HTMLImageElement>();
  useEffect(() => {
    const next = new window.Image();
    next.onload = () => setImage(next);
    next.src = goalIconUrl(type);
  }, [type]);
  return image;
}

export function usePitchIcons() {
  const [icons, setIcons] = useState<PitchIcons>({});
  useEffect(() => {
    let mounted = true;
    void loadPitchIcons().then((loaded) => {
      if (mounted) setIcons(loaded);
    });
    return () => { mounted = false; };
  }, []);
  return icons;
}

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
  const goalImage = useGoalIcon(type);
  if (type === "pole")
    return <span className="ke-equipment-preview ke-equipment-preview--pole" aria-hidden="true" />;

  const ball = type === "ball" || type === "balls";
  const isGoal = type.startsWith("goal");
  const tintedName = isGoal
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
  if (isGoal && goalImage) return <img src={goalIconUrl(type)} alt="" style={{ width: previewWidth, height: previewHeight, objectFit: "fill" }} />;
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
  color,
  crop,
}: {
  image: HTMLImageElement;
  object: ExerciseObject;
  color: string;
  crop: IconCrop;
}) {
  const scale = Math.min(object.width / crop.width, object.height / crop.height);
  const width = crop.width * scale;
  const height = crop.height * scale;
  if (color === "#f59e0b")
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
        const tinted = tintedIcon(image, color, "artwork") ?? image;
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

function PitchArc({
  x,
  y,
  radius,
  rotation = 0,
  chordDistance = 0,
  ink,
  lineWidth,
}: {
  x: number;
  y: number;
  radius: number;
  rotation?: number;
  chordDistance?: number;
  ink: string;
  lineWidth: number;
}) {
  const halfAngle = Math.acos(chordDistance / radius);
  return (
    <Shape
      x={x}
      y={y}
      rotation={rotation}
      stroke={ink}
      strokeWidth={lineWidth}
      sceneFunc={(context, shape) => {
        context.beginPath();
        context.arc(0, 0, radius, -halfAngle, halfAngle);
        context.strokeShape(shape);
      }}
    />
  );
}

export function PitchBackground({ surface, background }: Pick<Exercise, "surface" | "background">) {
  const src = background?.src;
  const [loaded, setLoaded] = useState<HTMLImageElement>();
  useEffect(() => {
    if (!src) return;
    const image = new window.Image();
    image.onload = () => setLoaded(image);
    image.src = src;
    return () => { image.onload = null; };
  }, [src]);

  return <PitchScene surface={surface} background={background} image={loaded?.src === src ? loaded : undefined} />;
}

export function PitchScene({
  surface, background, image, monochrome = false,
}: Pick<Exercise, "surface" | "background"> & { image?: CanvasImageSource; monochrome?: boolean }) {
  if (!background) return <Pitch surface={surface} monochrome={monochrome} />;

  return (
    <>
      <Rect width={WIDTH} height={HEIGHT} fill={monochrome ? "#ffffff" : "#16221e"} />
      {image && (
        <KonvaImage image={image} x={background.x} y={background.y}
          width={background.width} height={background.height}
          offsetX={background.width / 2} offsetY={background.height / 2}
          rotation={background.rotation} />
      )}
    </>
  );
}

export const Pitch = memo(function Pitch({
  surface, monochrome = false,
}: {
  surface: Exercise["surface"];
  monochrome?: boolean;
}) {
  const ink = monochrome ? "#202020" : "#d9e5d7";
  const lineWidth = monochrome ? 3.5 : 2;
  const turf = surface === "blank" ? "#203c30" : "#175226";
  return (
    <Group listening={false}>
      <Rect
        width={WIDTH}
        height={HEIGHT}
        fill={monochrome ? "#ffffff" : turf}
      />
      {surface !== "blank" && (
        <>
          {!monochrome && Array.from({ length: 10 }, (_, i) => (
            <Rect
              key={i}
              x={i * 105}
              y={0}
              width={105}
              height={HEIGHT}
              fill={i % 2 ? "#5aba55" : "#031d0d"}
              opacity={0.12}
            />
          ))}
          <Rect
            x={25}
            y={25}
            width={1000}
            height={650}
            stroke={ink}
            strokeWidth={lineWidth}
          />
          {surface === "full" ? (
            <>
              <Line
                points={[525, 25, 525, 675]}
                stroke={ink}
                strokeWidth={lineWidth}
              />
              <Circle
                x={525}
                y={350}
                radius={85}
                stroke={ink}
                strokeWidth={lineWidth}
              />
              <Circle x={525} y={350} radius={3} fill={ink} />
              {[25, 1025].flatMap((x) => [25, 675].map((y) => (
                <Shape
                  key={`${x}-${y}`}
                  x={x}
                  y={y}
                  scaleX={x === 25 ? 1 : -1}
                  scaleY={y === 25 ? 1 : -1}
                  stroke={ink}
                  strokeWidth={lineWidth}
                  sceneFunc={(context, shape) => {
                    context.beginPath();
                    context.arc(0, 0, 12, 0, Math.PI / 2);
                    context.strokeShape(shape);
                  }}
                />
              )))}
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
                    stroke={ink}
                    strokeWidth={lineWidth}
                  />
                  <Rect
                    x={25}
                    y={270}
                    width={55}
                    height={160}
                    stroke={ink}
                    strokeWidth={lineWidth}
                  />
                  <Circle x={135} y={350} radius={3} fill={ink} />
                  <PitchArc ink={ink} lineWidth={lineWidth} x={135} y={350} radius={77} chordDistance={45} />
                  <Rect
                    x={10}
                    y={315}
                    width={15}
                    height={70}
                    stroke={ink}
                    strokeWidth={lineWidth}
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
                stroke={ink}
                strokeWidth={lineWidth}
              />
              <Rect
                x={415}
                y={25}
                width={220}
                height={75}
                stroke={ink}
                strokeWidth={lineWidth}
              />
              <Circle x={525} y={185} radius={3} fill={ink} />
              <PitchArc ink={ink} lineWidth={lineWidth} x={525} y={185} radius={105} rotation={90} chordDistance={60} />
              <Rect
                x={475}
                y={10}
                width={100}
                height={15}
                stroke={ink}
                strokeWidth={lineWidth}
              />
              <PitchArc ink={ink} lineWidth={lineWidth} x={525} y={675} radius={105} rotation={-90} />
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
  monochrome = false,
}: {
  object: ExerciseObject;
  hitWidth?: number;
  showArrowhead?: boolean;
  icons: PitchIcons;
  monochrome?: boolean;
}) {
  const w = o.width,
    h = o.height,
    c = monochrome ? "#202020" : o.color;
  const goalImage = useGoalIcon(o.equipment ?? "goal-full");
  if (o.kind === "movement") {
    const points = movementPoints(o),
      style = FOOTBALL.actions[o.action!];
    const tension = o.path === "freehand" ? 0.25 : 0;
    const head = (style.arrow || o.arrowhead) && showArrowhead ? arrowheadPoints(points, tension) : [];
    const shafts = o.action === "shot" ? shotShafts(points, head) : [points];
    return (
      <Group>
        {shafts.map((shaft, index) => (
          <Line
            key={index}
            points={shaft}
            stroke={c}
            strokeWidth={monochrome ? 4 : 3}
            dash={style.dash}
            tension={tension}
            hitStrokeWidth={hitWidth}
            listening={index === 0}
            lineCap="round"
            lineJoin="round"
          />
        ))}
        {head.length > 0 && (
          <Line
            points={head}
            stroke={c}
            strokeWidth={monochrome ? 4 : 3}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </Group>
    );
  }
  if (o.kind === "player") {
    const label = o.label || "1";
    const printedLabel = monochrome && o.team ? `${o.team}·${label}` : label;
    return (
      <Group>
        <Circle
          radius={w / 2}
          scaleY={h / w}
          fill={monochrome ? "#ffffff" : c}
          stroke={monochrome ? c : "#ffffff"}
          strokeWidth={monochrome ? 4 : 2}
        />
        <Text
          text={printedLabel}
          x={-w / 2}
          y={-h / 2 + h * 0.17}
          width={w}
          height={h * 0.66}
          fontSize={monochrome ? Math.min(h * 0.55, w / (printedLabel.length * 0.58)) : h * 0.55}
          align="center"
          fill={monochrome ? c : "#ffffff"}
          fontStyle="bold"
        />
      </Group>
    );
  }
  if (o.kind === "text")
    return (
      <Text
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        text={o.label}
        fontSize={textFontSize(o)}
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
  if (type.startsWith("goal") && goalImage)
    return <KonvaImage image={goalImage} x={-w / 2} y={-h / 2} width={w} height={h} listening={false} />;
  const isMarker = type.startsWith("marker");
  const colorIcon = COLOR_ICONS[isMarker ? "marker" : type];
  const colorImage = colorIcon && icons[colorIcon.name];
  if (colorIcon && colorImage)
    return <ColorEquipmentIcon image={colorImage} object={o} color={c} crop={colorIcon.crop} />;
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
