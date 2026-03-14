"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AddMemberPage() {
  const [fullName, setFullName] = useState("");
  const [clubId, setClubId] = useState("");
  const [status, setStatus] = useState<"paid" | "warning" | "overdue">("paid");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [teamGroup, setTeamGroup] = useState("");
  const [lastPaymentDate, setLastPaymentDate] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleCreateMember = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const payload: Record<string, string> = {
        fullName: fullName.trim(),
        status,
      };

      if (clubId.trim()) payload.clubId = clubId.trim();
      if (jerseyNumber.trim()) payload.jerseyNumber = jerseyNumber.trim();
      if (birthDate.trim()) payload.birthDate = birthDate.trim();
      if (teamGroup.trim()) payload.teamGroup = teamGroup.trim();
      if (lastPaymentDate.trim()) payload.lastPaymentDate = lastPaymentDate.trim();
      if (avatarUrl.trim()) payload.avatarUrl = avatarUrl.trim();

      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.push("/admin/members");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create player");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error("Error creating player:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container p-6 fade-in add-user">
      <div className="flex-col flex items-center text-center mb-8">
        <img
          src="/logo.png"
          alt="Logo"
          className="mb-3 mx-auto"
          style={{ width: "100px", height: "100px", objectFit: "contain" }}
        />
        <h1 className="text-gold mb-2" style={{ fontSize: "2rem", fontWeight: "600" }}>
          Add New Player
        </h1>
      </div>

      <div className="flex justify-center mb-8">
        <Link href="/admin/members" className="btn btn-secondary">
          Back to Members
        </Link>
      </div>

      <div className="member-card add-card" style={{ maxWidth: "500px", width: "100%" }}>
        <form onSubmit={handleCreateMember} className="space-y-6 text-center flex flex-col justify-center gap-3 w-75">
          <div className="text-left">
            <label className="text-secondary mb-2 block" style={{ fontSize: "1rem", fontWeight: "500" }}>
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 bg-secondary border border-color rounded-lg text-primary placeholder-text-muted focus:outline-none focus:border-accent-gold transition-colors"
              placeholder="Enter full name"
            />
          </div>

          <div className="text-left">
            <label className="text-secondary mb-2 block" style={{ fontSize: "1rem", fontWeight: "500" }}>
              Club ID (optional if exactly one club exists)
            </label>
            <input
              type="text"
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              className="w-full px-4 py-3 bg-secondary border border-color rounded-lg text-primary placeholder-text-muted focus:outline-none focus:border-accent-gold transition-colors"
              placeholder="Club UUID"
            />
          </div>

          <div className="text-left text-secondary" style={{ fontSize: "0.9rem" }}>
            Card code is generated automatically when the player is created.
          </div>

          <div className="text-left">
            <label className="text-secondary mb-2 block" style={{ fontSize: "1rem", fontWeight: "500" }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "paid" | "warning" | "overdue")}
              className="w-full px-4 py-3 bg-secondary border border-color rounded-lg text-primary focus:outline-none focus:border-accent-gold transition-colors"
            >
              <option value="paid">paid</option>
              <option value="warning">warning</option>
              <option value="overdue">overdue</option>
            </select>
          </div>

          <div className="text-left">
            <label className="text-secondary mb-2 block" style={{ fontSize: "1rem", fontWeight: "500" }}>
              Jersey Number
            </label>
            <input
              type="text"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              className="w-full px-4 py-3 bg-secondary border border-color rounded-lg text-primary placeholder-text-muted focus:outline-none focus:border-accent-gold transition-colors"
              placeholder="Optional"
            />
          </div>

          <div className="text-left">
            <label className="text-secondary mb-2 block" style={{ fontSize: "1rem", fontWeight: "500" }}>
              Birth Date
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-4 py-3 bg-secondary border border-color rounded-lg text-primary focus:outline-none focus:border-accent-gold transition-colors"
            />
          </div>

          <div className="text-left">
            <label className="text-secondary mb-2 block" style={{ fontSize: "1rem", fontWeight: "500" }}>
              Team Group
            </label>
            <input
              type="number"
              min="1"
              value={teamGroup}
              onChange={(e) => setTeamGroup(e.target.value)}
              className="w-full px-4 py-3 bg-secondary border border-color rounded-lg text-primary placeholder-text-muted focus:outline-none focus:border-accent-gold transition-colors"
              placeholder="Optional"
            />
          </div>

          <div className="text-left">
            <label className="text-secondary mb-2 block" style={{ fontSize: "1rem", fontWeight: "500" }}>
              Avatar URL
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full px-4 py-3 bg-secondary border border-color rounded-lg text-primary placeholder-text-muted focus:outline-none focus:border-accent-gold transition-colors"
              placeholder="https://..."
            />
          </div>

          {error && <div className="alert alert-error text-center">{error}</div>}

          <div className="flex gap-4 pt-4 justify-center">
            <button
              type="button"
              onClick={() => router.push("/admin/members")}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary flex-1"
              style={{ cursor: isSubmitting ? "not-allowed" : "pointer" }}
            >
              {isSubmitting ? "Creating..." : "Create Player"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
