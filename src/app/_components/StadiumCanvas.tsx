"use client";

import type { Dispatch, MouseEvent, RefObject, SetStateAction, TouchEvent } from "react";
import type { LandingClub } from "../_utils/landing-content";

import { useEffect, useRef, useCallback } from "react";
import { G, CLUBS } from "../_utils/landing-content";
import { drawFootball } from "../_utils/football";

type StadiumState = {
  rotX: number; rotY: number; targetRotX: number; targetRotY: number;
  dragging: boolean; lastX: number; lastY: number; autoRot: boolean; frame: number;
  zoom: number; targetZoom: number; localZoom: number; isMobile: boolean;
  particles: Array<{ x: number; y: number; z: number; r: number; opacity: number }>;
  conns: Array<{ i: number; j: number; d: number; phase: number; speed: number }>;
  ballConnIndexes: number[];
  clubScreenPos: Record<number, { x: number; y: number; r: number }>;
  loadedLogos: Record<number, HTMLImageElement>;
};

export function StadiumCanvas({ selectedId, onSelect, scrollProgress, zoomValRef, zoomProgressRef }: {
  selectedId?: number;
  onSelect: Dispatch<SetStateAction<LandingClub | null>>;
  scrollProgress: number;
  zoomValRef: RefObject<HTMLSpanElement | null>;
  zoomProgressRef: RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(null);

  const stRef = useRef<StadiumState>({
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

  function proj(x: number, y: number, z: number, rX: number, rY: number, zoom: number, cx: number, cy: number) {
    const isMobile = stRef.current.isMobile;
    const sc = zoom * (isMobile ? 0.28 : 0.44);
    return { sx: cx + x * sc, sy: cy + z * sc, sc, z2: z };
  }

  function drawPitchLines(ctx: CanvasRenderingContext2D, s: StadiumState, cx: number, cy: number) {
    const isMobile = s.isMobile;
    const len = isMobile ? 550 : 900;
    const wid = isMobile ? 900 : 550;

    const drawLine = (x1: number, z1: number, x2: number, z2: number) => {
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

    const drawGoalArea = (sign: number) => {
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

    const onWheelInternal = (e: WheelEvent) => {
      e.preventDefault();
      const s = stRef.current;
      s.localZoom -= e.deltaY * 0.0008;
      const minAllowedLocal = 0.92 - s.targetZoom;
      s.localZoom = Math.max(minAllowedLocal, Math.min(1.8, s.localZoom));
    };

    canvas.addEventListener("wheel", onWheelInternal, { passive: false });

    const draw = () => {
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
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [zoomValRef, zoomProgressRef]);

  const hitTest = useCallback((e: { clientX: number; clientY: number }) => {
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

  const onMouseMove = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
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

  const onMouseDown = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    const s = stRef.current;
    s.dragging = true;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.autoRot = false;
  }, []);

  const onMouseUp = useCallback(() => {
    stRef.current.dragging = false;
  }, []);

  const onClick = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    const hit = hitTest(e);
    if (hit) onSelect(prev => prev?.id === hit.id ? null : hit);
  }, [hitTest, onSelect]);

  const touchRef = useRef({ lx: 0, ly: 0 });
  const onTouchStart = useCallback((e: TouchEvent<HTMLCanvasElement>) => {
    stRef.current.autoRot = false;
    if (e.touches.length === 1) {
      touchRef.current.lx = e.touches[0].clientX;
      touchRef.current.ly = e.touches[0].clientY;
    }
  }, []);

  const onTouchMove = useCallback((e: TouchEvent<HTMLCanvasElement>) => {
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
