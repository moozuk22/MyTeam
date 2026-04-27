// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import "./page.css";
import {
  Fingerprint, LayoutGrid, BadgePercent, CreditCard,
  Users, ShieldCheck, X, ChevronRight, Play,
  Zap, Trophy, ArrowRight, ArrowDown,
  Phone, Mail, MessageSquare, MessageCircle, User,
  Wifi, WifiOff, Menu, Calendar,
  MapPin, TrendingUp, Activity, Globe, Lock,
  Check, X as CloseX, PhoneCall, HelpCircle, Cpu, Tag,
  IdCard, BarChart3, ChevronDown, Crown, CheckCircle, Shield, Puzzle
} from "lucide-react";
import ChatBot from "@/components/ChatBot";
import NavBar from "@/components/NavBar";

/* ── TOKENS ── */
const G = "#39FF14";
const B = "#39FF14"; // Unified to Green
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
    short: "Ексклузивни отстъпки в Sport Depot и други.",
    details: "Вашият клуб получава достъп до преференциални условия при лидери като Sport Depot и други подбрани брандове.",
    benefits: ["Директна отстъпка от -10%", "Широка мрежа от физически обекти", "Смарт карта за лесна идентификация", "Ползи за родителите и атлетите"],
    requiresSub: true
  },
  {
    id: 4, icon: CreditCard, color: B,
    title: "Плащания",
    short: "Ръчно проследяване на месечните такси.",
    details: "Системата позволява бързо отразяване на плащанията, като автоматично виждате статуса на всеки член.",
    benefits: ["Ръчно маркиране на вноски", "Бърза проверка на задълженията", "Пълна финансова прозрачност", "История на плащанията"],
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

const PROBLEMS = [
  { icon: "📓", title: "Хаос с тефтери", desc: "Различни списъци и Excel-и водят до грешки и загубено време. MyTeam дигитализира всичко." },
  { icon: "💸", title: "Нередовни плащания", desc: "Родителите забравят или закъсняват с таксите. Системата проследява всичко автоматично." },
  { icon: "📊", title: "Липса на контрол", desc: "Нямаш ясна представа кой е платил и кой не. С MyTeam виждаш статуса на всеки член." },
  { icon: "🧠", title: "Сложно планиране", desc: "Ръчното разпределение на групи и графици е трудно. Нашата система го прави вместо Вас." },
  { icon: "📢", title: "Трудна комуникация", desc: "Разпръснати съобщения във Viber и Messenger? MyTeam централизира връзката с родителите." },
  { icon: "📂", title: "Загуба на история", desc: "Играчи напускат, а данните им изчезват? Пазете пълна история на всяко дете години наред." }
];

const COMPARISON = {
  before: [
    "Управление с хартиени списъци",
    "Ръчно проследяване на такси",
    "Никакви ползи за родителите",
    "Тренировъчен график във Viber/WhatsApp"
  ],
  after: [
    "Цялостно дигитално управление",
    "Автоматично проследяване на такси",
    "Отстъпки в Sport Depot и други",
    "Интелигентен тренировъчен график"
  ]
};

const PARTNERS = [
  { name: "Sport Depot", abbr: "SD", color: "#FF6B00", disc: "-10%", logo: "/sd-logo.png" }
];

const ALL_PARTNERS = [
  { name: "Sport Depot", logo: "/sd-logo.png" },
  { name: "Мебели НИКО", logo: "/niko-logo.png" },
  { name: "Dalida Dance Show", logo: "/dalida-logo.png" },
  { name: "Inline Body", logo: "/idb-logo.svg" }
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

    // Logos preloading disabled as assets are handled via fallbacks
    /*
    CLUBS.forEach(c => {
      const img = new Image();
      img.src = `/logos/${c.id}.svg`;
      img.onload = () => {
        s.loadedLogos[c.id] = img;
      };
    });
    */
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
    { icon: Activity, label: "Status", value: "Smart Access", unit: "Active", color: G },
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
                  <div className="v-sub-green" style={{ fontSize: 11, fontWeight: 700, color: "var(--neon-green)", marginTop: 4 }}>
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
            MyTeam — Онлайн и активен
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
          Клубовете, които <span className="hero-title-highlight">ни вярват</span>
        </h2>
        <p className="network-subtitle">Присъединете се към националната мрежа от дигитални спортни организации.</p>
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

          <div className="live-indicator">
            <div className="live-dot" />
            <span className="live-text">LIVE — {isMobileView ? "10" : "16"} КЛУБА ОНЛАЙН</span>
          </div>

          {["tl", "tr", "bl", "br"].map(k => (
            <div key={k} className={`hud-corner hud-${k}`} />
          ))}
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

function LeadForm({ onSuccess }) {
  const [form, setForm] = useState({ club: "", name: "", email: "", phone: "", kids: "" });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation: ensure all fields are filled
    if (!form.club || !form.name || !form.email || !form.phone || !form.kids) {
      setError("Моля попълнете всички полета.");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError("Моля въведете валиден имейл адрес.");
      return;
    }

    // Phone validation (simple check for digits and length)
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 9 || phoneDigits.length > 13) {
      setError("Моля въведете валиден телефонен номер.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          club: form.club,
          name: form.name,
          email: form.email,
          phone: form.phone,
          kids: form.kids
        })
      });

      if (response.ok) {
        onSuccess();
        setForm({ club: "", name: "", email: "", phone: "", kids: "" });
      } else {
        setError("Възникна грешка. Моля опитайте отново по-късно.");
      }
    } catch (err) {
      setError("Проблем с връзката. Моля проверете интернета си.");
    } finally {
      setLoading(false);
    }
  };

  const inp = (f) => ({
    className: `form-input ${focused === f ? "input-focused" : ""}`,
    onFocus: () => setFocused(f),
    onBlur: () => setFocused("")
  });

  return (
    <div className="lead-form-wrapper">
      <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
        {[
          { id: "club", label: "Име на спортен клуб", icon: Trophy, ph: "Име на вашия клуб" },
          { id: "name", label: "Вашето име", icon: User, ph: "Вашите три имена" },
          { id: "email", label: "Имейл адрес", icon: Mail, ph: "example@mail.com" },
          { id: "phone", label: "Телефон за връзка", icon: Phone, ph: "0XXXXXXXXX" },
          { id: "kids", label: "Приблизителен брой деца", icon: Users, ph: "пр. 150" }
        ].map(i => (
          <div key={i.id} className="form-group">
            <label className="form-label"><i.icon size={12} /> {i.label}</label>
            <input
              type={i.id === "email" ? "email" : i.id === "phone" ? "tel" : i.id === "kids" ? "number" : "text"}
              placeholder={i.ph}
              value={form[i.id]}
              onChange={e => {
                const val = i.id === "phone" ? e.target.value.replace(/\D/g, "") : e.target.value;
                setForm({ ...form, [i.id]: val });
              }}
              {...inp(i.id)}
            />
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          color: "#FF3E3E",
          fontSize: 13,
          fontWeight: 600,
          marginTop: 20,
          textAlign: "center",
          background: "rgba(255, 62, 62, 0.1)",
          padding: "10px 16px",
          borderRadius: 10,
          border: "1px solid rgba(255, 62, 62, 0.2)"
        }}>
          ⚠️ {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading} className={`form-submit-btn ${loading ? "btn-loading" : ""}`} style={{ marginTop: 24 }}>
        {loading ? (
          <>
            <div className="loading-spinner" /> Изпращане...
          </>
        ) : (
          <>
            ВЗЕМИ БЕЗПЛАТНО ДЕМО <ArrowRight size={18} />
          </>
        )}
      </button>

      <div className="form-footer-note">🔒 Данните Ви са защитени. Получавате 30 дена гратисен период.</div>
    </div>
  );
}

