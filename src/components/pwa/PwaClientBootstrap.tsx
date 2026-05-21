"use client";

import { useEffect } from "react";

export function PwaClientBootstrap() {
  useEffect(() => {
    const register = () => {
      void navigator.serviceWorker.register("/sw.js");
    };
    if ("serviceWorker" in navigator) {
      if (document.readyState === "complete") {
        register();
      } else {
        window.addEventListener("load", register, { once: true });
      }
    }

    return () => {
      window.removeEventListener("load", register);
    };
  }, []);

  useEffect(() => {
    const update = () => {
      const hasOverlay = document.querySelector(
        ".amp-overlay, .pm-overlay, .modal-overlay, .add-member-modal-overlay, .popup-overlay, .lightbox-overlay, .birthday-card-overlay, .receipt-overlay, .tp-overlay, .rd-overlay"
      ) !== null;
      document.documentElement.style.overflow = hasOverlay ? "hidden" : "";
    };

    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.documentElement.style.overflow = "";
    };
  }, []);

  return null;
}
