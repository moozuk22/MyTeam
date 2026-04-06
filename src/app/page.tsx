// @ts-nocheck
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import "./page.css";
import {
  Fingerprint, LayoutGrid, BadgePercent, CreditCard,
  Users, ShieldCheck, X, ChevronRight, Play,
  Zap, Trophy, ArrowRight,
  Phone, Mail, MessageSquare, User,
  Wifi, WifiOff, Menu, Calendar,
  MapPin, TrendingUp, Activity, Globe, Lock
} from "lucide-react";

/* ── TOKENS ── */
const G = "#39FF14";
const B = "#00D4FF";
const BG = "#070C14";
const CARD = "#0D1520";

const CLUBS = [
  { id: 1, name: "Real Madrid", color: "#FFFFFF", abbr: "RM", x: 820, z: 0, mobileX: 0, mobileZ: -800, athletes: 168, months: 24, fees: 97, city: "Madrid", sport: "Football" },
  { id: 2, name: "Manchester City", color: "#6CABDD", abbr: "MC", x: 580, z: -320, mobileX: -380, mobileZ: -550, athletes: 122, months: 18, fees: 94, city: "Manchester", sport: "Football" },
  { id: 3, name: "Liverpool FC", color: "#C8102E", abbr: "LFC", x: 580, z: 0, mobileX: 380, mobileZ: -550, athletes: 134, months: 16, fees: 93, city: "Liverpool", sport: "Football" },
  { id: 5, name: "Manchester Utd", color: "#DA291C", abbr: "MUFC", x: 320, z: -350, mobileX: 180, mobileZ: -250, athletes: 141, months: 22, fees: 91, city: "Manchester", sport: "Football" },
  { id: 6, name: "Chelsea FC", color: "#034694", abbr: "CFC", x: 320, z: 0, mobileX: -180, mobileZ: -250, athletes: 119, months: 14, fees: 92, city: "London", sport: "Football" },
  { id: 8, name: "B. Dortmund", color: "#FDE100", abbr: "BVB", x: 100, z: 0, mobileX: -180, mobileZ: 250, athletes: 111, months: 13, fees: 94, city: "Dortmund", sport: "Football" },
  { id: 16, name: "AC Milan", color: "#FB090B", abbr: "ACM", x: -100, z: 0, mobileX: 180, mobileZ: 250, athletes: 127, months: 19, fees: 95, city: "Milan", sport: "Football" },
  { id: 13, name: "Juventus", color: "#FFFFFF", abbr: "JUV", x: -320, z: -350, mobileX: 380, mobileZ: 550, athletes: 118, months: 16, fees: 91, city: "Turin", sport: "Football" },
  { id: 9, name: "FC Barcelona", color: "#A70042", abbr: "FCB", x: -820, z: 0, mobileX: 0, mobileZ: 800, athletes: 172, months: 25, fees: 96, city: "Barcelona", sport: "Football" },
  { id: 10, name: "Bayern Munich", color: "#DC052D", abbr: "FCBM", x: -580, z: -320, mobileX: -380, mobileZ: 550, athletes: 145, months: 20, fees: 97, city: "Munich", sport: "Football" },

  // HIDDEN ON MOBILE
  { id: 4, name: "Arsenal FC", color: "#EF0107", abbr: "ARS", x: 580, z: 320, showMobile: false, athletes: 116, months: 15, fees: 95, city: "London", sport: "Football" },
  { id: 7, name: "Tottenham", color: "#FFFFFF", abbr: "TOT", x: 320, z: 350, showMobile: false, athletes: 103, months: 12, fees: 90, city: "London", sport: "Football" },
  { id: 11, name: "Paris SG", color: "#004170", abbr: "PSG", x: -580, z: 0, showMobile: false, athletes: 125, months: 17, fees: 93, city: "Paris", sport: "Football" },
  { id: 12, name: "Atletico Madrid", color: "#CB3524", abbr: "ATM", x: -580, z: 320, showMobile: false, athletes: 109, months: 15, fees: 92, city: "Madrid", sport: "Football" },
  { id: 14, name: "Inter Milan", color: "#0068A8", abbr: "INT", x: -320, z: 0, showMobile: false, athletes: 121, months: 15, fees: 94, city: "Milan", sport: "Football" },
  { id: 15, name: "Napoli", color: "#003E7E", abbr: "NAP", x: -320, z: 350, showMobile: false, athletes: 99, months: 11, fees: 89, city: "Naples", sport: "Football" }
];

