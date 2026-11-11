export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getNormalizedDrawPoint(surface: SVGSVGElement, clientX: number, clientY: number) {
  const rect = surface.getBoundingClientRect();
  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp((clientY - rect.top) / rect.height, 0, 1),
  };
}

export function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  const scaled = points.map((point) => ({ x: point.x * 100, y: point.y * 100 }));
  if (scaled.length < 2) return "";
  let path = `M ${scaled[0].x} ${scaled[0].y}`;
  for (let index = 1; index < scaled.length; index += 1) {
    const previous = scaled[index - 1];
    const current = scaled[index];
    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;
    path += ` Q ${previous.x} ${previous.y}, ${midX} ${midY}`;
  }
  const last = scaled[scaled.length - 1];
  path += ` T ${last.x} ${last.y}`;
  return path;
}

export function buildArrowHeadPath(previous: { x: number; y: number }, current: { x: number; y: number }) {
  const x1 = previous.x * 100;
  const y1 = previous.y * 100;
  const x2 = current.x * 100;
  const y2 = current.y * 100;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return "";

  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const size = 2.8;
  const width = 1.8;
  const baseX = x2 - ux * size;
  const baseY = y2 - uy * size;
  const leftX = baseX + px * width;
  const leftY = baseY + py * width;
  const rightX = baseX - px * width;
  const rightY = baseY - py * width;

  return `M ${x2} ${y2} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`;
}
