"use client";

import type * as React from "react";
import { useState, useMemo, useCallback, useRef } from "react";
import { ALL_GUIDE_STEPS } from "../_utils/members-guide";

type MembersGuideOptions = {
  isAdmin: boolean;
};

export function useMembersGuide({ isAdmin }: MembersGuideOptions) {
  const [guideOpen, setGuideOpen] = useState(false);

  const [guideStep, setGuideStep] = useState(0);

  const [guideImgExpanded, setGuideImgExpandedState] = useState(false);

  const [guideImgScale, setGuideImgScale] = useState(1);

  const [guideImgPos, setGuideImgPos] = useState({ x: 0, y: 0 });

  const guideImgTouchRef = useRef<{
    startDist: number;
    startScale: number;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  const guideSteps = useMemo(() => ALL_GUIDE_STEPS.filter((s) => !s.adminOnly || isAdmin), [isAdmin]);

  const setGuideImgExpanded = (expanded: boolean) => {
    setGuideImgExpandedState(expanded);
    if (!expanded) {
      setGuideImgScale(1);
      setGuideImgPos({ x: 0, y: 0 });
      guideImgTouchRef.current = null;
    }
  };

  const handleGuideImgTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.stopPropagation();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        guideImgTouchRef.current = {
          startDist: Math.hypot(dx, dy),
          startScale: guideImgScale,
          startX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          startY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          startPosX: guideImgPos.x,
          startPosY: guideImgPos.y,
        };
      } else if (e.touches.length === 1 && guideImgScale > 1) {
        e.stopPropagation();
        guideImgTouchRef.current = {
          startDist: 0,
          startScale: guideImgScale,
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          startPosX: guideImgPos.x,
          startPosY: guideImgPos.y,
        };
      }
    },
    [guideImgScale, guideImgPos],
  );

  const handleGuideImgTouchMove = useCallback((e: React.TouchEvent) => {
    if (!guideImgTouchRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length === 2 && guideImgTouchRef.current.startDist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const newScale = Math.min(
        5,
        Math.max(1, guideImgTouchRef.current.startScale * (dist / guideImgTouchRef.current.startDist)),
      );
      setGuideImgScale(newScale);
    } else if (e.touches.length === 1 && guideImgTouchRef.current.startDist === 0) {
      const dx = e.touches[0].clientX - guideImgTouchRef.current.startX;
      const dy = e.touches[0].clientY - guideImgTouchRef.current.startY;
      setGuideImgPos({
        x: guideImgTouchRef.current.startPosX + dx,
        y: guideImgTouchRef.current.startPosY + dy,
      });
    }
  }, []);

  const handleGuideImgTouchEnd = useCallback(() => {
    guideImgTouchRef.current = null;
  }, []);

  return {
    guideOpen,
    setGuideOpen,
    guideStep,
    setGuideStep,
    guideImgExpanded,
    setGuideImgExpanded,
    guideImgScale,
    setGuideImgScale,
    guideImgPos,
    setGuideImgPos,
    guideSteps,
    handleGuideImgTouchStart,
    handleGuideImgTouchMove,
    handleGuideImgTouchEnd,
  };
}

export type MembersGuide = ReturnType<typeof useMembersGuide>;
