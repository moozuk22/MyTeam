"use client";

import type * as React from "react";
import { playerFieldEnabled, parsePlayerWeight } from "@/lib/playerFields";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { extractUploadPathFromCloudinaryUrl } from "@/lib/cloudinaryImagePath";
import { uploadImage } from "@/lib/uploadImage";
import { isValidPhone } from "@/lib/phone";
import { normalizeMember } from "../_utils/members-page-utils";
import { type Member, type ClubOption } from "../_types/members-page-types";

type MemberManagementOptions = {
  clubs: ClubOption[];
  clubId: string;
  clubPlayerFields: string[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  setSelectedMember: React.Dispatch<React.SetStateAction<Member | null>>;
  setClubs: React.Dispatch<React.SetStateAction<ClubOption[]>>;
  coachGroupId: string;
  refreshMembersList: () => Promise<void>;
  router: ReturnType<typeof useRouter>;
};

export function useMemberManagement({
  clubs,
  clubId,
  clubPlayerFields,
  setMembers,
  setSelectedMember,
  setClubs,
  coachGroupId,
  refreshMembersList,
  router,
}: MemberManagementOptions) {
  const [memberCoachGroupAssignMemberId, setMemberCoachGroupAssignMemberId] = useState<string | null>(null);

  const [memberCoachGroupAssignValue, setMemberCoachGroupAssignValue] = useState<string[] | null>(null);

  const [memberCoachGroupAssignSaving, setMemberCoachGroupAssignSaving] = useState(false);

  const [memberCoachGroupAssignError, setMemberCoachGroupAssignError] = useState("");

  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);

  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);

  const [deleteError, setDeleteError] = useState("");

  const [isDeletingMember, setIsDeletingMember] = useState(false);

  const [editError, setEditError] = useState("");

  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [editForm, setEditForm] = useState({
    fullName: "",
    clubId: "",
    teamGroup: "",
    rank: "",
    weight: "",
    jerseyNumber: "",
    parentPhone: "",
    playerPhone: "",
    birthDate: "",
    paymentAmount: "",
    avatarUrl: "",
    imageUrl: "",
    imagePublicId: "",
  });

  const editPlayerSettings =
    clubs.find((club) => club.id === editForm.clubId) ??
    (editForm.clubId === clubId ? { playerFields: clubPlayerFields } : memberToEdit?.club);

  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);

  const [editAvatarPreviewUrl, setEditAvatarPreviewUrl] = useState("");

  const [isNewCardConfirmOpen, setIsNewCardConfirmOpen] = useState(false);

  const [isAssigningNewCard, setIsAssigningNewCard] = useState(false);

  const [reactivatingMemberId, setReactivatingMemberId] = useState<string | null>(null);

  const [deletingPermanentMemberId, setDeletingPermanentMemberId] = useState<string | null>(null);

  const [memberToPermanentDelete, setMemberToPermanentDelete] = useState<Member | null>(null);

  const [inactiveActionError, setInactiveActionError] = useState("");

  const closeEditModal = () => {
    setMemberToEdit(null);
    setEditAvatarFile(null);
    setEditAvatarPreviewUrl("");
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete || isDeletingMember) return;

    setIsDeletingMember(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/admin/members/${memberToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        let message = "Неуспешно премахване на състезател.";
        try {
          const data = await response.json();
          if (typeof data?.error === "string" && data.error.trim()) {
            message = data.error.trim();
          }
        } catch {
          // Keep generic message when response body is not JSON.
        }
        setDeleteError(message);
        return;
      }

      setMembers((prev) =>
        prev.map((member) =>
          member.id === memberToDelete.id
            ? {
                ...member,
                isActive: false,
                cards: member.cards.map((card) => ({ ...card, isActive: false })),
              }
            : member,
        ),
      );
      setSelectedMember((prev) => (prev?.id === memberToDelete.id ? null : prev));
      setMemberToDelete(null);
    } catch (error) {
      console.error("Error removing member:", error);
      setDeleteError("Възникна грешка при премахване на състезател.");
    } finally {
      setIsDeletingMember(false);
    }
  };

  const openEditMember = async (member: Member) => {
    setEditError("");
    if (clubs.length === 0) {
      try {
        const response = await fetch("/api/admin/clubs", { cache: "no-store" });
        if (response.ok) {
          const clubsPayload: unknown = await response.json();
          const normalizedClubs: ClubOption[] = Array.isArray(clubsPayload)
            ? clubsPayload
                .map((club) => {
                  const item =
                    typeof club === "object" && club !== null
                      ? (club as {
                          id?: unknown;
                          name?: unknown;
                          sports?: unknown;
                          playerFields?: unknown;
                          emblemUrl?: unknown;
                          imageUrl?: unknown;
                          imagePublicId?: unknown;
                          paymentWorkflow?: unknown;
                        })
                      : {};
                  const rawName = String(item.name ?? "").trim();
                  return {
                    id: String(item.id ?? ""),
                    name: rawName,
                    playerFields: Array.isArray(item.playerFields)
                      ? item.playerFields.map(String)
                      : undefined,
                    sports: typeof item.sports === "string" ? item.sports : null,
                    emblemUrl: typeof item.emblemUrl === "string" ? item.emblemUrl : null,
                    imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
                    imagePublicId: typeof item.imagePublicId === "string" ? item.imagePublicId : null,
                    paymentWorkflow:
                      item.paymentWorkflow === "rolling_30_days"
                        ? ("rolling_30_days" as const)
                        : item.paymentWorkflow === "training_credits"
                          ? ("training_credits" as const)
                          : item.paymentWorkflow === "training_credits_30_days"
                            ? ("training_credits_30_days" as const)
                            : ("calendar_month" as const),
                  };
                })
                .filter((club) => club.id && club.name)
            : [];
          setClubs(normalizedClubs);
        }
      } catch (error) {
        console.error("Error loading clubs for edit:", error);
      }
    }
    setMemberToEdit(member);
    setEditAvatarFile(null);
    setEditAvatarPreviewUrl("");
    setMemberCoachGroupAssignValue(null);
    setMemberCoachGroupAssignError("");
    setEditForm({
      fullName: member.fullName,
      clubId: member.club?.id ?? "",
      teamGroup: member.teamGroup !== null ? String(member.teamGroup) : "",
      rank: member.rank ?? "",
      weight: member.weight == null ? "" : String(member.weight),
      jerseyNumber: member.jerseyNumber ?? "",
      parentPhone: member.parentPhone ?? "",
      playerPhone: member.playerPhone ?? "",
      birthDate: member.birthDate ? new Date(member.birthDate).toISOString().slice(0, 10) : "",
      paymentAmount: member.paymentAmount ?? "",
      avatarUrl: member.avatarUrl ?? "",
      imageUrl: member.imageUrl ?? "",
      imagePublicId: member.imagePublicId ?? "",
    });
  };

  useEffect(() => {
    if (!editAvatarFile) {
      setEditAvatarPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(editAvatarFile);
    setEditAvatarPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [editAvatarFile]);

  const handleSaveMemberEdit = async () => {
    if (!memberToEdit || isSavingEdit) return;
    const fullName = editForm.fullName.trim();
    if (!fullName) {
      setEditError("Името е задължително.");
      return;
    }
    if (!editForm.clubId) {
      setEditError("Изберете отбор.");
      return;
    }

    const teamGroupValue = editForm.teamGroup.trim();
    const parsedTeamGroup = teamGroupValue === "" ? null : Number.parseInt(teamGroupValue, 10);
    if (parsedTeamGroup !== null && Number.isNaN(parsedTeamGroup)) {
      setEditError("Наборът трябва да е число.");
      return;
    }

    if (editForm.parentPhone.trim() && !isValidPhone(editForm.parentPhone)) {
      setEditError("Parent phone is invalid.");
      return;
    }
    if (editForm.playerPhone.trim() && !isValidPhone(editForm.playerPhone)) {
      setEditError("Player phone is invalid.");
      return;
    }
    const normalizedPaymentAmount = !coachGroupId ? editForm.paymentAmount.trim().replace(",", ".") : "";
    if (normalizedPaymentAmount && !/^\d+(\.\d{1,2})?$/.test(normalizedPaymentAmount)) {
      setEditError("Месечната такса трябва да е положително число с до 2 знака след десетичната запетая.");
      return;
    }

    setIsSavingEdit(true);
    setEditError("");
    try {
      const weight = playerFieldEnabled(editPlayerSettings, "weight")
        ? parsePlayerWeight(editForm.weight)
        : undefined;
      let resolvedAvatarUrl = editForm.avatarUrl.trim() || null;
      let resolvedImageUrl = editForm.imageUrl.trim() || null;
      let resolvedImagePublicId = editForm.imagePublicId.trim() || null;

      if (editAvatarFile) {
        const uploaded = await uploadImage(editAvatarFile, "player", fullName || editAvatarFile.name);
        resolvedAvatarUrl = uploaded.secure_url;
        resolvedImageUrl = extractUploadPathFromCloudinaryUrl(uploaded.secure_url);
        resolvedImagePublicId = uploaded.public_id;
      }

      const response = await fetch(`/api/admin/members/${memberToEdit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          clubId: editForm.clubId,
          ...(playerFieldEnabled(editPlayerSettings, "teamGroup") ? { teamGroup: parsedTeamGroup } : {}),
          ...(playerFieldEnabled(editPlayerSettings, "jerseyNumber")
            ? { jerseyNumber: editForm.jerseyNumber.trim() || null }
            : {}),
          ...(playerFieldEnabled(editPlayerSettings, "rank") ? { rank: editForm.rank.trim() || null } : {}),
          ...(playerFieldEnabled(editPlayerSettings, "weight") ? { weight } : {}),
          parentPhone: editForm.parentPhone.trim() || null,
          playerPhone: editForm.playerPhone.trim() || null,
          birthDate: editForm.birthDate.trim() || null,
          ...(normalizedPaymentAmount ? { paymentAmount: normalizedPaymentAmount } : {}),
          avatarUrl: resolvedAvatarUrl,
          imageUrl: resolvedImageUrl,
          imagePublicId: resolvedImagePublicId,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.trim()
            ? data.error.trim()
            : "Неуспешно редактиране на състезател.";
        setEditError(message);
        return;
      }

      const updatedMember = normalizeMember(data);
      setMembers((prev) => prev.map((m) => (m.id === memberToEdit.id ? updatedMember : m)));

      setSelectedMember((prev) => (prev?.id === memberToEdit.id ? updatedMember : prev));

      closeEditModal();
      await refreshMembersList();
      router.refresh();
    } catch (error) {
      console.error("Error updating member:", error);
      setEditError(error instanceof Error ? error.message : "Възникна грешка при редактиране.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleAssignNewCard = async () => {
    if (!memberToEdit || isSavingEdit || isAssigningNewCard) return;

    setIsAssigningNewCard(true);
    setEditError("");

    try {
      const response = await fetch(`/api/admin/members/${memberToEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_new_card" }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.trim()
            ? data.error.trim()
            : "Неуспешно генериране на нова карта.";
        setEditError(message);
        return;
      }

      const updatedMember = normalizeMember(data);
      setMembers((prev) => prev.map((m) => (m.id === memberToEdit.id ? updatedMember : m)));
      setSelectedMember((prev) => (prev?.id === memberToEdit.id ? updatedMember : prev));
      setMemberToEdit(updatedMember);
    } catch (error) {
      console.error("Error assigning new card:", error);
      setEditError("Възникна грешка при генериране на нова карта.");
    } finally {
      setIsAssigningNewCard(false);
    }
  };

  const handleConfirmAssignNewCard = async () => {
    setIsNewCardConfirmOpen(false);
    await handleAssignNewCard();
  };

  const handleReactivateMember = async (member: Member) => {
    if (reactivatingMemberId || deletingPermanentMemberId) return;
    setInactiveActionError("");
    setReactivatingMemberId(member.id);
    try {
      const response = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.trim()
            ? data.error.trim()
            : "Неуспешно активиране на състезател.";
        setInactiveActionError(message);
        return;
      }

      const updatedMember = normalizeMember(data);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updatedMember : m)));
      setSelectedMember((prev) => (prev?.id === member.id ? updatedMember : prev));
    } catch (error) {
      console.error("Error reactivating member:", error);
      setInactiveActionError("Възникна грешка при активиране на състезател.");
    } finally {
      setReactivatingMemberId(null);
    }
  };

  const handlePermanentDeleteMember = async () => {
    if (!memberToPermanentDelete || reactivatingMemberId || deletingPermanentMemberId) return;
    const member = memberToPermanentDelete;

    setInactiveActionError("");
    setDeletingPermanentMemberId(member.id);
    try {
      const response = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_permanently" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.trim()
            ? data.error.trim()
            : "Неуспешно изтриване на състезател.";
        setInactiveActionError(message);
        return;
      }

      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setSelectedMember((prev) => (prev?.id === member.id ? null : prev));
    } catch (error) {
      console.error("Error permanently deleting member:", error);
      setInactiveActionError("Възникна грешка при изтриване на състезател.");
    } finally {
      setDeletingPermanentMemberId(null);
      setMemberToPermanentDelete(null);
    }
  };

  return {
    memberToEdit,
    memberToDelete,
    setMemberToDelete,
    deleteError,
    setDeleteError,
    isDeletingMember,
    editError,
    setEditError,
    isSavingEdit,
    editForm,
    setEditForm,
    editPlayerSettings,
    setEditAvatarFile,
    editAvatarPreviewUrl,
    isNewCardConfirmOpen,
    setIsNewCardConfirmOpen,
    isAssigningNewCard,
    reactivatingMemberId,
    setReactivatingMemberId,
    deletingPermanentMemberId,
    setDeletingPermanentMemberId,
    memberToPermanentDelete,
    setMemberToPermanentDelete,
    inactiveActionError,
    setInactiveActionError,
    closeEditModal,
    handleDeleteMember,
    openEditMember,
    handleSaveMemberEdit,
    handleConfirmAssignNewCard,
    handleReactivateMember,
    handlePermanentDeleteMember,
  };
}

export type MemberManagement = ReturnType<typeof useMemberManagement>;
