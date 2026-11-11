type Vector3 = number[];

const PHI = (1 + Math.sqrt(5)) / 2;

function normalise(v: Vector3) {
  const m = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  return [v[0] / m, v[1] / m, v[2] / m];
}

const ICO_V = [
  [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
  [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
  [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1]
].map(normalise);

const ICO_EDGE_LEN_SQ = (() => {
  let minD = Infinity;
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      const d =
        (ICO_V[i][0] - ICO_V[j][0]) ** 2 +
        (ICO_V[i][1] - ICO_V[j][1]) ** 2 +
        (ICO_V[i][2] - ICO_V[j][2]) ** 2;
      if (d < minD) minD = d;
    }
  }
  return minD * 1.05;
})();

const ICO_EDGES = [];

for (let i = 0; i < 12; i++) {
  for (let j = i + 1; j < 12; j++) {
    const d =
      (ICO_V[i][0] - ICO_V[j][0]) ** 2 +
      (ICO_V[i][1] - ICO_V[j][1]) ** 2 +
      (ICO_V[i][2] - ICO_V[j][2]) ** 2;
    if (d < ICO_EDGE_LEN_SQ) ICO_EDGES.push([i, j]);
  }
}

const ICO_FACES = [];

for (let i = 0; i < 12; i++) {
  for (let j = i + 1; j < 12; j++) {
    for (let k = j + 1; k < 12; k++) {
      const ij = ICO_EDGES.some(e => (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i));
      const jk = ICO_EDGES.some(e => (e[0] === j && e[1] === k) || (e[0] === k && e[1] === j));
      const ki = ICO_EDGES.some(e => (e[0] === k && e[1] === i) || (e[0] === i && e[1] === k));
      if (ij && jk && ki) ICO_FACES.push([i, j, k]);
    }
  }
}

const FOOTBALL = (() => {
  const edgePts: Record<string, [number, number]> = {};
  const verts: Vector3[] = [];

  ICO_EDGES.forEach(([i, j]) => {
    const vi = ICO_V[i], vj = ICO_V[j];
    const p1 = normalise([(2 * vi[0] + vj[0]) / 3, (2 * vi[1] + vj[1]) / 3, (2 * vi[2] + vj[2]) / 3]);
    const p2 = normalise([(vi[0] + 2 * vj[0]) / 3, (vi[1] + 2 * vj[1]) / 3, (vi[2] + 2 * vj[2]) / 3]);
    const idx1 = verts.length; verts.push(p1);
    const idx2 = verts.length; verts.push(p2);
    edgePts[`${i}-${j}`] = [idx1, idx2];
    edgePts[`${j}-${i}`] = [idx2, idx1];
  });

  const faces = [];

  for (let v = 0; v < 12; v++) {
    const adjacent = ICO_EDGES
      .filter(e => e[0] === v || e[1] === v)
      .map(e => {
        const other = e[0] === v ? e[1] : e[0];
        return { other, ptIdx: edgePts[`${v}-${other}`][0] };
      });

    const normal = ICO_V[v];
    const arb = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const dot = (a: Vector3, b: Vector3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a: Vector3, b: Vector3) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const tang1 = normalise(arb.map((x, i) => x - dot(arb, normal) * normal[i]));
    const tang2 = cross(normal, tang1);

    adjacent.sort((a, b) => {
      const pa = verts[a.ptIdx], pb = verts[b.ptIdx];
      const angleA = Math.atan2(dot(pa, tang2), dot(pa, tang1));
      const angleB = Math.atan2(dot(pb, tang2), dot(pb, tang1));
      return angleA - angleB;
    });

    faces.push({ type: "pentagon", indices: adjacent.map(a => a.ptIdx) });
  }

  ICO_FACES.forEach(([i, j, k]) => {
    const p_ij_i = edgePts[`${i}-${j}`][0];
    const p_ij_j = edgePts[`${i}-${j}`][1];
    const p_jk_j = edgePts[`${j}-${k}`][0];
    const p_jk_k = edgePts[`${j}-${k}`][1];
    const p_ki_k = edgePts[`${k}-${i}`][0];
    const p_ki_i = edgePts[`${k}-${i}`][1];
    faces.push({ type: "hexagon", indices: [p_ij_i, p_ki_i, p_ki_k, p_jk_k, p_jk_j, p_ij_j] });
  });

  return { verts, faces };
})();