const FEATURES = [
  {
    id: 1, icon: Fingerprint, color: G,
    title: "Турникет Достъп",
    short: "Автоматичен контрол на влизането чрез QR код или чип.",
    details: "Интегрирана система за контрол на достъпа, която позволява влизане само на активни членове с платени вноски.",
    benefits: ["Автоматична верификация на членството", "Намаляване на грешките при ръчна проверка", "Real-time статистика за посещаемостта", "Блокиране на достъп при неизплатени вноски"],
    requiresSub: true
  },
  {
    id: 2, icon: ShieldCheck, color: B,
    title: "Дисциплинарен Панел",
    short: "Пълна история на нарушенията и наказанията.",
    details: "Уникална функционалност за проследяване на поведението и спазването на клубните правила.",
    benefits: ["Дигитален архив на нарушенията", "Автоматично уведомяване на треньори и родители", "Проследяване на рецидиви", "BFS Compliance за спортни федерации"],
    requiresSub: false
  },
  {
    id: 3, icon: BadgePercent, color: G,
    title: "Партньорска Мрежа",
    short: "Ексклузивни отстъпки за родители и атлети.",
    details: "Възползвайте се от специални цени при нашите партньори като Sport Depot и Sport Vision.",
    benefits: ["10-20% отстъпка в спортни магазини", "Лоялностна програма за родители", "Индивидуални оферти според спорта", "Дигитална карта за отстъпки"],
    requiresSub: true
  },
  {
    id: 4, icon: CreditCard, color: B,
    title: "Умно Плащане",
    short: "Автоматизация на месечните членски такси.",
    details: "Елиминирайте ръчното събиране на пари. Системата автоматично издава фактури и напомня за плащания.",
    benefits: ["70% по-малко просрочени вноски", "Автоматични напомняния по имейл и Push", "Пълна финансова прозрачност", "Интеграция с банкови системи"],
    requiresSub: true
  },
  {
    id: 5, icon: Users, color: G,
    title: "Squad Intelligence",
    short: "Управление на състави, тренировки и мачове.",
    details: "Всичко необходимо за треньора на едно място. Планиране на тренировъчния процес и тактически бележки.",
    benefits: ["Централизирана база данни за играчи", "Присъствени листове с един клик", "Календар на събитията и мачовете", "Директна комуникация с отбора"],
    requiresSub: false
  },
  {
    id: 6, icon: LayoutGrid, color: B,
    title: "Клубно Табло",
    short: "Цялостен поглед върху здравето на клуба.",
    details: "Изпълнителен дашборд с ключови показатели за представянето на всяка възрастова група.",
    benefits: ["Визуализация на данните в реално време", "Сравнителен анализ на групите", "Експорт на отчети за ръководството", "Бърз достъп до критична информация"],
    requiresSub: false
  }
];

const PARTNERS = [
  { name: "Sport Depot", abbr: "SD", color: "#FF6B00" },
  { name: "Sport Vision", abbr: "SV", color: "#0066CC" },
];

/* ══════════════════════════════════════════════
   FOOTBALL GEOMETRY — Truncated Icosahedron
══════════════════════════════════════════════ */
const PHI = (1 + Math.sqrt(5)) / 2;

