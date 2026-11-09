"use client";

import { useRouter } from "next/navigation";
import { type Member } from "../_types/members-page-types";
import { getStatusMeta } from "../_utils/members-page-utils";
import { PencilIcon } from "./members-page-icons";

export function PlayerCard({
  member,
  onClick,
  onEdit,
  actionMode = "profile",
  isActionLoading = false,
  onReactivate,
  isDeleteLoading = false,
  onPermanentDelete,
  coachGroupName,
  coachGroupId,
}: {
  member: Member;
  onClick: () => void;
  onEdit?: (member: Member) => void;
  actionMode?: "profile" | "reactivate";
  isActionLoading?: boolean;
  onReactivate?: () => void;
  isDeleteLoading?: boolean;
  onPermanentDelete?: () => void;
  coachGroupName?: string | null;
  coachGroupId?: string | null;
}) {
  const router = useRouter();
  const s = getStatusMeta(member.status);
  const initial = member.fullName.trim().charAt(0).toUpperCase() || "?";
  const needsAction = member.status === "overdue" || member.status === "warning";
  const cardCode =
    member.cards.find((card) => card.isActive)?.cardCode ||
    member.nfcTagId ||
    "";
  const groupDots = member.customTrainingGroupColors ?? [];
  const nameParts = member.fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? "";
  const restName = nameParts.slice(1).join(" ");

  return (
    <div className="pc-card" onClick={onClick}>
      <div className="pc-shimmer" aria-hidden="true" />
      <div className="pc-content">
        <div className="pc-avatar-stack">
          {/* Avatar */}
          {member.avatarUrl ? (
            <img src={member.avatarUrl} alt={member.fullName} className="pc-avatar pc-avatar--img" />
          ) : (
            <div className="pc-avatar" style={{ color: s.color, background: s.bg, borderColor: s.border }}>
              <span className="pc-avatar-letter">{initial}</span>
            </div>
          )}

        </div>

        {/* Name + badge */}
        <div className="pc-info">
          <div className="pc-name-container" title={member.fullName}>
            <span className="pc-name-row">{firstName}</span>
            {restName ? <span className="pc-name-row">{restName}</span> : null}
          </div>
          <div className="pc-badges">
            <span className="amp-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
              {s.label}
            </span>
            {/* {coachGroupName && (
              <span className="amp-badge" style={{ color: "#6366f1", background: "#ede9fe", border: "1px solid #c4b5fd", fontSize: "0.7rem" }}>
                {coachGroupName}
              </span>
            )} */}
          </div>
        </div>

        <div className="pc-actions">
          {actionMode === "profile" && (
            <button
              type="button"
              className="pc-edit-btn"
              title="Редактирай"
              aria-label={`Редактирай ${member.fullName}`}
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              <PencilIcon size={14} />
            </button>
          )}
          {actionMode === "profile" && cardCode && (
            <button
              type="button"
              className="pc-profile-btn"
              onClick={(e) => {
                e.stopPropagation();
                const profileUrl = coachGroupId
                  ? `/member/${encodeURIComponent(cardCode)}?coachGroupId=${encodeURIComponent(coachGroupId)}`
                  : `/member/${encodeURIComponent(cardCode)}`;
                router.push(profileUrl);
              }}
            >
              профил
            </button>
          )}
           {groupDots.length > 0 && (
            <div className="pc-custom-group-dots" aria-label="Цветове на тренировъчни групи" title="Тренировъчни групи">
              {groupDots.map((hex, dotIndex) => (
                <span key={`${hex}-${dotIndex}`} className="pc-custom-group-dot" style={{ backgroundColor: hex }} />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
