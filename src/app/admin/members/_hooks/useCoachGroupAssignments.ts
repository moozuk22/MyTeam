"use client";

import type * as React from "react";
import {
  previewGroupAssignmentFees,
  rebaseGroupAssignmentSelection,
  type GroupFeeSettings,
} from "@/lib/groupAssignmentFees";
import { useState, useMemo } from "react";

type CoachGroupAssignmentsOptions = {
  setFeeAssignments: React.Dispatch<React.SetStateAction<Record<string, string[]> | undefined>>;
  clubId: string;
  refreshMembersList: () => Promise<void>;
};

export function useCoachGroupAssignments({
  setFeeAssignments,
  clubId,
  refreshMembersList,
}: CoachGroupAssignmentsOptions) {
  const [bulkCoachGroupTargetId, setBulkCoachGroupTargetId] = useState<string | null>(null);

  const [bulkCoachGroupAllMembers, setBulkCoachGroupAllMembers] = useState<GroupFeeSettings["players"]>([]);

  const [bulkCoachGroupFeeSettings, setBulkCoachGroupFeeSettings] = useState<GroupFeeSettings | null>(null);

  const [bulkCoachGroupBillingChoices, setBulkCoachGroupBillingChoices] = useState<Record<string, string>>(
    {},
  );

  const [bulkCoachGroupLoadingMembers, setBulkCoachGroupLoadingMembers] = useState(false);

  const [bulkCoachGroupSelectedIds, setBulkCoachGroupSelectedIds] = useState<Set<string>>(new Set());

  const [bulkCoachGroupSearchTerm, setBulkCoachGroupSearchTerm] = useState("");

  const [bulkCoachGroupBusy, setBulkCoachGroupBusy] = useState(false);

  const [bulkCoachGroupError, setBulkCoachGroupError] = useState("");

  const [bulkCoachGroupSaved, setBulkCoachGroupSaved] = useState(false);

  const bulkCoachGroupFeePreview = useMemo(
    () =>
      bulkCoachGroupFeeSettings && bulkCoachGroupTargetId
        ? previewGroupAssignmentFees(
            bulkCoachGroupFeeSettings,
            bulkCoachGroupTargetId,
            bulkCoachGroupSelectedIds,
            bulkCoachGroupBillingChoices,
          )
        : [],
    [
      bulkCoachGroupFeeSettings,
      bulkCoachGroupTargetId,
      bulkCoachGroupSelectedIds,
      bulkCoachGroupBillingChoices,
    ],
  );

  const bulkCoachGroupHasFeeConflicts = bulkCoachGroupFeePreview.some((row) => row.fee.source === "conflict");

  const bulkCoachGroupVisibleMembers = useMemo(() => {
    let list = bulkCoachGroupAllMembers.filter((m) => m.isActive);
    if (bulkCoachGroupSearchTerm.trim()) {
      const q = bulkCoachGroupSearchTerm.trim().toLowerCase();
      list = list.filter((m) => m.fullName.toLowerCase().includes(q));
    }
    return list;
  }, [bulkCoachGroupAllMembers, bulkCoachGroupSearchTerm]);

  const openBulkCoachGroupModal = async (groupId: string) => {
    setBulkCoachGroupTargetId(groupId);
    setBulkCoachGroupAllMembers([]);
    setBulkCoachGroupFeeSettings(null);
    setBulkCoachGroupBillingChoices({});
    setFeeAssignments(undefined);
    setBulkCoachGroupSelectedIds(new Set());
    setBulkCoachGroupSearchTerm("");
    setBulkCoachGroupError("");
    setBulkCoachGroupSaved(false);
    setBulkCoachGroupBusy(false);
    setBulkCoachGroupLoadingMembers(true);
    try {
      const res = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/payment-amount`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Грешка при зареждане на таксите.");
      const settings = data as GroupFeeSettings;
      const allActive = settings.players.filter((m) => m.isActive);
      const alreadyIn = new Set(allActive.filter((m) => m.coachGroupIds.includes(groupId)).map((m) => m.id));
      setBulkCoachGroupFeeSettings(settings);
      setBulkCoachGroupAllMembers(allActive);
      setBulkCoachGroupSelectedIds(new Set(alreadyIn));
    } catch (err) {
      setBulkCoachGroupError(err instanceof Error ? err.message : "Грешка при зареждане на състезателите.");
    } finally {
      setBulkCoachGroupLoadingMembers(false);
    }
  };

  const handleBulkCoachGroupSave = async () => {
    if (!bulkCoachGroupTargetId || !bulkCoachGroupFeeSettings || bulkCoachGroupHasFeeConflicts) return;
    setBulkCoachGroupBusy(true);
    setBulkCoachGroupError("");
    try {
      if (!bulkCoachGroupFeePreview.length) {
        setBulkCoachGroupSaved(true);
        setTimeout(() => setBulkCoachGroupSaved(false), 2000);
        return;
      }
      const assignments = Object.fromEntries(bulkCoachGroupFeePreview.map((p) => [p.id, p.coachGroupIds]));
      const billingChoices = Object.fromEntries(
        bulkCoachGroupFeePreview
          .filter((p) => p.billingCoachGroupId && Object.hasOwn(bulkCoachGroupBillingChoices, p.id))
          .map((p) => [p.id, p.billingCoachGroupId]),
      );
      const res = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/payment-amount`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments,
          billingChoices,
          expectedRevision: bulkCoachGroupFeeSettings.revision,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setFeeAssignments(assignments);
          const fresh = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/payment-amount`, {
            cache: "no-store",
          });
          if (fresh.ok) {
            const settings = (await fresh.json()) as GroupFeeSettings;
            setBulkCoachGroupFeeSettings(settings);
            setBulkCoachGroupAllMembers(settings.players.filter((m) => m.isActive));
            const selected = rebaseGroupAssignmentSelection(settings, bulkCoachGroupTargetId, assignments);
            setBulkCoachGroupSelectedIds(selected);
            setFeeAssignments(
              Object.fromEntries(
                previewGroupAssignmentFees(
                  settings,
                  bulkCoachGroupTargetId,
                  selected,
                  bulkCoachGroupBillingChoices,
                ).map((p) => [p.id, p.coachGroupIds]),
              ),
            );
            throw new Error(
              "Нищо не е запазено. Таксите или групите са променени междувременно. Данните са обновени — прегледайте сумите и изберете група за таксата, ако е необходимо, след което натиснете „Запази“ отново. За други състезатели използвайте „Преглед на месечните такси“.",
            );
          }
        }
        throw new Error(data.error ?? "Грешка при запазване");
      }
      setBulkCoachGroupFeeSettings(data as GroupFeeSettings);
      setBulkCoachGroupAllMembers((data as GroupFeeSettings).players.filter((m) => m.isActive));
      setBulkCoachGroupBillingChoices({});
      setFeeAssignments(undefined);
      setBulkCoachGroupSaved(true);
      void refreshMembersList();
      setTimeout(() => setBulkCoachGroupSaved(false), 2000);
    } catch (err) {
      setBulkCoachGroupError(err instanceof Error ? err.message : "Грешка");
    } finally {
      setBulkCoachGroupBusy(false);
    }
  };

  return {
    bulkCoachGroupTargetId,
    setBulkCoachGroupTargetId,
    bulkCoachGroupFeeSettings,
    setBulkCoachGroupBillingChoices,
    bulkCoachGroupLoadingMembers,
    bulkCoachGroupSelectedIds,
    setBulkCoachGroupSelectedIds,
    bulkCoachGroupSearchTerm,
    setBulkCoachGroupSearchTerm,
    bulkCoachGroupBusy,
    bulkCoachGroupError,
    setBulkCoachGroupError,
    bulkCoachGroupSaved,
    bulkCoachGroupFeePreview,
    bulkCoachGroupHasFeeConflicts,
    bulkCoachGroupVisibleMembers,
    openBulkCoachGroupModal,
    handleBulkCoachGroupSave,
  };
}

export type CoachGroupAssignments = ReturnType<typeof useCoachGroupAssignments>;