function SuccessModal({ onClose }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  return (
    <div className="popup-overlay" style={{ zIndex: 10000, position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }} onClick={onClose}>
      <div className="popup-card success-popup" onClick={e => e.stopPropagation()} style={{
        textAlign: "center",
        padding: "24px",
        border: "1px solid rgba(57, 255, 20, 0.2)",
        maxWidth: 400,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 16
      }}>
        <div style={{ marginBottom: 0 }}>
          <img
            src="/myteam-logo.png"
            alt="MyTeam Logo"
            style={{ height: 36, margin: "0 auto" }}
          />
        </div>

        <div style={{ textAlign: "center" }}>
          <h2 className="popup-title" style={{ fontSize: 20, marginBottom: 4, fontFamily: "var(--serif-font)" }}>Заявката е приета!</h2>
          <p className="popup-desc" style={{
            fontSize: 13,
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.7)",
            margin: "0 auto"
          }}>
            Успешна заявка! Ще се свържем с Вас до 24 часа. <br />
            <strong>Кратко демо на системата:</strong>
          </p>
        </div>

        <div style={{
          width: "100%",
          borderRadius: 8,
          overflow: "hidden",
          background: "#000",
          boxShadow: "0 0 25px rgba(57, 255, 20, 0.12)",
          border: "1px solid rgba(255,255,255,0.05)"
        }}>
          <video
            src="/demo.mp4"
            controls
            autoPlay
            muted
            playsInline
            style={{ width: "100%", display: "block" }}
          />
        </div>

        <button onClick={onClose} className="popup-action-btn" style={{
          width: "100%",
          height: 44,
          fontSize: 13,
          fontWeight: 800,
          background: "var(--neon-green)",
          backgroundImage: "linear-gradient(135deg, var(--neon-green), #20C020)",
          color: "#000",
          borderRadius: 8,
          boxShadow: "0 8px 15px rgba(57, 255, 20, 0.2)",
          marginTop: 2
        }}>
          РАЗБРАХ
        </button>
      </div>
    </div>
  );
}

