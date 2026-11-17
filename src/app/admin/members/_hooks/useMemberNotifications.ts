"use client";

import { useState, useMemo, useEffect } from "react";
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
  trainingScheduleGroups: TrainingScheduleGroup[];
};

export function useMemberNotifications({
  clubId,
  members,
  coachGroupId,
  isCustomTrainingGroupMode,
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

  const [notifyCustomGroups, setNotifyCustomGroups] = useState<
    Pick<CustomTrainingGroup, "id" | "name" | "playerIds" | "coachGroupId">[]
  >([]);
  const [notifyGroupsLoading, setNotifyGroupsLoading] = useState(false);
  const [notifyGroupsError, setNotifyGroupsError] = useState("");
  const [notifyGroupsRevision, setNotifyGroupsRevision] = useState(0);

  useEffect(() => {
    if (!notifyPanelOpen || !clubId || !isCustomTrainingGroupMode) return;
    const controller = new AbortController();
    setNotifyGroupsLoading(true);
    setNotifyGroupsError("");
    setNotifyCustomGroups([]);
    const search = new URLSearchParams();
    if (coachGroupId) search.set("coachGroupId", coachGroupId);
    void (async () => {
      try {
        const response = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/message-groups${search.size ? `?${search}` : ""}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error("Неуспешно зареждане на групите.");
        const groups = await response.json();
        if (!controller.signal.aborted) setNotifyCustomGroups(groups);
      } catch {
        if (!controller.signal.aborted) setNotifyGroupsError("Неуспешно зареждане на групите.");
      } finally {
        if (!controller.signal.aborted) setNotifyGroupsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [notifyPanelOpen, clubId, coachGroupId, isCustomTrainingGroupMode, notifyGroupsRevision]);

  const notifyVisibleMembers = useMemo(() => {
    let list = members.filter((m) => m.isActive);
    if (!coachGroupId && notifyCoachGroupFilter) {
      list = list.filter((m) => m.coachGroupIds.includes(notifyCoachGroupFilter));
    }
    if (notifyGroupFilter !== "all") {
      if (isCustomTrainingGroupMode) {
        list = list.filter((m) =>
          (notifyCustomGroups.find((g) => g.id === notifyGroupFilter)?.playerIds ?? []).includes(m.id),
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
    notifyCustomGroups,
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
    notifyCustomGroups,
    notifyGroupsLoading,
    notifyGroupsError,
    retryNotifyGroups: () => setNotifyGroupsRevision((value) => value + 1),
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