function normalise(v) {
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
  const edgePts = {};
  const verts = [];

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
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
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

/* ── Rotation helpers ── */
function rotVec(v, rx, ry) {
  let [x, y, z] = v;
  const x1 = x * Math.cos(ry) + z * Math.sin(ry);
  const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
  return [x1, y2, z2];
}

/* ── Draw simplified football for small sizes ── */
function drawSimpleBall(ctx, cx, cy, radius) {
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

/* ── Detailed football ── */
function drawFootball(ctx, cx, cy, radius, rollAngle, travelAngle, globalRx, globalRy) {
  if (radius <= 6.5) {
    drawSimpleBall(ctx, cx, cy, radius);
    return;
  }

  const cosRoll = Math.cos(rollAngle), sinRoll = Math.sin(rollAngle);
  const cosTrav = Math.cos(travelAngle), sinTrav = Math.sin(travelAngle);

  const rotated = FOOTBALL.verts.map(v => {
    let [x, y, z] = v;

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

/* ── COMPONENTS ── */

function StadiumCanvas({ selectedId, onSelect, scrollProgress, zoomValRef, zoomProgressRef }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  const stRef = useRef({
    rotX: -90,
    rotY: 0,
    targetRotX: -90,
    targetRotY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    autoRot: false,
    frame: 0,
    zoom: 1,
    targetZoom: 1,
    particles: [],
    conns: [],
    ballConnIndexes: [],
    clubScreenPos: {},
    localZoom: 0,
    loadedLogos: {},
    isMobile: false
  });

  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  useEffect(() => {
    const s = stRef.current;
    const isMobile = window.innerWidth < 768;

    s.particles = Array.from({ length: isMobile ? 18 : 28 }, () => ({
      x: (Math.random() - 0.5) * 1600,
      y: 0,
      z: (Math.random() - 0.5) * 1200,
      r: Math.random() * 1.2 + 0.4,
      opacity: Math.random() * 0.22 + 0.08
    }));

    const conns = [];
    for (let i = 0; i < CLUBS.length; i++) {
      for (let j = i + 1; j < CLUBS.length; j++) {
        if (isMobile && (CLUBS[i].showMobile === false || CLUBS[j].showMobile === false)) continue;

        const ix = isMobile ? (CLUBS[i].mobileX ?? CLUBS[i].x) : CLUBS[i].x;
        const iz = isMobile ? (CLUBS[i].mobileZ ?? CLUBS[i].z) : CLUBS[i].z;
        const jx = isMobile ? (CLUBS[j].mobileX ?? CLUBS[j].x) : CLUBS[j].x;
        const jz = isMobile ? (CLUBS[j].mobileZ ?? CLUBS[j].z) : CLUBS[j].z;

        const d = Math.hypot(ix - jx, iz - jz);
        if (d < 450) {
          conns.push({
            i,
            j,
            d,
            phase: Math.random(),
            speed: 0.003 + Math.random() * 0.01
          });
        }
      }
    }

    s.conns = conns;
    const maxBalls = isMobile ? 5 : 9;
    const indexes = conns.map((_, idx) => idx);

    for (let i = indexes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
    }

    s.ballConnIndexes = indexes.slice(0, maxBalls);

    // Preload logos
    CLUBS.forEach(c => {
      const img = new Image();
      img.src = `/logos/${c.id}.svg`;
      img.onload = () => {
        s.loadedLogos[c.id] = img;
      };
    });
  }, []);

  function proj(x, y, z, rX, rY, zoom, cx, cy) {
    const isMobile = stRef.current.isMobile;
    const sc = zoom * (isMobile ? 0.28 : 0.44);
    return { sx: cx + x * sc, sy: cy + z * sc, sc, z2: z };
  }

  function drawPitchLines(ctx, s, cx, cy) {
    const isMobile = s.isMobile;
    const len = isMobile ? 550 : 900;
    const wid = isMobile ? 900 : 550;

    const drawLine = (x1, z1, x2, z2) => {
      const p1 = proj(x1, 0, z1, s.rotX, s.rotY, s.zoom, cx, cy);
      const p2 = proj(x2, 0, z2, s.rotX, s.rotY, s.zoom, cx, cy);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.stroke();
    };

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1.5;

    const pTL = proj(-len, 0, -wid, s.rotX, s.rotY, s.zoom, cx, cy);
    const pBR = proj(len, 0, wid, s.rotX, s.rotY, s.zoom, cx, cy);
    const grd = ctx.createLinearGradient(pTL.sx, pTL.sy, pBR.sx, pBR.sy);
    grd.addColorStop(0, "rgba(57, 255, 20, 0.05)");
    grd.addColorStop(0.5, "rgba(57, 255, 20, 0.02)");
    grd.addColorStop(1, "rgba(57, 255, 20, 0.05)");
    ctx.fillStyle = grd;
    ctx.fillRect(pTL.sx, pTL.sy, pBR.sx - pTL.sx, pBR.sy - pTL.sy);

    ctx.strokeStyle = "rgba(57, 255, 20, 0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(pTL.sx, pTL.sy, pBR.sx - pTL.sx, pBR.sy - pTL.sy);

    if (isMobile) {
      drawLine(-len, 0, len, 0);
    } else {
      drawLine(0, -wid, 0, wid);
    }

    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const ang = (i / 32) * Math.PI * 2;
      const p = proj(Math.cos(ang) * 110, 0, Math.sin(ang) * 110, s.rotX, s.rotY, s.zoom, cx, cy);
      if (i === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.stroke();

    const drawGoalArea = (sign) => {
      if (isMobile) {
        const gw = 140, gh = 280;
        drawLine(-gh, sign * wid, -gh, sign * (wid - gw));
        drawLine(-gh, sign * (wid - gw), gh, sign * (wid - gw));
        drawLine(gh, sign * (wid - gw), gh, sign * wid);

        const sW = 50, sH = 120;
        drawLine(-sH, sign * wid, -sH, sign * (wid - sW));
        drawLine(-sH, sign * (wid - sW), sH, sign * (wid - sW));
        drawLine(sH, sign * (wid - sW), sH, sign * wid);

        ctx.beginPath();
        for (let i = -60; i <= 60; i++) {
          const ang = (i / 180) * Math.PI;
          const pz = sign * (wid - 150) + Math.cos(ang) * 90 * sign;
          const px = Math.sin(ang) * 90;
          const p = proj(px, 0, pz, s.rotX, s.rotY, s.zoom, cx, cy);
          if (i === -60) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.stroke();
      } else {
        const gw = 140, gh = 280;
        drawLine(sign * len, -gh, sign * (len - gw), -gh);
        drawLine(sign * (len - gw), -gh, sign * (len - gw), gh);
        drawLine(sign * (len - gw), gh, sign * len, gh);

        const sW = 50, sH = 120;
        drawLine(sign * len, -sH, sign * (len - sW), -sH);
        drawLine(sign * (len - sW), -sH, sign * (len - sW), sH);
        drawLine(sign * (len - sW), sH, sign * len, sH);

        ctx.beginPath();
        for (let i = -60; i <= 60; i++) {
          const ang = (i / 180) * Math.PI;
          const px = sign * (len - 150) + Math.cos(ang) * 90 * sign;
          const pz = Math.sin(ang) * 90;
          const p = proj(px, 0, pz, s.rotX, s.rotY, s.zoom, cx, cy);
          if (i === -60) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.stroke();
      }
    };

    drawGoalArea(1);
    drawGoalArea(-1);
  }

  useEffect(() => {
    stRef.current.targetZoom = 0.92;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stRef.current.isMobile = window.innerWidth <= 768;
    };

    resize();
    window.addEventListener("resize", resize);

    const onWheelInternal = (e) => {
      e.preventDefault();
      const s = stRef.current;
      s.localZoom -= e.deltaY * 0.0008;
      const minAllowedLocal = 0.92 - s.targetZoom;
      s.localZoom = Math.max(minAllowedLocal, Math.min(1.8, s.localZoom));
    };

    canvas.addEventListener("wheel", onWheelInternal, { passive: false });

    function draw() {
      const s = stRef.current;
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (W === 0 || H === 0) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const cx = W / 2;
      const cy = H / 2;

      s.frame++;
      s.rotX += (s.targetRotX - s.rotX) * 0.05;
      s.rotY += (s.targetRotY - s.rotY) * 0.05;
      const zoomBase = s.targetZoom + s.localZoom;
      s.zoom += (zoomBase - s.zoom) * 0.1;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#070C14";
      ctx.fillRect(0, 0, W, H);

      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H));
      grd.addColorStop(0, "rgba(20, 80, 40, 0.45)");
      grd.addColorStop(0.7, "rgba(10, 18, 30, 0.95)");
      grd.addColorStop(1, "rgba(7, 12, 20, 1)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      drawPitchLines(ctx, s, cx, cy);

      for (const p of s.particles) {
        const pr = proj(p.x, p.y, p.z, s.rotX, s.rotY, s.zoom, cx, cy);
        ctx.fillStyle = G;
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(pr.sx, pr.sy, p.r * Math.max(0.2, pr.sc), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (let idx = 0; idx < s.conns.length; idx++) {
        const conn = s.conns[idx];
        const a = CLUBS[conn.i];
        const b = CLUBS[conn.j];

        if (s.isMobile && (a.showMobile === false || b.showMobile === false)) continue;

        const ax = s.isMobile ? (a.mobileX ?? a.x) : a.x;
        const az = s.isMobile ? (a.mobileZ ?? a.z) : a.z;
        const bx = s.isMobile ? (b.mobileX ?? b.x) : b.x;
        const bz = s.isMobile ? (b.mobileZ ?? b.z) : b.z;

        const pa = proj(ax, a.y || 0, az, s.rotX, s.rotY, s.zoom, cx, cy);
        const pb = proj(bx, b.y || 0, bz, s.rotX, s.rotY, s.zoom, cx, cy);

        const al = Math.max(0, 0.25 - conn.d / 4000);
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.strokeStyle = `rgba(57, 255, 20, ${al})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        if (s.ballConnIndexes.includes(idx)) {
          const t = (s.frame * conn.speed + conn.phase) % 1;
          const bx = pa.sx + (pb.sx - pa.sx) * t;
          const by = pa.sy + (pb.sy - pa.sy) * t;
          const bsc = (pa.sc + (pb.sc - pa.sc) * t) * 2;
          const bSize = Math.max(4, (s.isMobile ? 14 : 9.5) * bsc);
          const travelAngle = Math.atan2(pb.sy - pa.sy, pb.sx - pa.sx);
          const distFull = Math.hypot(pb.sx - pa.sx, pb.sy - pa.sy);
          const rollAngle = (t * distFull) / bSize;
          const globalRx = s.rotX * Math.PI / 180;
          const globalRy = s.rotY * Math.PI / 180;

          drawFootball(ctx, bx, by, bSize, rollAngle, travelAngle, globalRx, globalRy);
        }
      }

      const mapped = CLUBS.filter(c => !(s.isMobile && c.showMobile === false)).map(c => {
        const cxpos = s.isMobile ? (c.mobileX ?? c.x) : c.x;
        const czpos = s.isMobile ? (c.mobileZ ?? c.z) : c.z;
        return {
          ...c,
          pr: proj(cxpos, c.y || 0, czpos, s.rotX, s.rotY, s.zoom, cx, cy)
        };
      }).sort((a, b) => a.pr.z2 - b.pr.z2);

      s.clubScreenPos = {};

      for (const c of mapped) {
        const { pr } = c;
        const sel = selectedIdRef.current === c.id;
        const r = (s.isMobile ? 120 : 85) * pr.sc * (sel ? 1.2 : 1);

        ctx.save();
        ctx.translate(pr.sx, pr.sy);

        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
        glow.addColorStop(0, `${c.color}77`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2);
        ctx.fill();

        const logoImg = s.loadedLogos[c.id];

        ctx.beginPath();
        ctx.arc(0, 0, r / 2, 0, Math.PI * 2);

        if (logoImg) {
          ctx.save();
          ctx.fillStyle = c.color === "#FFFFFF" || c.color === "#FFF" ? "#f3f3f3" : c.color;
          ctx.fill();

          ctx.clip(); // Ensure logo stays within the boundary if it has messy edges

          const imgSize = r * 0.75;
          ctx.drawImage(logoImg, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
          ctx.restore();

          ctx.beginPath();
          ctx.arc(0, 0, r / 2, 0, Math.PI * 2);
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 3 * pr.sc;
          ctx.stroke();
        } else {
          ctx.fillStyle = c.color;
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 3 * pr.sc;
          ctx.stroke();

          ctx.fillStyle = (c.color.toLowerCase() === "#ffffff" || c.color.toLowerCase() === "#fff") ? "#000" : "#fff";
          ctx.font = `900 ${Math.max(14, 18 * pr.sc)}px 'Exo 2'`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(c.abbr, 0, 0);
        }

        ctx.restore();

        if (pr.sc > (s.isMobile ? 0.2 : 0.35)) {
          ctx.font = `800 ${Math.max(11, 15 * pr.sc)}px 'Exo 2', sans-serif`;
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.shadowColor = "black";
          ctx.shadowBlur = 6;
          ctx.fillText(c.name, pr.sx, pr.sy + r * 0.75 + 15);
          ctx.shadowBlur = 0;
        }

        s.clubScreenPos[c.id] = { x: pr.sx, y: pr.sy, r: r / 2 + 10 };
      }

      if (zoomValRef?.current) {
        const minZ = s.isMobile ? 1.0 : 0.92;
        const maxZ = 1.8;
        const relativeZoom = (s.zoom - minZ) / (maxZ - minZ);
        const displayPercent = Math.max(0, Math.round(relativeZoom * 100));
        zoomValRef.current.textContent = `${displayPercent}%`;
        if (zoomProgressRef?.current) {
          zoomProgressRef.current.style.height = `${Math.max(0, Math.min(100, relativeZoom * 100))}%`;
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("wheel", onWheelInternal);
      cancelAnimationFrame(animRef.current);
    };
  }, [zoomValRef, zoomProgressRef]);

  const hitTest = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const pos = stRef.current.clubScreenPos;

    for (const club of CLUBS) {
      const p = pos[club.id];
      if (!p) continue;
      if (Math.hypot(mx - p.x, my - p.y) < p.r + 10) return club;
    }
    return null;
  }, []);

  const onMouseMove = useCallback((e) => {
    const s = stRef.current;
    const hit = hitTest(e);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hit ? "pointer" : (s.dragging ? "grabbing" : "grab");
    }

    if (s.dragging) {
      s.targetRotY += (e.clientX - s.lastX) * 0.48;
      s.targetRotX += (e.clientY - s.lastY) * 0.32;
      s.targetRotX = Math.max(-65, Math.min(65, s.targetRotX));
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      s.autoRot = false;
    }
  }, [hitTest]);

  const onMouseDown = useCallback((e) => {
    const s = stRef.current;
    s.dragging = true;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.autoRot = false;
  }, []);

  const onMouseUp = useCallback(() => {
    stRef.current.dragging = false;
  }, []);

  const onClick = useCallback((e) => {
    const hit = hitTest(e);
    if (hit) onSelect(prev => prev?.id === hit.id ? null : hit);
  }, [hitTest, onSelect]);

  const touchRef = useRef({ lx: 0, ly: 0 });
  const onTouchStart = useCallback((e) => {
    stRef.current.autoRot = false;
    if (e.touches.length === 1) {
      touchRef.current.lx = e.touches[0].clientX;
      touchRef.current.ly = e.touches[0].clientY;
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    const s = stRef.current;
    if (e.touches.length === 1) {
      s.targetRotY += (e.touches[0].clientX - touchRef.current.lx) * 0.52;
      s.targetRotX += (e.touches[0].clientY - touchRef.current.ly) * 0.34;
      s.targetRotX = Math.max(-65, Math.min(65, s.targetRotX));
      touchRef.current.lx = e.touches[0].clientX;
      touchRef.current.ly = e.touches[0].clientY;
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="galaxy-canvas"
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => { stRef.current.dragging = false; }}
    />
  );
}

function HoloPanel({ club, onClose }) {
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVis(true), 20);
    return () => clearTimeout(t);
  }, []);

  const stats = [
    { icon: Users, label: "Athletes Count", value: club.athletes, unit: "", color: G },
    { icon: Activity, label: "Status", value: "Smart Access", unit: "Active", color: B },
    { icon: Calendar, label: "Member since", value: club.months, unit: "months", color: "#FFD700" },
    { icon: TrendingUp, label: "Collection Rate", value: `${club.fees}%`, unit: "", color: "#FF6B9D" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%,-50%) scale(${vis ? 1 : 0.72})`,
        opacity: vis ? 1 : 0,
        transition: "all .38s cubic-bezier(.16,1,.3,1)",
        zIndex: 20,
        width: "min(390px,92vw)",
        pointerEvents: "all"
      }}
    >
      <div
        style={{
          background: `linear-gradient(135deg,${club.color}1A,rgba(0,212,255,.07))`,
          border: `1px solid ${club.color}55`,
          borderRadius: 20,
          padding: "26px 26px 22px",
          backdropFilter: "blur(20px)",
          boxShadow: `0 0 70px ${club.color}22,0 40px 80px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.06)`,
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: `linear-gradient(90deg,transparent,${club.color}99,transparent)`,
            animation: "scanAcross 2s linear infinite"
          }}
        />
        {[["tl", "top", "left"], ["tr", "top", "right"], ["bl", "bottom", "left"], ["br", "bottom", "right"]].map(([k, tb, lr]) => (
          <div
            key={k}
            style={{
              position: "absolute",
              [tb]: 8,
              [lr]: 8,
              width: 14,
              height: 14,
              borderTop: tb === "top" ? `2px solid ${club.color}` : "none",
              borderBottom: tb === "bottom" ? `2px solid ${club.color}` : "none",
              borderLeft: lr === "left" ? `2px solid ${club.color}` : "none",
              borderRight: lr === "right" ? `2px solid ${club.color}` : "none"
            }}
          />
        ))}

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: `${club.color}20`,
                border: `2px solid ${club.color}55`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Exo 2',sans-serif",
                fontWeight: 900,
                fontSize: 18,
                color: club.color,
                boxShadow: `0 0 22px ${club.color}35`
              }}
            >
              {club.abbr}
            </div>
            <div>
              <div className="logo-brand">{club.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                <MapPin size={11} color="rgba(255,255,255,.4)" />
                <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 11, color: "rgba(255,255,255,.4)" }}>
                  {club.city} · {club.sport}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 8,
              padding: 7,
              cursor: "pointer",
              color: "rgba(255,255,255,.5)",
              display: "flex",
              transition: "all .2s"
            }}
            onMouseEnter={e => e.currentTarget.style.color = "#fff"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,.5)"}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,.03)",
                  border: "1px solid rgba(255,255,255,.07)",
                  borderRadius: 12,
                  padding: "13px 15px",
                  transform: vis ? "none" : "translateY(18px)",
                  opacity: vis ? 1 : 0,
                  transition: `all .38s cubic-bezier(.16,1,.3,1) ${i * .07}s`
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                  <Icon size={12} color={s.color} />
                  <span
                    style={{
                      fontFamily: "'Exo 2',sans-serif",
                      fontSize: 10,
                      color: "rgba(255,255,255,.35)",
                      textTransform: "uppercase",
                      letterSpacing: 1
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'Exo 2',sans-serif",
                    fontWeight: 900,
                    fontSize: 22,
                    color: s.color,
                    lineHeight: 1
                  }}
                >
                  {s.value}
                </div>
                {s.unit && (
                  <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 11, color: "rgba(255,255,255,.35)", marginTop: 2 }}>
                    {s.unit}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 13px",
            background: `${G}0B`,
            border: `1px solid ${G}22`,
            borderRadius: 10
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: G,
              boxShadow: `0 0 8px ${G}`,
              animation: "glowPulse 1.5s infinite"
            }}
          />
          <span style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 12, color: G, fontWeight: 600 }}>
            MyTeam OS — Онлайн и активен
          </span>
        </div>
      </div>
    </div>
  );
}