const CAROUSEL_IMAGES = [
  { src: "/1.png", alt: "MyTeam Interface — Dashboard" },
  { src: "/2.png", alt: "MyTeam Interface — Players Management" },
  { src: "/3.png", alt: "MyTeam Interface — Reports & Analytics" },
  { src: "/4.png", alt: "MyTeam Interface — Schedule" },
  { src: "/5.png", alt: "MyTeam Interface — Smart Access" },
  { src: "/6.png", alt: "MyTeam Interface — Smart" },
];

function Lightbox({ image, onClose }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={e => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>
          <X size={24} />
        </button>
        <img
          src={image.src}
          alt={image.alt}
          className="lightbox-img"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
}

function VideoModal({ onClose }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => { });
    }
  }, []);

  const handleOverlayClick = () => {
    if (videoRef.current) videoRef.current.pause();
    onClose();
  };

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 900,
          background: "#000",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 0 60px rgba(57,255,20,0.2)"
        }}
      >
        <button
          onClick={handleOverlayClick}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "50%",
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fff"
          }}
        >
          <X size={20} />
        </button>
        <video
          ref={videoRef}
          src="/demo.mp4"
          controls
          playsInline
          style={{ width: "100%", display: "block", maxHeight: "80vh" }}
        />
      </div>
    </div>
  );
}

function InfiniteCarousel({ onExpand }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const pausedRef = useRef(false);
  const rafRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(null);
  const singleWidthRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPosRef = useRef(0);
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const SPEED = 50; // px/s
  const GAP = 40;
  const N = CAROUSEL_IMAGES.length;

  const imageItems = CAROUSEL_IMAGES.map((img, i) => (
    <div
      key={`img-${i}`}
      className="carousel-item"
      onClick={() => { if (!hasDraggedRef.current) onExpand(img); }}
    >
      <img
        src={img.src}
        alt={img.alt}
        style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
      />
    </div>
  ));

  const allItems = [...imageItems, ...imageItems, ...imageItems];

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    let firstMeasure = true;
    const measure = () => {
      const itemEl = track.querySelector(".carousel-item") as HTMLElement;
      if (!itemEl) return;
      const itemWidth = itemEl.getBoundingClientRect().width;
      singleWidthRef.current = N * (itemWidth + GAP);
      if (firstMeasure) {
        posRef.current = -singleWidthRef.current;
        firstMeasure = false;
      }
      const sw = singleWidthRef.current;
      if (posRef.current <= -2 * sw) posRef.current += sw;
      else if (posRef.current >= 0) posRef.current -= sw;
      track.style.transform = `translateX(${posRef.current}px)`;
    };
    measure();

    const clampLoop = () => {
      const sw = singleWidthRef.current;
      if (posRef.current <= -2 * sw) posRef.current += sw;
      else if (posRef.current >= 0) posRef.current -= sw;
    };

    const animate = (timestamp: number) => {
      if (!pausedRef.current && !isDraggingRef.current && !isUserScrollingRef.current) {
        const dt = lastTimeRef.current != null ? timestamp - lastTimeRef.current : 0;
        posRef.current -= (SPEED * dt) / 1000;
        clampLoop();
        track.style.transform = `translateX(${posRef.current}px)`;
      }
      lastTimeRef.current = timestamp;
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    const onMouseEnter = () => { pausedRef.current = true; };
    const onMouseLeave = () => { pausedRef.current = false; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      posRef.current -= e.deltaX || e.deltaY;
      clampLoop();
      track.style.transform = `translateX(${posRef.current}px)`;
      isUserScrollingRef.current = true;
      clearTimeout(userScrollTimeoutRef.current);
      userScrollTimeoutRef.current = setTimeout(() => { isUserScrollingRef.current = false; }, 1000);
    };

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      hasDraggedRef.current = false;
      dragStartXRef.current = e.clientX;
      dragStartPosRef.current = posRef.current;
      container.classList.add("dragging");
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartXRef.current;
      if (Math.abs(dx) > 5) hasDraggedRef.current = true;
      posRef.current = dragStartPosRef.current + dx;
      clampLoop();
      track.style.transform = `translateX(${posRef.current}px)`;
    };
    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      container.classList.remove("dragging");
    };

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartPos = 0;
    let isHorizontalDrag = false;
    let dragDirectionLocked = false;
    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartPos = posRef.current;
      hasDraggedRef.current = false;
      isHorizontalDrag = false;
      dragDirectionLocked = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (!dragDirectionLocked) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        isHorizontalDrag = Math.abs(dx) > Math.abs(dy);
        dragDirectionLocked = true;
      }
      if (!isHorizontalDrag) return;
      if (Math.abs(dx) > 5) hasDraggedRef.current = true;
      posRef.current = touchStartPos + dx;
      clampLoop();
      track.style.transform = `translateX(${posRef.current}px)`;
    };

    const onResize = () => measure();

    container.addEventListener("mouseenter", onMouseEnter);
    container.addEventListener("mouseleave", onMouseLeave);
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(userScrollTimeoutRef.current);
      container.removeEventListener("mouseenter", onMouseEnter);
      container.removeEventListener("mouseleave", onMouseLeave);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div ref={containerRef} className="carousel-container">
      <div ref={trackRef} className="carousel-track">
        {allItems.map((item, i) => (
          <React.Fragment key={`slot-${i}`}>{item}</React.Fragment>
        ))}
      </div>
    </div>
  );
}

