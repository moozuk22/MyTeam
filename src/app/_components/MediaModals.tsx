"use client";

import type { CarouselImage } from "../_utils/landing-content";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Lightbox({ image, onClose }: { image: CarouselImage; onClose: () => void }) {
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

export function VideoModal({ onClose }: { onClose: () => void }) {
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
