"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AddMemberPage() {
  const [firstName, setFirstName] = useState("");
  const [secondName, setSecondName] = useState("");
  const [visitsTotal, setVisitsTotal] = useState(8);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, secondName, visitsTotal }),
      });

      if (response.ok) {
        router.push("/admin/members");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create member");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error("Error creating member:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container p-6 fade-in add-user">
      <div className="text-center mb-8">
        <div className="text-gold mb-3" style={{ fontSize: '2.5rem' }}>♦</div>
        <h1 className="text-gold mb-2" style={{ fontSize: '2rem', fontWeight: '600' }}>
          Добави нов член
        </h1>
      </div>

      <div className="flex justify-center mb-8">
        <Link 
          href="/admin/members" 
          className="btn btn-secondary"
        >
          ← Обратно към членовете
        </Link>
      </div>

      <div className="member-card add-card" style={{ maxWidth: '500px', width: '100%' }}>
        <form onSubmit={handleCreateMember} className="space-y-6 text-center flex flex-col justify-center gap-3 w-75">
          <div className="text-left">
            <label className="text-secondary mb-2 block" style={{ fontSize: '1rem', fontWeight: '500' }}>
              Име
            </label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-3 bg-secondary border border-color rounded-lg text-primary placeholder-text-muted focus:outline-none focus:border-accent-gold transition-colors"
              placeholder="Въведете име"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div className="text-left">
            <label className="text-secondary mb-2 block" style={{ fontSize: '1rem', fontWeight: '500' }}>
              Фамилия
            </label>
            <input
              type="text"
              required
              value={secondName}
              onChange={(e) => setSecondName(e.target.value)}
              className="w-full px-4 py-3 bg-secondary border border-color rounded-lg text-primary placeholder-text-muted focus:outline-none focus:border-accent-gold transition-colors"
              placeholder="Въведете фамилия"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div className="text-left">
            <label className="text-secondary mb-2 block" style={{ fontSize: '1rem', fontWeight: '500' }}>
              Общо посещения
            </label>
            <input
              type="number"
              required
              min="1"
              value={visitsTotal}
              onChange={(e) => setVisitsTotal(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-secondary border border-color rounded-lg text-primary placeholder-text-muted focus:outline-none focus:border-accent-gold transition-colors"
              placeholder="Въведете брой посещения"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {error && (
            <div className="alert alert-error text-center">
              {error}
            </div>
          )}

          <div className="flex gap-4 pt-4 justify-center">
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
              {isSubmitting ? "Създаване..." : "Създай член"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
