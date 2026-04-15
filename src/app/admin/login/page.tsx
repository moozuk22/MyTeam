"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import "./page.css";

function AdminLoginPageContent() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next") ?? "";
  const safeNextPath =
    nextParam.startsWith("/admin") && !nextParam.startsWith("/admin/login")
      ? nextParam
      : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const destination = safeNextPath || "/admin/login";
        window.location.assign(destination);
      } else {
        const data = await response.json();
        setError(data.error || "Login failed");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="al-page">
      <div className="al-dot-grid" aria-hidden="true" />

      <div className="al-inner">
        <header className="al-header">
          <img src="/logo.png" alt="Logo" className="al-logo" />
          <h1 className="al-title">{"\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0441\u043a\u0438 \u0432\u0445\u043e\u0434"}</h1>
          <div className="al-title-line" />
        </header>

        <section className="al-card">
          <form className="al-form" onSubmit={handleSubmit}>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder={"\u0412\u044a\u0432\u0435\u0434\u0435\u0442\u0435 \u043f\u0430\u0440\u043e\u043b\u0430"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="al-input"
            />

            {error && <div className="al-error">{error}</div>}

            <button type="submit" disabled={loading} className="al-submit-btn">
              {loading
                ? "\u0412\u043b\u0438\u0437\u0430\u043d\u0435..."
                : "\u0412\u0445\u043e\u0434"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="al-page" />}>
      <AdminLoginPageContent />
    </Suspense>
  );
}
