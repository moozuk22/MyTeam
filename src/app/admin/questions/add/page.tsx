'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddQuestionPage() {
  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          isActive: true
        }),
      });

      if (response.ok) {
        localStorage.setItem("questions_updated_at", String(Date.now()));
        router.push("/admin/members");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create question");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error("Error creating question:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center container p-6 fade-in">
      <div className="flex flex-col items-center text-center mb-8">
        <img
          src="/myteam-logo.webp"
          alt="Logo"
          className="mb-3 mx-auto"
          style={{ width: '100px', height: '100px', objectFit: 'contain' }}
        />
        <h1 className="text-gold mb-2" style={{ fontSize: '2rem', fontWeight: '600' }}>
          Добави въпрос
        </h1>
      </div>

      <div className="flex justify-center mb-8">
        <button
          onClick={() => router.push("/admin/members")}
          className="btn btn-secondary"
        >
          ← Обратно към админ панела
        </button>
      </div>

      <div className="flex flex-col items-center member-card" style={{ maxWidth: '500px', width: '100%' }}>
        <form onSubmit={handleSubmit} className="space-y-6 text-center flex flex-col justify-center gap-3 w-75">
          <div className="text-left w-full">
            <label className="text-secondary mb-2 block" style={{ fontSize: '1rem', fontWeight: '500' }}>
              Въпрос
            </label>
            <textarea
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              style={{
                width: '100%',
                padding: '16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
                minHeight: '120px',
                resize: 'vertical',
                fontSize: '16px',
                fontFamily: 'inherit',
                lineHeight: '1.5'
              }}
              placeholder="Въведете въпроса тук..."
              rows={4}
            />
          </div>

          {error && (
            <div className="alert alert-error text-center">
              {error}
            </div>
          )}

          <div className="flex justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.push("/admin/members")}
              className="btn btn-secondary flex-1"
            >
              Отказ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary flex-1"
              style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            >
              {isSubmitting ? "Създаване..." : "Създай въпрос"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
