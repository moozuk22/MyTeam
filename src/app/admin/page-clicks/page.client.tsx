"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./page.css";

interface ClickEntry {
  id: string;
  clickedAt: string;
}

export default function PageClicksClient() {
  const router = useRouter();
  const [total, setTotal] = useState<number | null>(null);
  const [clicks, setClicks] = useState<ClickEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/page-clicks", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { total?: number; clicks?: ClickEntry[] }) => {
        setTotal(data.total ?? 0);
        setClicks(Array.isArray(data.clicks) ? data.clicks : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("bg-BG", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <main className="pc-page">
      <div className="pc-dot-grid" aria-hidden="true" />
      <div className="pc-inner">
        <button className="pc-back-btn" type="button" onClick={() => router.push("/admin/players")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Назад
        </button>

        <div className="pc-header">
          <h1 className="pc-title">Кликове на началната страница</h1>
          <p className="pc-subtitle">Статистика за посещенията на /</p>
          <div className="pc-title-line" />
        </div>

        <div className="pc-stat-card">
          <p className="pc-stat-label">Общо кликове</p>
          <p className="pc-stat-num">{loading ? "—" : (total ?? 0)}</p>
        </div>

        <div className="pc-history">
          <h2 className="pc-history-title">История</h2>
          {loading && <p className="pc-empty">Зареждане...</p>}
          {!loading && clicks.length === 0 && (
            <p className="pc-empty">Няма записани кликове.</p>
          )}
          {!loading && clicks.length > 0 && (
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Дата и час</th>
                  </tr>
                </thead>
                <tbody>
                  {clicks.map((click, i) => (
                    <tr key={click.id}>
                      <td className="pc-td-num">{i + 1}</td>
                      <td>{formatDate(click.clickedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
