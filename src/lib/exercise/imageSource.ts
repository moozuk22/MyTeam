import { TRAINING_UUID_PATTERN } from "@/lib/trainingPlans";

export const INLINE_IMAGE_PREFIX = "data:image/jpeg;base64,";

export function trainingImageSource(clubId: string, imageId: string) {
  return `/api/admin/clubs/${clubId}/training-plans/images/${imageId}`;
}

export function readTrainingImageSource(source: string) {
  const match = /^\/api\/admin\/clubs\/([^/]+)\/training-plans\/images\/([^/]+)$/.exec(source);
  return match && TRAINING_UUID_PATTERN.test(match[1]) && TRAINING_UUID_PATTERN.test(match[2])
    ? { clubId: match[1], imageId: match[2] } : null;
}
