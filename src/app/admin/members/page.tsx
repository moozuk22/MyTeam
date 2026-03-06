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
  cards: Card[];
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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

  const handleDelete = async () => {
    if (!deletingMember) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/members/${deletingMember.id}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        setMembers(members.filter(m => m.id !== deletingMember.id));
        setDeletingMember(null);
      } else {
        alert("Грешка при изтриване на член.");
      }
    } catch (err) {
      console.error("Error deleting member:", err);
      alert("Грешка при изтриване на член.");
    } finally {
      setIsDeleting(false);
    }
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
                Карти: {member.cards.length === 0 && <span className="text-muted">Няма карти</span>}
                {member.cards.map((card, idx) => (
                  <span key={card.id} className="text-gold font-mono">
                    {card.cardCode}{idx < member.cards.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </p>
              <div className="flex flex-wrap gap-1">
                {member.cards.map((card) => (
                  <span key={card.id} className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    card.isActive 
                      ? 'bg-green-900 text-green-200' 
                      : 'bg-red-900 text-red-200'
                  }`}>
                    {card.cardCode}: {card.isActive ? 'Активна' : 'Неактивна'}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/admin/members/${member.id}/edit`)}
                className="btn btn-secondary w-full"
              >
                Edit
              </button>
              <button 
                onClick={() => {
                  if (member.cards.length > 0) {
                    router.push(`/member/${member.cards[0].cardCode}`);
                  } else {
                    alert("Този член няма присвоена карта.");
                  }
                }}
                className="btn btn-primary w-full"
              >
                Виж страницата
              </button>
              <button 
                onClick={() => setDeletingMember(member)}
                className="btn btn-error w-full"
              >
                Изтрий член
              </button>
            </div>
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

      {/* Confirmation Modal */}
      {deletingMember && (
        <div className="modal-overlay">
          <div className="modal-content fade-in">
            <h3 className="text-gold mb-4">Потвърждение</h3>
            <p className="mb-6">
              Сигурни ли сте, че искате да изтриете член <br />
              <strong>{deletingMember.firstName} {deletingMember.secondName}</strong>?
              <br />
              <span className="text-error" style={{ fontSize: '0.85rem' }}>
                Това действие е необратимо и ще изтрие и свързаната карта.
              </span>
            </p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => setDeletingMember(null)}
                className="btn btn-secondary px-6"
                disabled={isDeleting}
              >
                Отказ
              </button>
              <button 
                onClick={handleDelete}
                className="btn btn-error px-6"
                disabled={isDeleting}
              >
                {isDeleting ? "Изтриване..." : "Изтрий"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
