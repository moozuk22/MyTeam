"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "./page.css";

type TemplateId = "confirmation" | "manual";

type ConfirmationForm = { name: string; email: string };
type ManualForm = { email: string; subject: string; message: string };

const EMPTY_CONFIRMATION: ConfirmationForm = { name: "", email: "" };
const EMPTY_MANUAL: ManualForm = { email: "", subject: "", message: "" };

export default function AdminEmailPageClient() {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);
  const [confirmForm, setConfirmForm] = useState<ConfirmationForm>(EMPTY_CONFIRMATION);
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_MANUAL);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [result]);

  function handleConfirmField(field: keyof ConfirmationForm, value: string) {
    setConfirmForm((prev) => ({ ...prev, [field]: value }));
    setResult(null);
  }

  function handleManualField(field: keyof ManualForm, value: string) {
    setManualForm((prev) => ({ ...prev, [field]: value }));
    setResult(null);
  }

  async function handleSend() {
    if (sending) return;
    setSending(true);
    setResult(null);

    try {
      const payload =
        selectedTemplate === "manual"
          ? { template: "manual", ...manualForm }
          : { template: "confirmation", ...confirmForm };

      const res = await fetch("/api/admin/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setResult({ ok: true, message: "Имейлът беше изпратен успешно." });
        if (selectedTemplate === "manual") {
          setManualForm(EMPTY_MANUAL);
        } else {
          setConfirmForm(EMPTY_CONFIRMATION);
        }
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

  const isFormValid =
    selectedTemplate === "confirmation"
      ? !!(confirmForm.name.trim() && confirmForm.email.trim())
      : !!(manualForm.email.trim() && manualForm.subject.trim() && manualForm.message.trim());

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

          <button
            type="button"
            className={`ae-template-card${selectedTemplate === "manual" ? " ae-template-card--selected" : ""}`}
            onClick={() => {
              setSelectedTemplate("manual");
              setResult(null);
            }}
          >
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
            {selectedTemplate === "manual" && (
              <div className="ae-template-check">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
            )}
          </button>
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
                value={confirmForm.name}
                onChange={(e) => handleConfirmField("name", e.target.value)}
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
                value={confirmForm.email}
                onChange={(e) => handleConfirmField("email", e.target.value)}
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

        {selectedTemplate === "manual" && (
          <div className="ae-form-box">
            <p className="ae-form-label">СЪОБЩЕНИЕ</p>

            <div className="ae-field">
              <label className="ae-field-label" htmlFor="ae-manual-email">Имейл на получателя</label>
              <input
                id="ae-manual-email"
                className="ae-field-input"
                type="email"
                placeholder="example@email.com"
                value={manualForm.email}
                onChange={(e) => handleManualField("email", e.target.value)}
                disabled={sending}
              />
            </div>

            <div className="ae-field">
              <label className="ae-field-label" htmlFor="ae-manual-subject">Тема</label>
              <input
                id="ae-manual-subject"
                className="ae-field-input"
                type="text"
                placeholder="Тема на имейла"
                value={manualForm.subject}
                onChange={(e) => handleManualField("subject", e.target.value)}
                disabled={sending}
              />
            </div>

            <div className="ae-field">
              <label className="ae-field-label" htmlFor="ae-manual-message">Съобщение</label>
              <textarea
                id="ae-manual-message"
                className="ae-field-textarea"
                placeholder="Въведете текста на имейла..."
                value={manualForm.message}
                onChange={(e) => handleManualField("message", e.target.value)}
                disabled={sending}
                rows={6}
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
