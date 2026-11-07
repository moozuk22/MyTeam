export const MESSAGE_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const MESSAGE_IMAGE_ERROR = "Изберете JPG, PNG или WebP снимка до 9 MB.";
export function validateMessageImage(file: Pick<File, "type" | "size">): boolean {
  return MESSAGE_IMAGE_ACCEPT.split(",").includes(file.type) && file.size > 0 && file.size <= 9 * 1024 * 1024;
}
