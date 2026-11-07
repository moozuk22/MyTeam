import { MESSAGE_IMAGE_ERROR, validateMessageImage } from "@/lib/messageImage";

/** Accept legacy JSON messages as well as messages with an optional file. */
export async function readNotificationMessage(request: Request): Promise<{ body: unknown; image: File | null }> {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return { body: await request.json(), image: null };
  }
  const form = await request.formData();
  const body: unknown = JSON.parse(String(form.get("payload") ?? "{}"));
  const image = form.get("image");
  if (image !== null && (!(image instanceof File) || !validateMessageImage(image))) {
    throw new Error(MESSAGE_IMAGE_ERROR);
  }
  return { body, image };
}