function TrustedNetwork({ contactRef }) {
  const sectionRef = useRef(null);
  const zoomValRef = useRef(null);
  const zoomProgressRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [scrollProg, setScrollProg] = useState(0);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    setIsMobileView(window.innerWidth <= 768);
    const handler = () => {
      setIsMobileView(window.innerWidth <= 768);
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const prog = Math.max(0, Math.min(1, 1 - rect.top / window.innerHeight));
      setScrollProg(prog);
    };
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler, { passive: true });
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, []);

  const scrollToContact = () => {
    contactRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section ref={sectionRef} id="Клубове" className="trusted-network-section">
      <div className="network-grid-bg" />
      <div className="network-fade-top" />
      <div className="network-fade-bottom" />

      <div className="network-header">
        <div className="network-tag">
          <Globe size={12} color={B} />
          <span className="network-tag-text">Trusted Network Map</span>
        </div>
        <h2 className="network-title">
          Клубовете, които <span className="hero-title-highlight">вече ни вярват</span>
        </h2>
        <p className="network-subtitle">Натиснете клуб за детайли · Влачете за завъртане · Скролирайте за zoom</p>
      </div>

      <div className="network-canvas-zone">
        <div className="network-canvas-wrapper">
          <StadiumCanvas
            selectedId={selected?.id}
            onSelect={setSelected}
            scrollProgress={scrollProg}
            zoomValRef={zoomValRef}
            zoomProgressRef={zoomProgressRef}
          />

          {selected && <HoloPanel club={selected} onClose={() => setSelected(null)} />}

          <div className="zoom-bar-container" style={{ right: "15px" }}>
            <span className="zoom-label">Zoom</span>
            <div className="zoom-track">
              <div ref={zoomProgressRef} className="zoom-progress" />
            </div>
            <span ref={zoomValRef} className="zoom-value">0%</span>
          </div>

          {["tl", "tr", "bl", "br"].map(k => (
            <div key={k} className={`hud-corner hud-${k}`} />
          ))}

          <div className="live-indicator">
            <div className="live-dot" />
            <span className="live-text">LIVE — {isMobileView ? "10" : "16"} КЛУБА ОНЛАЙН</span>
          </div>
        </div>

        <div className="club-chip-strip">
          {CLUBS.filter(c => !(isMobileView && c.showMobile === false)).map(c => (
            <button
              key={c.id}
              onClick={() => setSelected(prev => prev?.id === c.id ? null : c)}
              className={`club-chip ${selected?.id === c.id ? "chip-active" : ""}`}
              style={{ "--club-color": c.color }}
            >
              <div className="chip-dot" style={{ background: c.color }} />
              <span className="chip-name">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="cta-network-container">
        <div className="cta-network-card">
          <div className="placeholder-bubble-wrapper">
            <div className="placeholder-bubble">?</div>
            <div className="orbit-ring" />
          </div>

          <div className="cta-text-wrapper">
            <div className="cta-title">ВАШИЯТ КЛУБ ТУК?</div>
            <div className="cta-subtitle">Присъединете се към мрежата от водещи клубове</div>
          </div>

          <button onClick={scrollToContact} className="cta-btn">
            ЗАЯВЕТЕ СВОЕТО МЯСТО <ArrowRight size={16} />
          </button>

          <div className="network-stats-row">
            {[["8", "клуба"], ["1 850+", "атлети"], ["95%", "avg такси"]].map(([v, l]) => (
              <div key={l} className="network-stat-col">
                <div className="stat-v">{v}</div>
                <div className="stat-l">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function NavBar({ menuOpen, setMenuOpen }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? "navbar-scrolled" : ""}`}>
      <div className="navbar-container">
        <div className="navbar-logo">
          <div className="logo-icon">
            <Trophy size={20} color="#000" strokeWidth={2.5} />
          </div>
          <div className="logo-text-wrapper">
            <div className="logo-brand">My<span className="brand-accent">Team</span></div>
            <div className="logo-subtitle">by Moozuk22 OS</div>
          </div>
        </div>

        <div className="desk-nav">
          {["Функции", "Клубове", "Партньори", "Контакт"].map(item => (
            <a key={item} href={`#${item}`} className="nav-link">{item}</a>
          ))}
          <a href="#contact" className="nav-demo-btn">ДЕМО →</a>
        </div>

        <button onClick={() => setMenuOpen(!menuOpen)} className="mobile-toggle">
          <Menu size={24} />
        </button>
      </div>

      {menuOpen && (
        <div className="mobile-menu">
          {["Функции", "Клубове", "Партньори", "Контакт"].map(item => (
            <div key={item} className="mobile-menu-item">
              <a href={`#${item}`} onClick={() => setMenuOpen(false)} className="mobile-nav-link">{item}</a>
            </div>
          ))}
          <a href="#contact" className="mobile-demo-btn">ДЕМО ЗАЯВКА</a>
        </div>
      )}
    </nav>
  );
}

function VideoModal({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,.92)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn .3s ease"
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(860px,94vw)",
          background: CARD,
          border: `1px solid rgba(57,255,20,.2)`,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: `0 0 80px rgba(57,255,20,.15)`,
          animation: "slideUp .35s cubic-bezier(.16,1,.3,1)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px", borderBottom: `1px solid rgba(255,255,255,.06)` }}>
          <div style={{ fontFamily: "'Exo 2',sans-serif", fontWeight: 700, color: "#fff", fontSize: 16 }}>
            <span style={{ color: G }}>My</span>Team — Как работи
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer" }}>
            <X size={22} />
          </button>
        </div>

        <div
          style={{
            aspectRatio: "16/9",
            background: "linear-gradient(135deg,#0a1628,#0d2040)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            position: "relative",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.05,
              backgroundImage: `linear-gradient(${G} 1px,transparent 1px),linear-gradient(90deg,${G} 1px,transparent 1px)`,
              backgroundSize: "40px 40px"
            }}
          />
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              border: `2px solid ${G}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 40px rgba(57,255,20,.4)`,
              cursor: "pointer",
              animation: "slowPulse 2s infinite",
              background: "rgba(57,255,20,.08)",
              position: "relative",
              zIndex: 1
            }}
          >
            <Play size={28} color={G} fill={G} style={{ marginLeft: 4 }} />
          </div>
          <div style={{ fontFamily: "'Exo 2',sans-serif", color: "rgba(255,255,255,.4)", fontSize: 13, position: "relative", zIndex: 1 }}>
            Видео демонстрация — скоро
          </div>
        </div>

        <div style={{ padding: "20px 28px", display: "flex", justifyContent: "center" }}>
          <a
            href="#contact"
            onClick={onClose}
            style={{
              background: `linear-gradient(135deg,${G},#20C020)`,
              color: "#000",
              padding: "12px 32px",
              borderRadius: 8,
              fontFamily: "'Exo 2',sans-serif",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none"
            }}
          >
            ЗАЯВЕТЕ LIVE ДЕМО →
          </a>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ feature, active, onClick }) {
  const isSub = feature.requiresSub;
  const isLocked = isSub && !active;
  const Icon = feature.icon;

  return (
    <div
      className={`feature-card ${isLocked ? "card-locked" : ""}`}
      onClick={isLocked ? undefined : onClick}
      style={{ "--feat-color": feature.color }}
    >
      <div className="card-icon-wrapper">
        <Icon size={26} className="card-icon" />
      </div>

      <div className="card-content">
        <div className="card-title">{feature.title}</div>
        <p className="card-desc">{feature.short}</p>
        <div className="card-footer">
          {isSub && (
            <div className={`sub-tag-wrapper ${isLocked ? "tag-locked" : "tag-active"}`}>
              {isLocked ? <Lock size={12} /> : <Zap size={12} />}
              <span>{isLocked ? "С АБОНАМЕНТ" : "АБОНАМЕНТ"}</span>
            </div>
          )}
          <span className="card-learn-more">Научете повече →</span>
        </div>
      </div>

      {isLocked && <div className="card-lock-overlay" />}
    </div>
  );
}

