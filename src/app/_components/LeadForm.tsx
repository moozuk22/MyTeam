"use client";

import type { MouseEvent } from "react";

import { useState } from "react";
import { Users, Trophy, ArrowRight, Phone, Mail, User } from "lucide-react";

export function LeadForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ club: "", name: "", email: "", phone: "", kids: "" });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setError("");

    // Validation: ensure all fields are filled
    if (!form.club || !form.name || !form.email || !form.phone || !form.kids) {
      setError("Моля попълнете всички полета.");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError("Моля въведете валиден имейл адрес.");
      return;
    }

    // Phone validation (simple check for digits and length)
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 9 || phoneDigits.length > 13) {
      setError("Моля въведете валиден телефонен номер.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          club: form.club,
          name: form.name,
          email: form.email,
          phone: form.phone,
          kids: form.kids
        })
      });

      if (response.ok) {
        onSuccess();
        setForm({ club: "", name: "", email: "", phone: "", kids: "" });
      } else {
        setError("Възникна грешка. Моля опитайте отново по-късно.");
      }
    } catch (err) {
      setError("Проблем с връзката. Моля проверете интернета си.");
    } finally {
      setLoading(false);
    }
  };

  const inp = (f: keyof typeof form) => ({
    className: `form-input ${focused === f ? "input-focused" : ""}`,
    onFocus: () => setFocused(f),
    onBlur: () => setFocused("")
  });

  return (
    <div className="lead-form-wrapper">
      <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
        {([
          { id: "club", label: "Име на спортен клуб", icon: Trophy, ph: "Име на вашия клуб" },
          { id: "name", label: "Вашето име", icon: User, ph: "Вашите три имена" },
          { id: "email", label: "Имейл адрес", icon: Mail, ph: "example@mail.com" },
          { id: "phone", label: "Телефон за връзка", icon: Phone, ph: "0XXXXXXXXX" },
          { id: "kids", label: "Приблизителен брой деца", icon: Users, ph: "пр. 150" }
        ] as const).map(i => (
          <div key={i.id} className="form-group">
            <label className="form-label"><i.icon size={12} /> {i.label}</label>
            <input
              type={i.id === "email" ? "email" : i.id === "phone" ? "tel" : i.id === "kids" ? "number" : "text"}
              placeholder={i.ph}
              value={form[i.id]}
              onChange={e => {
                const val = i.id === "phone" ? e.target.value.replace(/\D/g, "") : e.target.value;
                setForm({ ...form, [i.id]: val });
              }}
              {...inp(i.id)}
            />
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          color: "#FF3E3E",
          fontSize: 13,
          fontWeight: 600,
          marginTop: 20,
          textAlign: "center",
          background: "rgba(255, 62, 62, 0.1)",
          padding: "10px 16px",
          borderRadius: 10,
          border: "1px solid rgba(255, 62, 62, 0.2)"
        }}>
          ⚠️ {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading} className={`form-submit-btn ${loading ? "btn-loading" : ""}`} style={{ marginTop: 24 }}>
        {loading ? (
          <>
            <div className="loading-spinner" /> Изпращане...
          </>
        ) : (
          <>
            ВЗЕМИ БЕЗПЛАТНО ДЕМО <ArrowRight size={18} />
          </>
        )}
      </button>

      <div className="form-footer-note">🔒 Данните Ви са защитени. Получавате 30 дена гратисен период.</div>
    </div>
  );
}
