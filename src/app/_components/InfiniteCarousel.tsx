"use client";

import type { CarouselImage } from "../_utils/landing-content";

import React, { useEffect, useRef } from "react";
import { CAROUSEL_IMAGES } from "../_utils/landing-content";

export function InfiniteCarousel({ onExpand }: { onExpand: (image: CarouselImage) => void }) {
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
      if (!pausedRef.current && !isDraggingRef.current) {
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
    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      container.removeEventListener("mouseenter", onMouseEnter);
      container.removeEventListener("mouseleave", onMouseLeave);
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
