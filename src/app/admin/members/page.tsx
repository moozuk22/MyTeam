"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Card {
  id: string;
  cardCode: string;
  isActive: boolean;
}

interface Member {
  id: string;
  firstName: string;
  secondName: string;
  visitsTotal: number;
  visitsUsed: number;
  card?: Card;
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchMembers = async () => {
    try {
      const response = await fetch("/api/admin/members");
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  if (loading) return (
    <div className="container flex items-center justify-center" style={{ minHeight: '100vh' }}>
      <div className="text-center">
        <div className="loading mb-4"></div>
        <p className="text-secondary">Зареждане на членове...</p>
      </div>
    </div>
  );

  return (
    <div className="container p-6 fade-in">
      <div className="text-center mb-8">
        <div className="text-gold mb-3" style={{ fontSize: '2.5rem' }}>♦</div>
        <h1 className="text-gold mb-2" style={{ fontSize: '2rem', fontWeight: '600' }}>
          Администраторски панел
        </h1>
      </div>

      <div className="flex justify-center gap-4 mb-8">
        <button 
          onClick={() => router.push("/admin/members/add")}
          className="btn btn-primary"
        >
          Добави член
        </button>
        <button 
          onClick={handleLogout}
          className="btn btn-secondary"
        >
          Изход
        </button>
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {members.map((member) => (
          <div key={member.id} className="card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-gold mb-1" style={{ fontSize: '1.2rem' }}>
                  {member.firstName} {member.secondName}
                </h3>
                <p className="text-muted" style={{ fontSize: '0.9rem' }}>ID: {member.id}</p>
              </div>
              <div className="text-gold" style={{ fontSize: '1.5rem' }}>♦</div>
            </div>

            <div className="visit-info mb-6">
              <div className="visit-item">
                <span className="visit-number">{member.visitsTotal}</span>
                <div className="visit-label">Карта</div>
              </div>
              <div className="visit-item">
                <span className="visit-number">{member.visitsUsed}</span>
                <div className="visit-label">Използвани</div>
              </div>
              <div className="visit-item">
                <span className="visit-number text-gold">
                  {member.visitsTotal - member.visitsUsed}
                </span>
                <div className="visit-label">Остават</div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-secondary text-sm mb-2">
                Карта: <span className="text-gold font-mono">{member.card?.cardCode || "Няма карта"}</span>
              </p>
              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                member.card?.isActive 
                  ? 'bg-green-900 text-green-200' 
                  : 'bg-red-900 text-red-200'
              }`}>
                {member.card?.isActive ? 'Активна' : 'Неактивна'}
              </span>
            </div>

            <button 
              onClick={() => {
                if (member.card?.cardCode) {
                  router.push(`/member/${member.card.cardCode}`);
                } else {
                  alert("Този член няма присвоена карта.");
                }
              }}
              className="btn btn-primary w-full"
            >
              Виж страницата
            </button>
          </div>
        ))}
        {members.length === 0 && (
          <div className="col-span-full text-center">
            <div className="alert alert-warning">
              <strong>Няма намерени членове</strong>
              <p className="mt-2 mb-0">Все още няма добавени членове в системата.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}