function RevealSection({ children }) {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setActive(true);
        obs.unobserve(el);
      }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal-hidden ${active ? "reveal-active" : ""}`}>
      {children}
    </div>
  );
}

export default function Home() {
  const [subActive, setSubActive] = useState(false);
  const [withSchedule, setWithSchedule] = useState(false);
  const [popup, setPopup] = useState(null);
  const [expandedImage, setExpandedImage] = useState(null);
  const [benefitsOpen, setBenefitsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showDockActions, setShowDockActions] = useState(false);
  const contactRef = useRef(null);

  useEffect(() => {
    const handleGlobalContextMenu = (e) => {
      if (e.target.tagName === "IMG") e.preventDefault();
    };
    const handleGlobalDragStart = (e) => {
      if (e.target.tagName === "IMG") e.preventDefault();
    };

    document.addEventListener("contextmenu", handleGlobalContextMenu);
    document.addEventListener("dragstart", handleGlobalDragStart);

    return () => {
      document.removeEventListener("contextmenu", handleGlobalContextMenu);
      document.removeEventListener("dragstart", handleGlobalDragStart);
    };
  }, []);

  useEffect(() => {
    // Record page visit only once per browser session to prevent inflation from refreshes
    if (typeof window !== "undefined" && !sessionStorage.getItem("mt_visit_recorded")) {
      void fetch("/api/page-clicks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "page_visit" })
      });
      sessionStorage.setItem("mt_visit_recorded", "true");
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("video") === "1") {
        setShowVideoModal(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!contactRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowDockActions(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(contactRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <NavBar />
      {popup && <FeaturePopup feature={popup} onClose={() => setPopup(null)} />}
      {expandedImage && <Lightbox image={expandedImage} onClose={() => setExpandedImage(null)} />}
      {showSuccess && <SuccessModal onClose={() => setShowSuccess(false)} />}
      {showVideoModal && <VideoModal onClose={() => setShowVideoModal(false)} />}

      <RevealSection>
        <section className="hero-section" style={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
          <div className="hero-grid-bg" />
          <div className="hero-content" style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>

            <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 64, width: "100%" }} className="hero-split">
              <div className="hero-text-col" style={{ flex: 1, minWidth: 320, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <h1 className="hero-title" style={{ fontSize: "clamp(32px, 5vw, 48px)" }}>
                  <span className="hero-title-highlight"><span style={{ color: "#fff" }}>My</span>Team</span> – интелигентна платформа за управление на Вашия клуб
                </h1>

                <p className="hero-description" style={{ margin: "0 0 32px 0", maxWidth: 650, textAlign: "center", fontSize: "16px" }}>
                  Проследявайте плащанията, използвайте онлайн график и се възползвайте от специални отстъпки – всичко на едно място.
                </p>

                <div className="hero-actions" style={{ marginTop: 24, gap: 24, display: "flex", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                  <a href="#Контакт" className="hero-btn-primary hero-btn-cta" style={{ padding: "12px 36px", height: "64px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "12px", border: "1px solid rgba(57, 255, 20, 0.3)" }}>
                    <div className="hero-btn-stack" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <div className="hero-line-1" style={{ fontSize: "13px", fontWeight: "900", letterSpacing: "0.5px" }}>
                        БЕЗПЛАТНА <span style={{ color: "#000", fontWeight: "900" }}>ВИДЕО</span>
                      </div>
                      <div className="hero-line-2" style={{ fontSize: "13px", fontWeight: "900", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
                        КОНСУЛТАЦИЯ <ArrowRight size={16} />
                      </div>
                    </div>
                  </a>
                  <a href="#Системата" className="hero-btn-secondary" style={{
                    padding: "0 36px",
                    height: "64px",
                    textDecoration: "none",
                    background: "#FF3E3E",
                    color: "#000",
                    fontWeight: "900",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "12px",
                    fontSize: "13px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    boxShadow: "0 8px 20px rgba(255, 62, 62, 0.25)"
                  }}>
                    ВИЖ КАК РАБОТИ <ArrowDown size={18} style={{ marginLeft: 8 }} />
                  </a>
                </div>

                <div className="stats-row" style={{ marginTop: 60, background: "none", border: "none" }}>
                  {[
                    { v: "10 мин.", l: "за настройка" },
                    { v: "100%", l: "платени такси" },
                    { v: "30 дни", l: "безплатен период" }
                  ].map((s, i) => (
                    <div key={i} className="stat-col">
                      <div className="stat-v-hero" style={{ fontFamily: "var(--serif-font)" }}>{s.v}</div>
                      <div className="stat-l-hero">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      <div id="Системата" style={{ scrollMarginTop: "140px" }}></div>
      <RevealSection>
        <section id="Интерфейс" className="system-section">
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h2 className="section-title" style={{ fontFamily: "var(--serif-font)" }}>Системата, която работи!</h2>
          </div>
          <InfiniteCarousel onExpand={setExpandedImage} />
        </section>
      </RevealSection>

      <RevealSection>
        <section style={{ padding: "40px 24px", background: "#070C14", textAlign: "center" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="problem-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 24
            }}>
              {[
                { icon: "📅", title: "Административен хаос", desc: "Хартиените списъци и Excel таблиците водят до системни грешки и загуба на време.", color: "#FFB000" },
                { icon: "💸", title: "Нередовни такси", desc: "Липсата на автоматизация при плащанията, води до неприятни разговори с родителите.", color: "var(--neon-green)" },
                { icon: "📊", title: "Липса на контрол", desc: "Край на нерегламентираните отсъствия от тренировъчния процес.", color: "#0080FF" },
                { icon: "📢", title: "Комуникационен шум", desc: "Чат групите са пълни с излишни съобщения, а важната информация се губи.", color: "#FF3E3E" }
              ].map((p, i) => (
                <div key={i} style={{
                  background: "rgba(255,255,255,0.03)",
                  padding: "28px 20px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.05)",
                  transition: "all 0.3s ease",
                  textAlign: "center"
                }}>
                  <div style={{
                    fontSize: 40,
                    marginBottom: 20,
                    display: "flex",
                    justifyContent: "center",
                    filter: `drop-shadow(0 0 10px ${p.color}44)`
                  }}>{p.icon}</div>
                  <h3 style={{ fontSize: 20, color: "#FF3E3E", marginBottom: 12, fontWeight: 800 }}>{p.title}</h3>
                  <p style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="comparison-section">
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 className="section-title" style={{ fontFamily: "var(--serif-font)" }}>
              <span style={{ color: "#FF3E3E" }}>Настояще</span> / <span style={{ color: "var(--neon-green)" }}>Бъдеще</span>
            </h2>
          </div>
          <div className="comparison-grid">
            <div className="comparison-col col-before">
              <div className="comp-list">
                {COMPARISON.before.map((item, i) => (
                  <div key={i} className="comp-item">
                    <CloseX size={18} className="comp-icon-x" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="comparison-col col-after">
              <div className="comp-list">
                {COMPARISON.after.map((item, i) => (
                  <div key={i} className="comp-item">
                    <Check size={18} className="comp-icon-v" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* VIP section moved to /vip */}
      {/* Функции section moved to /funkcii */}

      {/* <RevealSection>
        <section id="Цени" className="pricing-section" style={{ scrollMarginTop: "100px" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 className="section-title" style={{ fontFamily: "var(--serif-font)", color: "var(--neon-green)" }}>Преференциални условия за първи потребители.</h2>
            <p style={{ color: "#FF3E3E", fontWeight: 700, marginTop: 10 }}>* Свободни места: 5 от общо 10 отбора</p>
          </div>
          <div className="pricing-grid">
            {[
              { base: 44, count: "До 100 деца" },
              { base: 53, count: "До 200 деца", popular: true },
              { base: 71, count: "Над 300 деца" }
            ].map((plan, i) => (
              <div key={i} className={`pricing-card ${plan.popular ? "pricing-card-popular" : ""}`}>
                {plan.popular && <div className="pricing-badge">НАЙ-ПРЕДПОЧИТАН</div>}
                <h3 className="comp-title">{plan.count}</h3>
                <div className="price-box" style={{ marginBottom: 24 }}>
                  <span className="price-val" style={{ fontSize: 48, fontWeight: 900, color: "#fff" }}>
                    {withSchedule ? plan.base + 9 : plan.base}€
                  </span>
                  <span className="price-unit" style={{ fontSize: 14, opacity: 0.5, marginLeft: 8 }}>/ месец</span>
                </div>
                <div className="comp-list" style={{ marginBottom: 32 }}>
                  <div className="comp-item"><Check size={16} color="var(--neon-green)" /> <span>Обучение и интеграция</span></div>
                  <div className="comp-item"><Check size={16} color="var(--neon-green)" /> <span>Смарт карти за достъп</span></div>
                  <div className="comp-item"><Check size={16} color="var(--neon-green)" /> <span>Партньорски отстъпки</span></div>
                  {withSchedule && <div className="comp-item" style={{ color: "var(--neon-green)" }}><Check size={16} /> <span>Тренировъчен график</span></div>}
                </div>

                <div
                  className="pricing-schedule-toggle"
                  onClick={() => setWithSchedule(!withSchedule)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: withSchedule ? "rgba(57, 255, 20, 0.1)" : "rgba(255,255,255,0.03)",
                    borderRadius: 12,
                    cursor: "pointer",
                    border: `1px solid ${withSchedule ? "rgba(57, 255, 20, 0.3)" : "rgba(255,255,255,0.05)"}`,
                    transition: "all 0.3s ease"
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 20,
                    background: withSchedule ? "var(--neon-green)" : "rgba(255,255,255,0.1)",
                    borderRadius: 20,
                    position: "relative",
                    transition: "all 0.3s ease"
                  }}>
                    <div style={{
                      width: 14,
                      height: 14,
                      background: withSchedule ? "#000" : "#fff",
                      borderRadius: "50%",
                      position: "absolute",
                      top: 3,
                      left: withSchedule ? 19 : 3,
                      transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: withSchedule ? "var(--neon-green)" : "rgba(255,255,255,0.5)" }}>
                    ТРЕНИРОВЪЧЕН ГРАФИК
                  </span>
                </div>

                <a href="#Контакт" className="nav-demo-btn" style={{
                  width: "100%",
                  background: plan.popular ? "var(--neon-green)" : "none",
                  color: plan.popular ? "#000" : "#fff",
                  border: plan.popular ? "none" : "1px solid rgba(255,255,255,0.2)",
                  textDecoration: "none",
                  textAlign: "center",
                  display: "inline-block"
                }}>
                  {plan.popular ? "30 ДНИ БЕЗ ТАКСА" : "ЗАПОЧНИ СЕГА"}
                </a>
              </div>
            ))}
          </div>
        </section>
      </RevealSection> */}

      <RevealSection>
        <section id="Абонаменти" className="new-pricing-section" style={{ scrollMarginTop: "100px" }}>
          <div className="section-container-wide">
            <div className="new-pricing-grid">

              {/* LEFT: Subscription Levels Table */}
              <div className="pricing-table-container">
                <div className="pricing-table-header">АБОНАМЕНТНИ НИВА</div>
                <table className="pricing-modern-table">
                  <thead>
                    <tr>
                      <th>Категория <br /> (Брой деца)</th>
                      <th>Стандартна месечна такса</th>
                      <th className="vip-column-header">
                        <div className="vip-header-content">
                          <Crown size={50} color="#39FF14" />
                          <div>
                            <div className="vip-title">VIP Цена <br /> <span className="vip-subtitle">(Първи 10 отбора)</span></div>
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { cat: "0 - 50 деца", old: "35 €", new: "0 €" },
                      { cat: "50 - 100 деца", old: "44 €", new: "17 €" },
                      { cat: "100 - 200 деца", old: "53 €", new: "26 €" },
                      { cat: "200 - 300 деца", old: "62 €", new: "35 €" },
                      { cat: "Над 300 деца", old: "71 €", new: "44 €" },
                    ].map((row, i) => (
                      <tr key={i}>
                        <td>
                          <div className="cat-cell">
                            <Users size={18} color="rgba(131, 102, 102, 0.7)" />
                            {row.cat}
                          </div>
                        </td>
                        <td><span className="old-price-cell">{row.old}</span></td>
                        <td className="vip-price-cell">{row.new}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="pricing-disclaimer">
                  *Преференциалните VIP цени са валидни до края на годината единствено за първите 10 клуба, присъединили се към програмата.
                </p>
              </div>

              {/* RIGHT: Additional Modules */}
              <div className="additional-modules-container">
                <div className="pricing-table-header">ДОПЪЛНИТЕЛНИ МОДУЛИ</div>

                <div className="module-box-v2">
                  <div className="module-icon-v2">
                    <Calendar size={28} color="#39FF14" />
                  </div>
                  <div className="module-info-v2">
                    <div className="module-top-row">
                      <h3>+ Интелигентен тренировъчен график</h3>
                      <div className="module-price-tag">+9 € / месец</div>
                    </div>
                    <p className="module-include-label">Включва:</p>
                    <ul className="module-checklist-v2">
                      <li><Check size={14} /> Онлайн график на тренировките</li>
                      <li><Check size={14} /> Следене на присъствия</li>
                      <li><Check size={14} /> Автоматични известия към родители</li>
                    </ul>
                  </div>
                </div>

                <div className="module-box-v2">
                  <div className="module-icon-v2">
                    <Puzzle size={28} color="#39FF14" />
                  </div>
                  <div className="module-info-v2">
                    <div className="module-top-row">
                      <h3>+ Модул „Разширяване“</h3>
                      <div className="module-offer-text">
                        Персонална оферта <br />
                        <span>след индивидуална консултация</span>
                      </div>
                    </div>
                    <p className="module-include-label">Подходящ за:</p>
                    <ul className="module-checklist-v2">
                      <li><Check size={14} /> Клубове с множество филиали</li>
                      <li><Check size={14} /> Маркетинг и привличане на нови състезатели</li>
                      <li><Check size={14} /> Разширено управление и анализи</li>
                    </ul>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </section>
      </RevealSection>
      <RevealSection>
        <section id="Контакт" ref={contactRef} style={{ padding: "40px 24px", background: `linear-gradient(180deg,#09101C 0%,${BG} 100%)`, scrollMarginTop: "100px" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div className="section-tag-light" style={{ marginBottom: 8 }}>◆ ЗАЯВЕТЕ ДЕМО И 30 ДНИ БЕЗ ТАКСА</div>
              <div style={{ color: "#FF3E3E", fontSize: 12, fontWeight: 800, letterSpacing: 2, marginBottom: 24, textTransform: "uppercase", display: "flex", justifyContent: "center" }}>БЕЗ ОБВЪРЗВАНЕ</div>
              <h2 className="section-title" style={{ fontFamily: "var(--serif-font)" }}>Получете детайлна оферта до 24 часа.</h2>
            </div>
            <LeadForm onSuccess={() => setShowSuccess(true)} />
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section style={{ padding: "40px 24px", background: "radial-gradient(circle at center, #0B1628 0%, #070C14 100%)", textAlign: "center" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>

            <button
              onClick={() => setBenefitsOpen(!benefitsOpen)}
              className="benefits-toggle-btn"
              style={{
                background: "linear-gradient(135deg, var(--neon-green), #20C020)",
                color: "#000",
                border: "none",
                borderRadius: 12,
                padding: "16px 36px",
                fontFamily: "'Exo 2', sans-serif",
                fontWeight: 800,
                fontSize: 15,
                letterSpacing: 1,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                boxShadow: benefitsOpen
                  ? "0 0 55px rgba(57, 255, 20, 0.7)"
                  : "0 0 30px rgba(57, 255, 20, 0.4)",
                transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                userSelect: "none"
              }}
            >
              ПОЛЗИ ЗА РОДИТЕЛИТЕ
              <span style={{
                fontSize: 20,
                lineHeight: 1,
                transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: benefitsOpen ? "rotate(180deg)" : "rotate(0deg)",
                display: "inline-block"
              }}>▾</span>
            </button>

            <div style={{
              maxHeight: benefitsOpen ? "2000px" : "0",
              opacity: benefitsOpen ? 1 : 0,
              overflow: "hidden",
              transition: "all 1s cubic-bezier(0.4, 0, 0.2, 1)",
              textAlign: "left",
              marginTop: benefitsOpen ? 60 : 0
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 32, paddingBottom: 40 }}>
                {[
                  { icon: "🎁", text: "Отстъпки в различни търговски вериги (Sport Depot и други)", desc: "Спестявайте от спортна екипировка, обувки и аксесоари чрез партньорската ни мрежа." },
                  { icon: "📱", text: "Проследяване на тренировки и плащания в реално време", desc: "Пълен контрол през вашето мобилно устройство без нужда от излишни обаждания." },
                  { icon: "💳", text: "Смарт карта, която се изплаща сама чрез спестени средства", desc: "Уникална дигитална карта, която ви носи реална добавена стойност всеки месец." }
                ].map((item, i) => (
                  <div key={i} className="benefit-card">
                    <div style={{
                      fontSize: 32,
                      width: 64,
                      height: 64,
                      background: "rgba(57, 255, 20, 0.05)",
                      borderRadius: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      border: "1px solid rgba(57, 255, 20, 0.1)"
                    }}>{item.icon}</div>
                    <div className="benefit-card-content">
                      <h4 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "var(--neon-green)" }}>{item.text}</h4>
                      <p style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.6, fontSize: 16 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section id="Партньори" style={{ padding: "40px 24px", background: "rgba(255,255,255,0.01)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div className="section-tag-light">МРЕЖА ОТ ПАРТНЬОРИ</div>
              <h2 className="section-title" style={{ fontFamily: "var(--serif-font)" }}>Добавена стойност за всеки член.</h2>
              <p style={{ color: "rgba(255,255,255,0.4)" }}>Вашият клуб получава достъп до преференциални условия при подбрани брандове.</p>
            </div>

            <div className="partners-list-modern">
              {PARTNERS.map(p => (
                <div key={p.name} className="partner-item-minimal">
                  <div className="partner-logo-wrapper">
                    <img src={p.logo} alt={p.name} className="partner-logo-large" />
                  </div>
                  <div className="partner-info-minimal">
                    <div className="partner-name-minimal">{p.name}</div>
                    <div className="partner-disc-minimal" style={{ color: "#FF3E3E" }}>{p.disc} ОТСТЪПКА</div>
                    <div style={{ marginTop: 20, color: "rgba(255,255,255,0.2)", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>
                      + специални условия в широка мрежа от партньори
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="partners-strip-section" style={{ borderTop: "1px solid rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.03)", padding: "30px 0" }}>
          <div className="partners-marquee-outer">
            <div className="partners-marquee-track">
              {Array(10).fill(ALL_PARTNERS).flat().map((p, i) => (
                <div className="partner-marquee-item" key={i}>
                  <img src={p.logo} alt={p.name} className="partner-marquee-logo" />
                  <span className="partner-marquee-name">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <footer className="main-footer">
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 32,
          marginBottom: 16,
        }}>
          <a href="#" style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, textDecoration: "none", transition: "color 0.2s" }} onMouseOver={e => e.currentTarget.style.color = "var(--neon-green)"} onMouseOut={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}>ЗАЩИТА НА ЛИЧНИ ДАННИ</a>
          <a href="#" style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, textDecoration: "none", transition: "color 0.2s" }} onMouseOver={e => e.currentTarget.style.color = "var(--neon-green)"} onMouseOut={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}>ОБЩИ УСЛОВИЯ</a>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 32,
          marginBottom: 32,
          paddingBottom: 32,
          borderBottom: "1px solid rgba(255,255,255,0.03)"
        }}>
          <a href="tel:0896495254" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "color 0.2s" }} onMouseOver={e => e.currentTarget.style.color = "var(--neon-green)"} onMouseOut={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>0896 495 254</a>
          <a href="mailto:office@myteam7.com" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "color 0.2s" }} onMouseOver={e => e.currentTarget.style.color = "var(--neon-green)"} onMouseOut={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>office@myteam7.com</a>
        </div>

        <div className="footer-container">
          <div className="footer-logo">
            <img src="/myteam-logo.png" alt="MyTeam Logo" style={{ height: 50, width: "auto" }} />
          </div>
          <div className="footer-copyright">
            © 2026 MyTeam. Всички права запазени.
          </div>
          <div className="footer-dots">
            {[G, B, G].map((c, i) => (
              <div key={i} className="footer-dot" style={{ background: c, animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
        </div>

        <div style={{
          marginTop: 40,
          textAlign: "center",
          fontSize: 10,
          color: "rgba(255,255,255,0.1)",
          textTransform: "uppercase",
          letterSpacing: 2,
          borderTop: "1px solid rgba(255,255,255,0.03)",
          paddingTop: 20
        }}>
          ◆ Powered by moozuk22 ◆
        </div>
      </footer>

      <div className="mobile-fab-dock">
        <div className={`fab-left-wing ${showDockActions ? "" : "dock-hidden-actions"}`}>
          <a href="tel:0896495254" className="fab-circle call-fab" title="Call Us">
            <PhoneCall size={26} color="#000" />
          </a>
        </div>

        <div className="fab-right-wing">
          <ChatBot scrollToContact={() => contactRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })} />
          <div className={`${showDockActions ? "" : "dock-hidden-actions"}`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <a href="viber://chat?number=%2B359896495254" className="fab-circle viber-fab" title="Viber">
              <img src="/viber.png" alt="Viber" style={{ width: 50, height: 50, objectFit: "contain" }} />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
