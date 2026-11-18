"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./BrowserDialog.module.css";

type Kind = "alert" | "confirm" | "prompt";
type Result = boolean | string | null | undefined;
type Request = { id: number; kind: Kind; message: string; initialValue: string; finish: (result: Result) => void };
type Open = (kind: Kind, message: string, initialValue: string, signal: AbortSignal) => Promise<Result>;
const DialogContext = createContext<Open | null>(null);

export type BrowserDialogs = {
  // A false result means that the component was removed before dismissal.
  alert: (message: string) => Promise<boolean>;
  confirm: (message: string) => Promise<boolean>;
  // An undefined result means that the component was removed. A null result means cancellation.
  prompt: (message: string, initialValue?: string) => Promise<string | null | undefined>;
};

export function useBrowserDialogs(): BrowserDialogs {
  const open = useContext(DialogContext);
  if (!open) throw new Error("BrowserDialogProvider is required");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current?.abort();
  }, []);
  return useMemo(() => {
    const request = (kind: Kind, message: string, initialValue = "") => {
      const signal = controller.current?.signal;
      return signal ? open(kind, message, initialValue, signal) : Promise.resolve(undefined);
    };
    return {
      alert: async (message: string) => (await request("alert", message)) !== undefined,
      confirm: async (message: string) => (await request("confirm", message)) === true,
      prompt: async (message: string, initialValue = "") => {
        const result = await request("prompt", message, initialValue);
        return typeof result === "string" || result === undefined ? result : null;
      },
    };
  }, [open]);
}

export function BrowserDialogProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Request | null>(null);
  const pending = useRef<Request[]>([]);
  const sequence = useRef(0);
  const open = useCallback<Open>((kind, message, initialValue, signal) => {
    if (signal.aborted) return Promise.resolve(undefined);
    return new Promise<Result>((resolve) => {
      const cancel = () => request.finish(undefined);
      const request: Request = { id: ++sequence.current, kind, message, initialValue, finish: (result) => {
        const index = pending.current.indexOf(request);
        if (index < 0) return;
        pending.current.splice(index, 1);
        signal.removeEventListener("abort", cancel);
        if (index === 0) setCurrent(pending.current[0] ?? null);
        resolve(result);
      } };
      pending.current.push(request);
      signal.addEventListener("abort", cancel, { once: true });
      if (pending.current.length === 1) setCurrent(request);
    });
  }, []);
  useEffect(() => () => [...pending.current].forEach((request) => request.finish(undefined)), []);
  return <DialogContext.Provider value={open}>
    {children}
    {current && createPortal(<BrowserDialog key={current.id} request={current} />, document.body)}
  </DialogContext.Provider>;
}

function BrowserDialog({ request }: { request: Request }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const initialButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [value, setValue] = useState(request.initialValue);
  useEffect(() => {
    const trigger = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    if (input.current) {
      input.current.focus();
      input.current.select();
    } else {
      initialButton.current?.focus();
    }
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`}
    onCancel={(event) => { event.preventDefault(); request.finish(null); }}>
    <form onSubmit={(event) => { event.preventDefault(); request.finish(request.kind === "prompt" ? value : true); }}>
      <header className={styles.header}>
        <h2 id={`${id}-title`}>{request.kind === "alert" ? "Съобщение" : request.kind === "prompt" ? "Име на файла" : "Потвърждение"}</h2>
        <button type="button" aria-label="Затвори" onClick={() => request.finish(null)}><X size={20} aria-hidden="true" /></button>
      </header>
      <p id={`${id}-message`} className={styles.message} tabIndex={0}>{request.message}</p>
      {request.kind === "prompt" && <input ref={input} className={styles.input} aria-labelledby={`${id}-message`} autoFocus value={value} onChange={(event) => setValue(event.target.value)} />}
      <footer className={styles.actions}>
        {request.kind !== "alert" && <button ref={request.kind === "confirm" ? initialButton : undefined} type="button" autoFocus={request.kind === "confirm"} onClick={() => request.finish(null)}>Отказ</button>}
        <button ref={request.kind === "alert" ? initialButton : undefined} type="submit" className={styles.primary} autoFocus={request.kind === "alert"}>{request.kind === "alert" ? "Разбрах" : request.kind === "prompt" ? "Изтегли" : "Потвърди"}</button>
      </footer>
    </form>
  </dialog>;
}
