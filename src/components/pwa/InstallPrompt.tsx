"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./InstallPrompt.module.css";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "myteam-install-dismissed-v1";

export function InstallPrompt() {
  const pendingPrompt = useRef<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const hide = () => {
      pendingPrompt.current = null;
      setVisible(false);
    };
    const onPrompt = (event: Event) => {
      if (standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone) return;
      try {
        if (sessionStorage.getItem(DISMISSED_KEY)) return;
      } catch {
        // Installation remains available when browser storage is blocked.
      }
      event.preventDefault();
      pendingPrompt.current = event as InstallEvent;
      setVisible(true);
    };
    const onDisplayChange = () => {
      if (standalone.matches) hide();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", hide);
    standalone.addEventListener("change", onDisplayChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", hide);
      standalone.removeEventListener("change", onDisplayChange);
      pendingPrompt.current = null;
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    pendingPrompt.current = null;
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Dismissal still works for this page when storage is blocked.
    }
  };

  const install = async () => {
    const event = pendingPrompt.current;
    if (!event) return;
    pendingPrompt.current = null;
    setVisible(false);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "dismissed") dismiss();
    } catch (error) {
      console.error("App installation prompt failed:", error);
    }
  };

  if (!visible) return null;

  return (
    <aside className={styles.banner} aria-label="Инсталиране на MyTeam">
      <div>
        <strong>Инсталирайте MyTeam</strong>
        <p>Отваряйте платформата директно от началния екран.</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.install} onClick={install}>Инсталиране</button>
        <button type="button" onClick={dismiss}>По-късно</button>
      </div>
    </aside>
  );
}