function FeaturePopup({ feature, onClose }) {
  const Icon = feature.icon;
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={e => e.stopPropagation()} style={{ "--feat-color": feature.color }}>
        <button onClick={onClose} className="popup-close-btn"><X size={20} /></button>
        <div className="popup-header">
          <div className="popup-icon-wrapper"><Icon size={32} className="popup-icon" /></div>
          <div className="popup-title-group">
            <h2 className="popup-title">{feature.title}</h2>
            <div className="popup-tag">System Feature • Moozuk22</div>
          </div>
        </div>

        <div className="popup-body">
          <p className="popup-desc">{feature.details}</p>
          <div className="popup-benefits">
            {feature.benefits.map((b, i) => (
              <div key={i} className="benefit-item">
                <div className="benefit-dot" />
                <span className="benefit-text">{b}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onClose} className="popup-action-btn">РАЗБРАХ</button>
      </div>
    </div>
  );
}

function LeadForm() {
  const [form, setForm] = useState({ name: "", club: "", email: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    alert("Заявката е изпратена успешно!");
    setForm({ name: "", club: "", email: "", phone: "", message: "" });
  };

  const inp = (f) => ({
    className: `form-input ${focused === f ? "input-focused" : ""}`,
    onFocus: () => setFocused(f),
    onBlur: () => setFocused("")
  });

  return (
    <div className="lead-form-wrapper">
      <div className="form-grid">
        {[
          { id: "name", label: "Вашето Име", icon: User, ph: "Иван Иванов" },
          { id: "club", label: "Име на Клуба", icon: Trophy, ph: "ФК Левски / ТК Пловдив" },
          { id: "email", label: "Имейл Адрес", icon: Mail, ph: "ivan@example.com" },
          { id: "phone", label: "Телефон за контакт", icon: Phone, ph: "0888 000 000" }
        ].map(i => (
          <div key={i.id} className="form-group">
            <label className="form-label"><i.icon size={12} /> {i.label}</label>
            <input
              type="text"
              placeholder={i.ph}
              value={form[i.id]}
              onChange={e => setForm({ ...form, [i.id]: e.target.value })}
              {...inp(i.id)}
            />
          </div>
        ))}
      </div>

      <div className="form-group-textarea">
        <label className="form-label"><MessageSquare size={12} /> Как можем да помогнем?</label>
        <textarea
          placeholder="Разкажете ни за вашия клуб..."
          value={form.message}
          onChange={e => setForm({ ...form, message: e.target.value })}
          {...inp("message")}
          rows={4}
          style={{ resize: "vertical", minHeight: 100 }}
        />
      </div>

      <button onClick={handleSubmit} disabled={loading} className={`form-submit-btn ${loading ? "btn-loading" : ""}`}>
        {loading ? (
          <>
            <div className="loading-spinner" /> Изпращане...
          </>
        ) : (
          <>
            ИЗПРАТЕТЕ ЗАЯВКАТА <ArrowRight size={18} />
          </>
        )}
      </button>

      <div className="form-footer-note">🔒 Данните Ви са защитени. Без спам. Отговор в рамките на 24ч.</div>
    </div>
  );
}

export default function Home() {
  const [videoOpen, setVideoOpen] = useState(false);
  const [subActive, setSubActive] = useState(false);
  const [popup, setPopup] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [counters, setCounters] = useState({ clubs: 0, hours: 0, disc: 0 });
  const contactRef = useRef(null);

  useEffect(() => {
    const targets = { clubs: 240, hours: 3, disc: 70 };
    let step = 0;
    const t = setInterval(() => {
      step++;
      const e = 1 - Math.pow(1 - step / 60, 3);
      setCounters({
        clubs: Math.round(targets.clubs * e),
        hours: Math.round(targets.hours * e * 10) / 10,
        disc: Math.round(targets.disc * e)
      });
      if (step >= 60) clearInterval(t);
    }, 1800 / 60);

    return () => clearInterval(t);
  }, []);

  return (
    <>
      <NavBar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      {videoOpen && <VideoModal onClose={() => setVideoOpen(false)} />}
      {popup && <FeaturePopup feature={popup} onClose={() => setPopup(null)} />}

      <section className="hero-section">
        <div className="hero-grid-bg" />
        <div className="hero-glow-top" />
        <div className="hero-glow-bottom" />

        <div className="hero-content">
          <div className="hero-tag">
            <div className="tag-pulse" />
            <span className="tag-text">Powered by Moozuk22 OS</span>
          </div>

          <h1 className="hero-title">
            My Team: <span className="hero-title-highlight">Дигиталната нервна система</span><br />
            <span className="hero-title-sub"> на Вашия спортен клуб</span>
          </h1>

          <p className="hero-description">Автоматизиран контрол, финансова дисциплина и ексклузивни ползи за родителите.</p>

          <div className="hero-actions">
            <button onClick={() => setVideoOpen(true)} className="hero-btn-primary">
              <Play size={18} fill="#000" />
              ВИЖ КАК РАБОТИ
            </button>
            <a href="#contact" className="hero-btn-secondary">
              БЕЗПЛАТНА КОНСУЛТАЦИЯ <ChevronRight size={16} />
            </a>
          </div>

          <div className="stats-row hero-stats">
            {[
              { v: `${counters.clubs}+`, l: "Клуба вече използват системата", c: G },
              { v: `${counters.hours}ч/ден`, l: "Средно спестено административно време", c: B },
              { v: `${counters.disc}%`, l: "Намаление на просрочените вноски", c: G }
            ].map((s, i) => (
              <div key={i} className="hero-stat-item">
                <div style={{ color: s.c }} className="hero-stat-value">{s.v}</div>
                <div className="hero-stat-label">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="Функции" className="features-section">
        <div className="features-container">
          <div className="section-header">
            <div className="section-tag-light">◆ Smart Club Ecosystem</div>
            <h2 className="section-title">
              Всичко, от което се нуждае<br />
              <span className="section-title-highlight">един модерен клуб</span>
            </h2>
          </div>

          <div className={`toggle-wrapper ${subActive ? "toggle-wrapper-active" : ""}`}>
            <div className="toggle-label-group">
              <WifiOff size={15} className={`toggle-icon ${subActive ? "icon-dim" : "icon-active"}`} />
              <span className={`toggle-text ${subActive ? "text-dim" : "text-active"}`}>БЕЗ АБОНАМЕНТ</span>
            </div>

            <button onClick={() => setSubActive(!subActive)} className={`toggle-switch ${subActive ? "switch-active" : ""}`}>
              <div className={`toggle-handle ${subActive ? "handle-active" : ""}`} />
            </button>

            <div className="toggle-label-group">
              <span className={`toggle-text ${subActive ? "text-active" : "text-dim"}`}>С АБОНАМЕНТ</span>
              <Wifi size={15} className={`toggle-icon ${subActive ? "icon-active" : "icon-dim"}`} />
              {subActive && <div className="active-indicator" />}
            </div>
          </div>

          <div className="feat-grid">
            {FEATURES.map(f => (
              <FeatureCard key={f.id} feature={f} active={subActive} onClick={() => setPopup(f)} />
            ))}
          </div>
        </div>
      </section>

      <TrustedNetwork contactRef={contactRef} />

      <section id="Партньори" className="partners-section">
        <div className="partners-container">
          <div className="partners-header">
            <div className="partners-tag">Партньорска програма</div>
            <h3 className="partners-title">
              <span className="text-neon-green">10-20% отстъпка</span> за членовете на вашия клуб
            </h3>
          </div>

          <div className="partners-grid">
            {PARTNERS.map(p => (
              <div key={p.name} className="partner-card" style={{ "--p-color": p.color }}>
                <div className="partner-icon" style={{ color: p.color }}>{p.abbr}</div>
                <div className="partner-name">{p.name}</div>
                <div className="partner-discount">до 20% OFF</div>
              </div>
            ))}
            <div className="partner-card card-upcoming">
              <div className="partner-icon icon-upcoming">+</div>
              <div className="partner-name text-upcoming">Скоро...</div>
            </div>
          </div>
        </div>
      </section>

      <section id="Контакт" ref={contactRef} style={{ padding: "90px 24px", background: `linear-gradient(180deg,#09101C 0%,${BG} 100%)` }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div
              style={{
                fontFamily: "'Exo 2',sans-serif",
                fontSize: 11,
                color: G,
                letterSpacing: 3,
                textTransform: "uppercase",
                marginBottom: 16,
                fontWeight: 600
              }}
            >
              ◆ Стартирайте Сега
            </div>

            <h2
              style={{
                fontFamily: "'Exo 2',sans-serif",
                fontWeight: 900,
                fontSize: "clamp(26px,4vw,44px)",
                color: "#fff",
                marginBottom: 14,
                letterSpacing: -0.5,
                lineHeight: 1.1
              }}
            >
              Заявете Вашата<br />
              <span style={{ background: `linear-gradient(135deg,${G},${B})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                дигитална трансформация
              </span>
            </h2>

            <p
              style={{
                fontFamily: "'Exo 2',sans-serif",
                fontSize: 15,
                color: "rgba(255,255,255,.4)",
                maxWidth: 480,
                margin: "0 auto"
              }}
            >
              Нашият екип ще ви покаже как MyTeam работи за вашия клуб — безплатна консултация, без ангажимент.
            </p>
          </div>

          <LeadForm />
        </div>
      </section>

      <footer className="main-footer">
        <div className="footer-container">
          <div className="footer-logo">
            <div className="logo-icon-small">
              <Trophy size={14} color="#000" strokeWidth={2.5} />
            </div>
            <div>
              <div className="footer-brand">My<span className="text-neon-green">Team</span></div>
              <div className="footer-subtitle">by Moozuk22 OS</div>
            </div>
          </div>
          <div className="footer-copyright">© 2025 MyTeam / Moozuk22 OS. Всички права запазени.</div>
          <div className="footer-dots">
            {[G, B, G].map((c, i) => (
              <div key={i} className="footer-dot" style={{ background: c, animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}