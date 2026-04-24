"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "./page.css";

type FormState = {
  name: string;
  email: string;
};

const EMPTY_FORM: FormState = { name: "", email: "" };

export default function AdminEmailPageClient() {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<"confirmation" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [result]);

  function handleField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setResult(null);
  }

  async function handleSend() {
    if (sending) return;
    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setResult({ ok: true, message: "Имейлът беше изпратен успешно." });
        setForm(EMPTY_FORM);
      } else {
        const data = (await res.json()) as { error?: string };
        setResult({ ok: false, message: data.error ?? "Грешка при изпращане." });
      }
    } catch {
      setResult({ ok: false, message: "Грешка при свързване със сървъра." });
    } finally {
      setSending(false);
    }
  }

  const isFormValid = form.name.trim() && form.email.trim();

  return (
    <div className="ae-page">
      <div className="ae-inner">
        <div className="ae-header">
          <button
            type="button"
            className="ae-back-btn"
            onClick={() => router.push("/admin/players")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="m12 5-7 7 7 7" />
            </svg>
            Назад
          </button>
          <h1 className="ae-title">Изпрати имейл</h1>
        </div>

        <p className="ae-subtitle">Избери шаблон и попълни данните на получателя.</p>

        <div className="ae-templates-grid">
          <button
            type="button"
            className={`ae-template-card${selectedTemplate === "confirmation" ? " ae-template-card--selected" : ""}`}
            onClick={() => {
              setSelectedTemplate("confirmation");
              setResult(null);
            }}
          >
            <div className="ae-template-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <div className="ae-template-info">
              <span className="ae-template-name">Потвърждаващ имейл</span>
              <span className="ae-template-desc">Потвърждение за получено запитване</span>
            </div>
            {selectedTemplate === "confirmation" && (
              <div className="ae-template-check">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
            )}
          </button>

          <div className="ae-template-card ae-template-card--disabled">
            <div className="ae-template-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </div>
            <div className="ae-template-info">
              <span className="ae-template-name">Свободен текст</span>
              <span className="ae-template-desc">Персонализирано съобщение</span>
            </div>
            <div className="ae-template-badge">Очаква се</div>
          </div>
        </div>

        {selectedTemplate === "confirmation" && (
          <div className="ae-form-box">
            <p className="ae-form-label">ДАННИ НА ПОЛУЧАТЕЛЯ</p>

            <div className="ae-field">
              <label className="ae-field-label" htmlFor="ae-name">Име</label>
              <input
                id="ae-name"
                className="ae-field-input"
                type="text"
                placeholder="Иван Иванов"
                value={form.name}
                onChange={(e) => handleField("name", e.target.value)}
                disabled={sending}
              />
            </div>

            <div className="ae-field">
              <label className="ae-field-label" htmlFor="ae-email">Имейл</label>
              <input
                id="ae-email"
                className="ae-field-input"
                type="email"
                placeholder="example@email.com"
                value={form.email}
                onChange={(e) => handleField("email", e.target.value)}
                disabled={sending}
              />
            </div>

            {result && (
              <div
                ref={resultRef}
                className={`ae-result${result.ok ? " ae-result--ok" : " ae-result--err"}`}
              >
                {result.message}
              </div>
            )}

            <button
              type="button"
              className="ae-send-btn"
              onClick={() => void handleSend()}
              disabled={sending || !isFormValid}
            >
              {sending ? "Изпращане..." : "Изпрати имейл"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
