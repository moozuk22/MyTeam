"use client";

import styles from "./TimeInput.module.css";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type InputHTMLAttributes, type PointerEvent } from "react";
import { createPortal } from "react-dom";

const desktopQuery = "(min-width: 769px) and (hover: hover) and (pointer: fine)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getSnapshot = () => window.matchMedia(desktopQuery).matches;
const getServerSnapshot = () => false;
const pad = (value: number) => String(value).padStart(2, "0");

type TimeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function ClockPicker({ value, onSet, onClear, onClose, id }: {
  id?: string; value: string; onSet: (value: string) => void; onClear: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ pointerId: number; mode: "hour" | "minute" } | null>(null);
  const [hour, setHour] = useState(Number(value.split(":")[0]) || 0);
  const [minute, setMinute] = useState(Number(value.split(":")[1]) || 0);
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const selected = mode === "hour" ? hour : minute;
  const radius = mode === "hour" && (hour === 0 || hour > 12) ? 65 : 100;
  const angle = (mode === "hour" ? hour % 12 / 12 : minute / 60) * Math.PI * 2;
  const choose = (value: number) => {
    if (mode === "hour") { setHour(value); setMode("minute"); }
    else setMinute(value);
  };
  const updateFromPointer = (event: PointerEvent<HTMLDivElement>, mode: "hour" | "minute") => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left - bounds.width / 2) * 256 / bounds.width;
    const y = (event.clientY - bounds.top - bounds.height / 2) * 256 / bounds.height;
    const turn = (Math.atan2(x, -y) / (2 * Math.PI) + 1) % 1;
    if (mode === "minute") setMinute(Math.round(turn * 60) % 60);
    else {
      const tick = Math.round(turn * 12) % 12;
      setHour(Math.hypot(x, y) < 82 ? (tick === 0 ? 0 : tick + 12) : (tick || 12));
    }
  };
  const values = mode === "hour"
    ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
    : Array.from({ length: 12 }, (_, index) => index * 5);
  return (
    <dialog id={id} ref={dialog} className={styles.picker} aria-label="Избор на час" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <button type="button" className={mode === "hour" ? styles.active : ""} aria-label="Избери час" onClick={() => setMode("hour")}>{pad(hour)}</button>
          <span>:</span>
          <button type="button" className={mode === "minute" ? styles.active : ""} aria-label="Избери минути" onClick={() => setMode("minute")}>{pad(minute)}</button>
        </div>
        <p className={styles.hint}>{mode === "hour" ? "Изберете час" : "Изберете минути"}</p>
        <div className={styles.face} role="group" aria-label={mode === "hour" ? "Часове 00–23" : "Минути 00–59"} tabIndex={0}
          onKeyDown={event => {
            if (!["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) return;
            event.preventDefault();
            const delta = event.key === "ArrowUp" || event.key === "ArrowRight" ? 1 : -1;
            if (mode === "hour") setHour((hour + delta + 24) % 24);
            else setMinute((minute + delta + 60) % 60);
          }}
          onPointerDown={event => {
            if (event.button !== 0 || !event.isPrimary) return;
            event.preventDefault();
            event.currentTarget.focus();
            drag.current = { pointerId: event.pointerId, mode };
            event.currentTarget.setPointerCapture(event.pointerId);
            updateFromPointer(event, mode);
          }}
          onPointerMove={event => {
            if (drag.current?.pointerId === event.pointerId) updateFromPointer(event, drag.current.mode);
          }}
          onPointerUp={event => {
            if (drag.current?.pointerId !== event.pointerId) return;
            const finishedMode = drag.current.mode;
            updateFromPointer(event, finishedMode);
            drag.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
            if (finishedMode === "hour") setMode("minute");
          }}
          onPointerCancel={() => { drag.current = null; }}
          onLostPointerCapture={() => { drag.current = null; }}>
          <svg className={styles.hand} viewBox="0 0 256 256" aria-hidden="true">
            <line x1="128" y1="128" x2={128 + Math.sin(angle) * radius} y2={128 - Math.cos(angle) * radius} />
            <circle cx="128" cy="128" r="3" />
            <circle cx={128 + Math.sin(angle) * radius} cy={128 - Math.cos(angle) * radius} r="19" />
          </svg>
          {values.map(value => {
            const inner = mode === "hour" && (value === 0 || value > 12);
            const angle = (mode === "hour" ? value % 12 / 12 : value / 60) * Math.PI * 2;
            const radius = inner ? 65 : 100;
            return <button key={value} type="button" aria-label={`${mode === "hour" ? "Час" : "Минути"} ${pad(value)}`} aria-pressed={selected === value}
              className={`${styles.tick} ${inner ? styles.inner : ""} ${selected === value ? styles.selected : ""}`}
              style={{ left: `${50 + Math.sin(angle) * radius / 256 * 100}%`, top: `${50 - Math.cos(angle) * radius / 256 * 100}%` }}
              onClick={event => { if (event.detail === 0) choose(value); }}>{mode === "minute" || value === 0 ? pad(value) : value}</button>;
          })}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.clear} onClick={onClear}>Изчисти</button>
          <button type="button" onClick={onClose}>Отказ</button>
          <button type="button" onClick={() => onSet(`${pad(hour)}:${pad(minute)}`)}>Задай</button>
        </div>
      </div>
    </dialog>
  );
}

export function TimeInput({ value, onValueChange, ...props }: TimeInputProps) {
  const desktop = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const input = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    // Restore focus after the dialog's cleanup has closed and removed it.
    if (!open && wasOpen.current) input.current?.focus();
    wasOpen.current = open;
  }, [open]);
  if (!desktop) return <input {...props} type="time" value={value} onChange={event => onValueChange(event.target.value)} />;
  const close = () => { setOpen(false); };
  return <>
    <input {...props} ref={input} type="text" readOnly value={value} placeholder={props.placeholder ?? "Изберете час"} aria-label={props["aria-label"] ?? "Час (24-часов формат)"}
      className={`${props.className ?? ""} ${styles.trigger}`} role="combobox" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined}
      onClick={() => setOpen(true)} onKeyDown={event => {
        if (["Enter", " ", "ArrowDown"].includes(event.key)) { event.preventDefault(); setOpen(true); }
      }} />
    {open && !props.disabled && createPortal(<ClockPicker id={dialogId} value={value} onClose={close} onClear={() => { onValueChange(""); close(); }} onSet={value => { onValueChange(value); close(); }} />, document.body)}
  </>;
}
