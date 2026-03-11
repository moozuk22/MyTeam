"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type NotificationType = "training_reminder" | "trainer_message";

interface MemberOption {
  id: string;
  firstName: string;
  secondName: string;
}

function formatMemberLabel(member: MemberOption) {
  return `${member.firstName} ${member.secondName}`.trim();
}

function isValid24HourTime(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [rawResponse, setRawResponse] = useState<string>("");

  const [type, setType] = useState<NotificationType>("trainer_message");
  const [broadcast, setBroadcast] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [trainingTime, setTrainingTime] = useState("");
  const [trainerMessage, setTrainerMessage] = useState("");

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const response = await fetch("/api/admin/members", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Неуспешно зареждане на членове");
        }

        const payload = (await response.json()) as MemberOption[];
        setMembers(payload);
      } catch (error) {
        console.error("Members load error:", error);
        setErrorMessage("Неуспешно зареждане на членове.");
      } finally {
        setIsLoadingMembers(false);
      }
    };

    void loadMembers();
  }, []);

  const isTrainingReminder = type === "training_reminder";
  const isTrainerMessage = type === "trainer_message";

  const filteredMembers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();
    if (!query) {
      return members.slice(0, 20);
    }

    return members
      .filter((member) => {
        const fullName = formatMemberLabel(member).toLowerCase();
        return fullName.includes(query) || member.id.toLowerCase().includes(query);
      })
      .slice(0, 20);
  }, [memberQuery, members]);

  const canSubmit = useMemo(() => {
    if (isLoadingMembers || isSending) {
      return false;
    }
    if (!broadcast && selectedMemberIds.length === 0) {
      return false;
    }
    if (isTrainerMessage && trainerMessage.trim() === "") {
      return false;
    }
    return true;
  }, [broadcast, isLoadingMembers, isSending, isTrainerMessage, selectedMemberIds, trainerMessage]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setRawResponse("");
    setIsSending(true);

    try {
      const requestBody: Record<string, unknown> = {
        type,
        broadcast,
      };

      if (!broadcast) {
        requestBody.memberIds = selectedMemberIds;
      }

      if (isTrainingReminder && trainingTime.trim() && !isValid24HourTime(trainingTime.trim())) {
        throw new Error("Невалиден час. Използвайте 24-часов формат HH:mm.");
      }

      if (isTrainingReminder && trainingDate.trim()) {
        requestBody.trainingDate =
          trainingTime.trim() !== ""
            ? `${trainingDate.trim()} ${trainingTime.trim()}`
            : trainingDate.trim();
      }
      if (isTrainerMessage && trainerMessage.trim()) {
        requestBody.trainerMessage = trainerMessage.trim();
      }

      const response = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json().catch(() => ({}));
      setRawResponse(JSON.stringify(payload, null, 2));

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Неуспешно изпращане на известие."
        );
      }

      setSuccessMessage("Известието е изпратено.");
    } catch (error) {
      console.error("Manual notification send error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Неуспешно изпращане на известие."
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="container p-4 fade-in">
      <div className="flex-col flex items-center text-center mb-8">
        <h1 className="text-gold mb-2" style={{ fontSize: "2rem", fontWeight: "600" }}>
          Ръчни известия
        </h1>
        <button type="button" className="btn btn-secondary" onClick={() => router.push("/admin/members")}>
          Назад към админ
        </button>
      </div>

      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: "600px", margin: "0 auto" }}>
        <div className="mb-4">
          <label htmlFor="notificationType" className="text-secondary" style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
            Тип на известието
          </label>
          <select
            id="notificationType"
            className="input w-full"
            value={type}
            onChange={(event) => setType(event.target.value as NotificationType)}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--accent-gold-color)",
              borderRadius: "8px",
              padding: "12px",
              color: "var(--text-primary)",
              fontSize: "16px"
            }}
          >
            <option value="trainer_message">Съобщение</option>
            <option value="training_reminder">Напомняне за тренировка</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="text-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={broadcast} 
              onChange={(event) => setBroadcast(event.target.checked)}
              style={{ 
                width: "18px", 
                height: "18px", 
                accentColor: "var(--accent-gold-color)",
                cursor: "pointer"
              }} 
            />
            <span style={{ fontWeight: "600" }}>Изпрати до всички</span>
          </label>
        </div>

        {!broadcast && (
          <div className="mb-4">
            <label htmlFor="memberSearch" className="text-secondary" style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
              Изберете членове
            </label>
            <input
              id="memberSearch"
              className="input w-full"
              placeholder="Търси по име или ID..."
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
              disabled={isLoadingMembers}
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--accent-gold-color)",
                borderRadius: "8px",
                padding: "12px",
                color: "var(--text-primary)",
                fontSize: "16px"
              }}
            />

            <div
              style={{
                marginTop: "8px",
                border: "1px solid var(--accent-gold-color)",
                borderRadius: "12px",
                maxHeight: "240px",
                overflowY: "auto",
                background: "var(--bg-secondary)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)"
              }}
            >
              {filteredMembers.length === 0 && (
                <div style={{ padding: "16px", color: "var(--text-secondary)", textAlign: "center" }}>
                  {isLoadingMembers ? "Зареждане..." : "Няма намерени членове."}
                </div>
              )}
              {filteredMembers.map((member, index) => {
                const isSelected = selectedMemberIds.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      setSelectedMemberIds((previous) =>
                        previous.includes(member.id)
                          ? previous.filter((id) => id !== member.id)
                          : [...previous, member.id]
                      );
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 16px",
                      border: "none",
                      borderBottom:
                        index < filteredMembers.length - 1 ? "1px solid var(--border-color)" : "none",
                      cursor: "pointer",
                      background: isSelected 
                        ? "linear-gradient(135deg, rgba(201, 168, 76, 0.2), rgba(232, 201, 109, 0.1))" 
                        : "transparent",
                      color: isSelected ? "var(--accent-gold-color)" : "var(--text-primary)",
                      transition: "all 0.2s ease",
                      fontSize: "14px"
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "rgba(201, 168, 76, 0.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: "2px" }}>
                      {formatMemberLabel(member)}
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedMemberIds.length > 0 && (
              <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {selectedMemberIds.map((id) => {
                  const member = members.find((item) => item.id === id);
                  if (!member) {
                    return null;
                  }
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setSelectedMemberIds((previous) => previous.filter((memberId) => memberId !== id))
                      }
                      style={{
                        border: "1px solid var(--accent-gold-color)",
                        borderRadius: "9999px",
                        padding: "6px 12px",
                        background: "rgba(201, 168, 76, 0.12)",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      {formatMemberLabel(member)} ×
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isTrainingReminder && (
          <div className="mb-4">
            <label htmlFor="trainingDate" className="text-secondary" style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
              Ден и час на тренировката
            </label>
            <div className="flex gap-3" style={{ flexWrap: "wrap" }}>
              <input
                id="trainingDate"
                type="date"
                className="input"
                style={{ 
                  flex: "1 1 60px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--accent-gold-color)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "var(--text-primary)",
                  fontSize: "14px"
                }}
                value={trainingDate}
                onChange={(event) => setTrainingDate(event.target.value)}
              />
              <input
                id="trainingTime"
                type="time"
                className="input"
                style={{ 
                  flex: "1 1 60px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--accent-gold-color)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "var(--text-primary)",
                  fontSize: "14px"
                }}
                step={60}
                value={trainingTime}
                onChange={(event) => setTrainingTime(event.target.value)}
              />
            </div>
          </div>
        )}

        {isTrainerMessage && (
          <div className="mb-4">
            <label htmlFor="trainerMessage" className="text-secondary" style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
              Съобщение
            </label>
            <textarea
              id="trainerMessage"
              className="input w-full"
              style={{ 
                width: "100%",
                maxWidth: "100%",
                minHeight: "150px", 
                resize: "vertical",
                background: "var(--bg-secondary)",
                border: "1px solid var(--accent-gold-color)",
                borderRadius: "8px",
                padding: "12px",
                color: "var(--text-primary)",
                fontSize: "16px",
                fontFamily: "inherit",
                boxSizing: "border-box"
              }}
              value={trainerMessage}
              onChange={(event) => setTrainerMessage(event.target.value)}
              placeholder="Въведете вашето съобщение..."
            />
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success mb-4" style={{ 
            background: "rgba(76, 175, 80, 0.1)",
            border: "1px solid var(--success)",
            color: "var(--success)",
            borderRadius: "8px",
            padding: "16px"
          }}>
            {successMessage}
          </div>
        )}
        
        {errorMessage && (
          <div className="alert alert-error mb-4" style={{ 
            background: "rgba(244, 67, 54, 0.1)",
            border: "1px solid var(--error)",
            color: "var(--error)",
            borderRadius: "8px",
            padding: "16px"
          }}>
            {errorMessage}
          </div>
        )}

        <div className="flex gap-3" style={{ flexWrap: "wrap", justifyContent: "center" }}>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={!canSubmit}
            style={{
              opacity: canSubmit ? 1 : 0.6,
              cursor: canSubmit ? "pointer" : "not-allowed",
              minWidth: "160px"
            }}
          >
            {isSending ? "Изпращане..." : "Изпрати известие"}
          </button>
        </div>
      </form>
    </div>
  );
}
