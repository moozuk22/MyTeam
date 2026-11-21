"use client";

import styles from "./DateInput.module.css";
import { useLayoutEffect, useRef, type CSSProperties, type InputHTMLAttributes, type KeyboardEvent, type MouseEvent } from "react";

/** Formats an ISO date (yyyy-mm-dd) as dd.mm.yyyy. Returns "" for any other value. */
export function formatDateInputValue(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join(".") : "";
}

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "placeholder"> & {
  /** ISO date (yyyy-mm-dd) or "". */
  value: string;
  onValueChange: (value: string) => void;
  /** Layout for the wrapper, for example flex sizing that the input had before. */
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
};

const px = (value: string) => Number.parseFloat(value) || 0;

function openPicker(input: HTMLInputElement) {
  if (input.disabled || input.readOnly) return;
  try { input.showPicker(); } catch { /* Keep the native field usable where showPicker is unavailable. */ }
}

/**
 * Native date field that always shows dd.mm.yyyy.
 * The native input keeps its styles, validation and calendar. Only its locale-specific text is hidden,
 * and a copy of its text metrics shows the formatted value on top of it.
 */
export function DateInput({ value, onValueChange, wrapperClassName, wrapperStyle, className, onClick, onKeyDown, ...props }: DateInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const overlay = useRef<HTMLSpanElement>(null);

  function sync() {
    const field = input.current;
    const text = overlay.current;
    if (!field || !text) return;
    const style = getComputedStyle(field);
    const align = style.textAlign === "center" ? "center" : style.textAlign === "right" || style.textAlign === "end" ? "flex-end" : "flex-start";
    Object.assign(text.style, {
      left: `${field.offsetLeft}px`, top: `${field.offsetTop}px`, right: "auto", bottom: "auto",
      width: `${field.offsetWidth}px`, height: `${field.offsetHeight}px`,
      paddingLeft: `${px(style.borderLeftWidth) + px(style.paddingLeft)}px`,
      paddingRight: `${px(style.borderRightWidth) + px(style.paddingRight)}px`,
      justifyContent: align, textIndent: style.textIndent,
      fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, fontStyle: style.fontStyle,
      letterSpacing: style.letterSpacing, color: style.color, opacity: style.opacity,
    });
  }

  // Styles can change with any render (disabled, focus, validation), so copy them after every render.
  useLayoutEffect(sync);
  useLayoutEffect(() => {
    const field = input.current;
    if (!field || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => sync());
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

  const display = formatDateInputValue(value);
  return <span className={`${styles.root} ${wrapperClassName ?? ""}`} style={wrapperStyle}>
    <input {...props} ref={input} type="date" value={value} className={`${className ?? ""} ${styles.native}`}
      onChange={(event) => onValueChange(event.target.value)}
      onFocus={(event) => { sync(); props.onFocus?.(event); }}
      onBlur={(event) => { sync(); props.onBlur?.(event); }}
      onClick={(event: MouseEvent<HTMLInputElement>) => { openPicker(event.currentTarget); onClick?.(event); }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        // Typing would fill the hidden locale-specific segments, so open the calendar instead.
        if (/^\d$/.test(event.key) || event.key === " ") { event.preventDefault(); openPicker(event.currentTarget); }
        onKeyDown?.(event);
      }} />
    <span ref={overlay} className={styles.overlay} aria-hidden="true">
      <span className={display ? undefined : styles.empty}>{display || "дд.мм.гггг"}</span>
    </span>
  </span>;
}