function rotVec(v: Vector3, rx: number, ry: number) {
  const [x, y, z] = v;
  const x1 = x * Math.cos(ry) + z * Math.sin(ry);
  const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
  return [x1, y2, z2];
}

function drawSimpleBall(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.save();
  ctx.translate(cx, cy);

  const g = ctx.createRadialGradient(
    -radius * 0.25, -radius * 0.3, radius * 0.05,
    0, 0, radius
  );
  g.addColorStop(0, "rgba(255,255,255,0.98)");
  g.addColorStop(0.22, "rgba(244,244,244,0.98)");
  g.addColorStop(0.72, "rgba(190,190,190,0.96)");
  g.addColorStop(1, "rgba(88,88,88,0.96)");

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = "rgba(20,20,20,0.32)";
  ctx.lineWidth = Math.max(1, radius * 0.1);
  ctx.stroke();

  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "rgba(0,0,8,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.9, radius * 0.95, radius * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawFootball(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, rollAngle: number, travelAngle: number, globalRx: number, globalRy: number) {
  if (radius <= 6.5) {
    drawSimpleBall(ctx, cx, cy, radius);
    return;
  }

  const cosRoll = Math.cos(rollAngle), sinRoll = Math.sin(rollAngle);
  const cosTrav = Math.cos(travelAngle), sinTrav = Math.sin(travelAngle);

  const rotated = FOOTBALL.verts.map(v => {
    const [x, y, z] = v;

    const ax = -sinTrav, ay = 0, az = cosTrav;
    const dotV = x * ax + y * ay + z * az;
    const cx2 = ay * z - az * y;
    const cy2 = az * x - ax * z;
    const cz2 = ax * y - ay * x;

    const rx2 = x * cosRoll + cx2 * sinRoll + ax * dotV * (1 - cosRoll);
    const ry2 = y * cosRoll + cy2 * sinRoll + ay * dotV * (1 - cosRoll);
    const rz2 = z * cosRoll + cz2 * sinRoll + az * dotV * (1 - cosRoll);

    return rotVec([rx2, ry2, rz2], globalRx, globalRy);
  });

  const facesWithDepth = FOOTBALL.faces.map(face => {
    const pts2d = face.indices.map(idx => ({
      x: rotated[idx][0] * radius,
      y: -rotated[idx][1] * radius,
      z: rotated[idx][2]
    }));

    const centZ = pts2d.reduce((s, p) => s + p.z, 0) / pts2d.length;
    const ccx = pts2d.reduce((s, p) => s + p.x, 0) / pts2d.length;
    const ccy = pts2d.reduce((s, p) => s + p.y, 0) / pts2d.length;
    const sorted = [...pts2d].sort((a, b) =>
      Math.atan2(a.y - ccy, a.x - ccx) - Math.atan2(b.y - ccy, b.x - ccx)
    );

    return { type: face.type, pts: sorted, centZ };
  });

  facesWithDepth.sort((a, b) => a.centZ - b.centZ);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();

  for (const face of facesWithDepth) {
    if (face.centZ < -0.15) continue;
    const { pts, centZ, type } = face;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();

    const lightFactor = Math.max(0, (centZ + 1) / 2);
    const shade = 0.45 + lightFactor * 0.55;

    if (type === "pentagon") {
      const v = Math.round(18 * shade);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(80,80,80,${0.3 + lightFactor * 0.4})`;
      ctx.lineWidth = radius * 0.025;
      ctx.stroke();
    } else {
      const v = Math.round(215 * shade + 25);
      ctx.fillStyle = `rgb(${v},${v},${Math.round(v * 0.97)})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(30,30,30,${0.4 + lightFactor * 0.3})`;
      ctx.lineWidth = radius * 0.02;
      ctx.stroke();
    }
  }

  const hl = ctx.createRadialGradient(
    -radius * 0.28, -radius * 0.32, radius * 0.02,
    -radius * 0.1, -radius * 0.1, radius * 0.85
  );
  hl.addColorStop(0, "rgba(255,255,255,0.55)");
  hl.addColorStop(0.18, "rgba(255,255,255,0.18)");
  hl.addColorStop(0.5, "rgba(255,255,255,0.04)");
  hl.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = hl;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "rgba(0,0,8,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.88, radius * 1.05, radius * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
