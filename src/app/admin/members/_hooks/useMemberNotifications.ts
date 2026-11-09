"use client";

import { useState, useMemo } from "react";
import {
  type Member,
  type TrainingScheduleGroup,
  type CustomTrainingGroup,
} from "../_types/members-page-types";

type MemberNotificationsOptions = {
  clubId: string;
  members: Member[];
  coachGroupId: string;
  isCustomTrainingGroupMode: boolean;
  customTrainingGroups: CustomTrainingGroup[];
  trainingScheduleGroups: TrainingScheduleGroup[];
};

export function useMemberNotifications({
  clubId,
  members,
  coachGroupId,
  isCustomTrainingGroupMode,
  customTrainingGroups,
  trainingScheduleGroups,
}: MemberNotificationsOptions) {
  const [notifyPanelOpen, setNotifyPanelOpen] = useState(false);

  const [notifyImage, setNotifyImage] = useState<File | null>(null);

  const [notifyMessage, setNotifyMessage] = useState("");

  const [notifySelectedIds, setNotifySelectedIds] = useState<Set<string>>(new Set());

  const [notifySearchTerm, setNotifySearchTerm] = useState("");

  const [notifyGroupFilter, setNotifyGroupFilter] = useState("all");

  const [notifyCoachGroupFilter, setNotifyCoachGroupFilter] = useState("");

  const [notifyBusy, setNotifyBusy] = useState(false);

  const [notifyError, setNotifyError] = useState("");

  const [notifySuccess, setNotifySuccess] = useState("");

  const notifyVisibleMembers = useMemo(() => {
    let list = members.filter((m) => m.isActive);
    if (!coachGroupId && notifyCoachGroupFilter) {
      list = list.filter((m) => m.coachGroupIds.includes(notifyCoachGroupFilter));
    }
    if (notifyGroupFilter !== "all") {
      if (isCustomTrainingGroupMode) {
        list = list.filter((m) =>
          (customTrainingGroups.find((g) => g.id === notifyGroupFilter)?.playerIds ?? []).includes(m.id),
        );
      } else {
        const tsg = trainingScheduleGroups.find((g) => g.id === notifyGroupFilter);
        if (tsg) {
          list = list.filter((m) => m.teamGroup !== null && tsg.teamGroups.includes(m.teamGroup));
        } else {
          list = list.filter((m) => String(m.teamGroup) === notifyGroupFilter);
        }
      }
    }
    if (notifySearchTerm.trim()) {
      const q = notifySearchTerm.trim().toLowerCase();
      list = list.filter((m) => m.fullName.toLowerCase().includes(q));
    }
    return list;
  }, [
    members,
    notifyGroupFilter,
    notifySearchTerm,
    notifyCoachGroupFilter,
    coachGroupId,
    isCustomTrainingGroupMode,
    customTrainingGroups,
    trainingScheduleGroups,
  ]);

  const handleSendNotify = async () => {
    if (!notifyMessage.trim() || notifySelectedIds.size === 0) return;
    setNotifyBusy(true);
    setNotifyError("");
    setNotifySuccess("");
    try {
      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({
          memberIds: Array.from(notifySelectedIds),
          message: notifyMessage.trim(),
          clubId,
          ...(coachGroupId ? { coachGroupId } : {}),
        }),
      );
      if (notifyImage) form.append("image", notifyImage);
      const res = await fetch("/api/admin/members/notify", { method: "POST", body: form });
      const data = (await res.json()) as { success?: boolean; sent?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Грешка");
      setNotifySuccess(`Изпратено до ${data.sent ?? 0} членове.`);
      setNotifySelectedIds(new Set());
      setNotifyMessage("");
      setNotifyImage(null);
    } catch (err) {
      setNotifyError(err instanceof Error ? err.message : "Грешка");
    } finally {
      setNotifyBusy(false);
    }
  };

  return {
    notifyPanelOpen,
    setNotifyPanelOpen,
    notifyImage,
    setNotifyImage,
    notifyMessage,
    setNotifyMessage,
    notifySelectedIds,
    setNotifySelectedIds,
    notifySearchTerm,
    setNotifySearchTerm,
    notifyGroupFilter,
    setNotifyGroupFilter,
    notifyCoachGroupFilter,
    setNotifyCoachGroupFilter,
    notifyBusy,
    setNotifyBusy,
    notifyError,
    setNotifyError,
    notifySuccess,
    setNotifySuccess,
    notifyVisibleMembers,
    handleSendNotify,
  };
}

export type MemberNotifications = ReturnType<typeof useMemberNotifications>;
