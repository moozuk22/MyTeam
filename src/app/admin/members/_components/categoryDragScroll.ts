/** Pixels per second, increasing through a 56px edge zone. */
export function categoryDragScrollSpeed(y: number, top: number, bottom: number) {
  const edge = Math.min(56,(bottom - top) / 3);
  if (edge <= 0) return 0;
  if (y < top + edge) return -600 * Math.min(1,(top + edge - y) / edge);
  if (y > bottom - edge) return 600 * Math.min(1,(y - bottom + edge) / edge);
  return 0;
}
