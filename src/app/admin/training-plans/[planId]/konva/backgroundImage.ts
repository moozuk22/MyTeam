import { getPitchQuadrants, MAX_BACKGROUND_IMAGE_LENGTH, type Exercise, type ExerciseBackground, type PitchRotation } from "@/lib/exercise/model";
import { validateImageFile } from "@/lib/uploadImage";
import { pitchView, pitchViewport } from "./pitchView";

export const BACKGROUND_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function readBackgroundImage(file: File) {
  const error = validateImageFile(file);
  if (error) throw new Error(error);
  if (!BACKGROUND_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Изберете изображение във формат JPG, PNG или WebP.");
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("Изображението не може да бъде отворено.");
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Изображението не може да бъде обработено.");
    for (const maxSide of [1400, 1000, 700, 450]) {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const src = canvas.toDataURL("image/jpeg", 0.84);
      if (src.startsWith("data:image/jpeg;base64,") && src.length <= MAX_BACKGROUND_IMAGE_LENGTH) {
        return { src, width: canvas.width, height: canvas.height };
      }
    }
    throw new Error("Изображението е твърде голямо за плана. Изберете по-малък файл.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function placeBackgroundImage(
  image: Awaited<ReturnType<typeof readBackgroundImage>>,
  exercise: Exercise,
): ExerciseBackground {
  const viewport = pitchViewport(getPitchQuadrants(exercise));
  const rotation = exercise.pitchRotation ?? 0;
  const { viewWidth, viewHeight } = pitchView(viewport, rotation, 1);
  const scale = Math.min(viewWidth / image.width, viewHeight / image.height);
  return {
    src: image.src,
    x: viewport.x + viewport.width / 2,
    y: viewport.y + viewport.height / 2,
    width: Math.min(viewWidth, image.width * scale),
    height: Math.min(viewHeight, image.height * scale),
    rotation: ((360 - rotation) % 360) as PitchRotation,
  };
}
