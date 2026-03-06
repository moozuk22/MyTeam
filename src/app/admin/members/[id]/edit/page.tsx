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
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [secondName, setSecondName] = useState("");
  const [visitsTotal, setVisitsTotal] = useState(0);
  const [visitsUsed, setVisitsUsed] = useState(0);
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    const fetchMember = async () => {
      try {
        const response = await fetch(`/api/admin/members/${memberId}`, { cache: "no-store" });
        if (!response.ok) {
          setError("Failed to load member.");
          return;
        }

        const member: MemberResponse = await response.json();
        setFirstName(member.firstName);
        setSecondName(member.secondName);
        setVisitsTotal(member.visitsTotal);
        setVisitsUsed(member.visitsUsed);
        setCards(member.cards ?? []);
      } catch (err) {
        console.error("Error fetching member:", err);
        setError("Failed to load member.");
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

    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }

    if (visitsUsed > visitsTotal) {
      setError("Used visits cannot be greater than total visits.");
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
          visitsTotal,
          visitsUsed,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Failed to save member.");
        return;
      }

      router.push("/admin/members");
      router.refresh();
    } catch (err) {
      console.error("Error saving member:", err);
      setError("Failed to save member.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <div className="text-center">
          <div className="loading mb-4"></div>
          <p className="text-secondary">Loading member...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container p-6 fade-in" style={{ maxWidth: "700px" }}>
      <div className="card">
        <h1 className="text-gold mb-6" style={{ fontSize: "1.8rem" }}>Edit Member</h1>

        {error && (
          <div className="alert alert-error mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-2 text-secondary">First Name</label>
            <input
              className="input w-full"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={saving}
            />
          </div>

          <div>
            <label className="block mb-2 text-secondary">Second Name</label>
            <input
              className="input w-full"
              value={secondName}
              onChange={(e) => setSecondName(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-secondary">Total Visits</label>
              <input
                type="number"
                min={0}
                className="input w-full"
                value={visitsTotal}
                onChange={(e) => setVisitsTotal(Number(e.target.value))}
                disabled={saving}
              />
            </div>

            <div>
              <label className="block mb-2 text-secondary">Used Visits</label>
              <input
                type="number"
                min={0}
                max={visitsTotal}
                className="input w-full"
                value={visitsUsed}
                onChange={(e) => setVisitsUsed(Number(e.target.value))}
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label className="block mb-2 text-secondary">Cards</label>
            <div className="flex flex-wrap gap-2">
              {cards.length === 0 && <span className="text-muted">No cards assigned.</span>}
              {cards.map((card) => (
                <span
                  key={card.id}
                  className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    card.isActive ? "bg-green-900 text-green-200" : "bg-red-900 text-red-200"
                  }`}
                >
                  {card.cardCode} ({card.isActive ? "Active" : "Inactive"})
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push("/admin/members")}
              className="btn btn-secondary w-full"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
