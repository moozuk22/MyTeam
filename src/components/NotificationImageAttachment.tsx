"use client";

import { useEffect, useRef, useState } from "react";
import { MESSAGE_IMAGE_ACCEPT, MESSAGE_IMAGE_ERROR, validateMessageImage } from "@/lib/messageImage";
import styles from "./NotificationImageAttachment.module.css";

function ImagePreview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const element = image.current;
    const url = URL.createObjectURL(file);
    if (element) element.src = url;
    return () => {
      element?.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [file]);
  // This preview uses a local blob URL and does not upload the selected file.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} className={styles.preview} alt="Преглед на избраната снимка" />;
}

export function NotificationImageAttachment({ file, onChange, disabled }: {
  file: File | null; onChange: (file: File | null) => void; disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (!file && input.current) input.current.value = ""; }, [file]);
  return <div className={styles.attachment}>
    <label className={styles.label}>
      <span>Снимка към съобщението</span>
      <span className={styles.hint}>JPG, PNG или WebP, до 9 MB</span>
      <input ref={input} type="file" accept={MESSAGE_IMAGE_ACCEPT} disabled={disabled} onChange={event => {
        const next = event.target.files?.[0] ?? null;
        if (next && !validateMessageImage(next)) {
          setError(MESSAGE_IMAGE_ERROR);
          event.target.value = "";
          onChange(null);
          return;
        }
        setError("");
        onChange(next);
      }} />
    </label>
    {file && <ImagePreview file={file} />}
    {file && <button type="button" className={styles.remove} disabled={disabled} onClick={() => { onChange(null); setError(""); }}>Премахни снимката</button>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;
}
