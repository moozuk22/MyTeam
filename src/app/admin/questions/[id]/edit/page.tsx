"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface QuestionResponse {
  id: string;
  text: string;
  isActive: boolean;
}

export default function EditQuestionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const questionId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        const response = await fetch(`/api/admin/questions/${questionId}`, { cache: "no-store" });
        if (!response.ok) {
          setError("Грешка при зареждане на въпроса.");
          return;
        }

        const question: QuestionResponse = await response.json();
        setText(question.text ?? "");
        setIsActive(Boolean(question.isActive));
      } catch (err) {
        console.error("Error fetching question:", err);
        setError("Грешка при зареждане на въпроса.");
      } finally {
        setLoading(false);
      }
    };

    if (questionId) {
      void fetchQuestion();
    }
  }, [questionId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!text.trim()) {
      setError("Въпросът е задължителен.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          isActive,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Грешка при запазване.");
        return;
      }

      localStorage.setItem("questions_updated_at", String(Date.now()));
      router.push("/admin/members");
      router.refresh();
    } catch (err) {
      console.error("Error saving question:", err);
      setError("Грешка при запазване.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <div className="text-center">
          <div className="loading mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container p-6 fade-in" style={{ maxWidth: "700px", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ width: "100%" }}>
        <h1 className="text-gold mb-6" style={{ fontSize: "1.8rem" }}>Редакция на въпрос</h1>

        {error && <div className="alert alert-error mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-2 text-secondary">Въпрос</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={saving}
              rows={5}
              style={{
                width: "100%",
                padding: "16px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                color: "var(--text-primary)",
                resize: "vertical",
                fontSize: "16px",
                fontFamily: "inherit",
                lineHeight: "1.5",
              }}
            />
          </div>

          <div>
            <label className="block mb-2 text-secondary">Статус</label>
            <select
              value={isActive ? "active" : "inactive"}
              onChange={(e) => setIsActive(e.target.value === "active")}
              disabled={saving}
              className="input w-full"
            >
              <option value="active">Активен</option>
              <option value="inactive">Неактивен</option>
            </select>
          </div>

          <div className="flex justify-center gap-3 pt-2 mt-4">
            <button
              type="button"
              onClick={() => router.push("/admin/members")}
              className="btn btn-secondary w-full"
              disabled={saving}
            >
              Отказ
            </button>
            <button type="submit" className="btn btn-primary w-full" disabled={saving}>
              {saving ? "Запазване..." : "Запази"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
