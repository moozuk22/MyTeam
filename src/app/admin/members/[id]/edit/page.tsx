"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Card {
  id: string;
  cardCode: string;
  isActive: boolean;
}

interface MemberResponse {
  id: string;
  firstName: string;
  secondName: string;
  visitsTotal: number;
  visitsUsed: number;
  cards: Card[];
}

export default function EditMemberPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const memberId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigningCard, setAssigningCard] = useState(false);
  const [showAssignCardModal, setShowAssignCardModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [secondName, setSecondName] = useState("");
  const [visitsTotal, setVisitsTotal] = useState("0");
  const [visitsUsed, setVisitsUsed] = useState("0");
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    const fetchMember = async () => {
      try {
        const response = await fetch(`/api/admin/members/${memberId}`, { cache: "no-store" });
        if (!response.ok) {
          setError("Грешка при зареждане на члена.");
          return;
        }

        const member: MemberResponse = await response.json();
        setFirstName(member.firstName);
        setSecondName(member.secondName);
        setVisitsTotal(String(member.visitsTotal));
        setVisitsUsed(String(member.visitsUsed));
        setCards(member.cards ?? []);
      } catch (err) {
        console.error("Error fetching member:", err);
        setError("Грешка при зареждане на члена.");
      } finally {
        setLoading(false);
      }
    };

    if (memberId) {
      fetchMember();
    }
  }, [memberId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsedVisitsTotal = Number(visitsTotal);
    const parsedVisitsUsed = Number(visitsUsed);

    if (
      visitsTotal.trim() === "" ||
      visitsUsed.trim() === "" ||
      Number.isNaN(parsedVisitsTotal) ||
      Number.isNaN(parsedVisitsUsed)
    ) {
      setError("Посещенията трябва да са валидни числа.");
      return;
    }

    if (parsedVisitsTotal < 0 || parsedVisitsUsed < 0) {
      setError("Посещенията не могат да бъдат отрицателни.");
      return;
    }

    if (!firstName.trim()) {
      setError("Името е задължително.");
      return;
    }

    if (parsedVisitsUsed > parsedVisitsTotal) {
      setError("Използваните посещения не могат да са повече от общите.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          secondName: secondName.trim(),
          visitsTotal: parsedVisitsTotal,
          visitsUsed: parsedVisitsUsed,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Грешка при запазване на члена.");
        return;
      }

      router.push("/admin/members");
      router.refresh();
    } catch (err) {
      console.error("Error saving member:", err);
      setError("Грешка при запазване на члена.");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignNewCard = async () => {
    setError(null);
    setAssigningCard(true);

    try {
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "assign_new_card",
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Грешка при създаването на нова карта.");
        return;
      }

      const updatedMember: MemberResponse = await response.json();
      setCards(updatedMember.cards ?? []);
    } catch (err) {
      console.error("Error assigning a new card:", err);
      setError("Грешка при създаването на нова карта.");
    } finally {
      setAssigningCard(false);
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
    <div className="container p-6 fade-in" style={{ maxWidth: "700px" }}>
      <div className="card">
        <h1 className="text-gold mb-6" style={{ fontSize: "1.8rem" }}>Редакция на член</h1>

        {error && (
          <div className="alert alert-error mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-2 text-secondary">Име</label>
            <input
              className="input w-full"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={saving}
            />
          </div>

          <div>
            <label className="block mb-2 text-secondary">Фамилия</label>
            <input
              className="input w-full"
              value={secondName}
              onChange={(e) => setSecondName(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-secondary">Общо посещения</label>
              <input
                type="number"
                min={0}
                className="input w-full"
                value={visitsTotal}
                onChange={(e) => setVisitsTotal(e.target.value)}
                disabled={saving}
              />
            </div>

            <div>
              <label className="block mb-2 text-secondary">Използвани посещения</label>
              <input
                type="number"
                min={0}
                max={visitsTotal === "" ? undefined : Number(visitsTotal)}
                className="input w-full"
                value={visitsUsed}
                onChange={(e) => setVisitsUsed(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label className="block mb-2 text-secondary">Карти</label>
            <div className="flex flex-wrap gap-2">
              {cards.length === 0 && <span className="text-muted">Няма създадени карти.</span>}
              {cards.map((card) => (
                <span
                  key={card.id}
                  className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    card.isActive ? "bg-green-900 text-green-200" : "bg-red-900 text-red-200"
                  }`}
                >
                  {card.cardCode} ({card.isActive ? "Активна" : "Неактивна"})
                </span>
              ))}
            </div>
            <div className="mt-4">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowAssignCardModal(true)}
                disabled={saving || assigningCard}
              >
                {assigningCard ? "Създаване..." : "Създай нова карта"}
              </button>
              <p className="text-muted mt-4" style={{ fontSize: "0.85rem" }}>
                Създаването на нова карта ще деактивира всички предишни карти на този член.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2 mt-4">
            <button
              type="button"
              onClick={() => router.push("/admin/members")}
              className="btn btn-secondary w-full"
              disabled={saving}
            >
              Отказ
            </button>
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={saving}
            >
              {saving ? "Запазване..." : "Запази"}
            </button>
          </div>
        </form>
      </div>

      {showAssignCardModal && (
        <div className="modal-overlay">
          <div className="modal-content fade-in">
            <h3 className="text-gold mb-4">Потвърждение за нова карта</h3>
            <p className="mb-6">
              Сигурни ли сте, че искате да създай нова карта на този член?
              <br />
              <span className="text-error" style={{ fontSize: "0.85rem" }}>
                Това ще деактивира всички предишни карти и старите card URL адреси няма да работят.
              </span>
            </p>
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                className="btn btn-secondary px-6"
                onClick={() => setShowAssignCardModal(false)}
                disabled={assigningCard}
              >
                Отказ
              </button>
              <button
                type="button"
                className="btn btn-primary px-6"
                onClick={async () => {
                  setShowAssignCardModal(false);
                  await handleAssignNewCard();
                }}
                disabled={assigningCard}
              >
                {assigningCard ? "Създаване..." : "Създай нова карта"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
