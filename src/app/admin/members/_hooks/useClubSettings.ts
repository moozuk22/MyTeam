"use client";

import type * as React from "react";
import { useState } from "react";
import { type ClubOption, type PaymentWorkflow } from "../_types/members-page-types";

type ClubSettingsOptions = {
  clubId: string;
  clubPaymentWorkflow: "calendar_month" | "rolling_30_days" | "training_credits" | "training_credits_30_days";
  setClubPaymentWorkflow: React.Dispatch<
    React.SetStateAction<
      "calendar_month" | "rolling_30_days" | "training_credits" | "training_credits_30_days"
    >
  >;
  setClubs: React.Dispatch<React.SetStateAction<ClubOption[]>>;
  refreshMembersList: () => Promise<void>;
};

export function useClubSettings({
  clubId,
  clubPaymentWorkflow,
  setClubPaymentWorkflow,
  setClubs,
  refreshMembersList,
}: ClubSettingsOptions) {
  const [paymentWorkflowModalOpen, setPaymentWorkflowModalOpen] = useState(false);

  const [paymentWorkflowDraft, setPaymentWorkflowDraft] = useState<PaymentWorkflow>("calendar_month");

  const [paymentWorkflowSaving, setPaymentWorkflowSaving] = useState(false);

  const [paymentWorkflowError, setPaymentWorkflowError] = useState("");

  const [paymentWorkflowSuccess, setPaymentWorkflowSuccess] = useState("");

  const [paymentAmountModalOpen, setPaymentAmountModalOpen] = useState(false);

  const [feeAssignments, setFeeAssignments] = useState<Record<string, string[]> | undefined>();

  const [feeDeleteGroupId, setFeeDeleteGroupId] = useState<string | undefined>();

  const [rulesModalOpen, setRulesModalOpen] = useState(false);

  const [rulesDocs, setRulesDocs] = useState<{ id: string; name: string }[]>([]);

  const [rulesLoading, setRulesLoading] = useState(false);

  const [rulesUploading, setRulesUploading] = useState(false);

  const [rulesDeletingId, setRulesDeletingId] = useState<string | null>(null);

  const [rulesError, setRulesError] = useState("");

  const openPaymentAmountModal = () => {
    setFeeAssignments(undefined);
    setFeeDeleteGroupId(undefined);
    setPaymentAmountModalOpen(true);
  };

  const openRulesModal = async () => {
    if (!clubId) return;
    setRulesError("");
    setRulesDocs([]);
    setRulesModalOpen(true);
    setRulesLoading(true);
    try {
      const res = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/rules`);
      if (res.ok) {
        const data = (await res.json()) as { documents: { id: string; name: string }[] };
        setRulesDocs(data.documents);
      }
    } catch {
      // non-critical
    } finally {
      setRulesLoading(false);
    }
  };

  const handleRulesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clubId) return;
    if (file.type !== "application/pdf") {
      setRulesError("Само PDF файлове са разрешени.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setRulesError("Файлът е твърде голям (макс. 20 MB).");
      return;
    }
    setRulesError("");
    setRulesUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/rules`, {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { document?: { id: string; name: string }; error?: string };
      if (!res.ok) {
        setRulesError(data.error ?? "Грешка при качване.");
        return;
      }
      if (data.document) setRulesDocs((prev) => [...prev, data.document!]);
    } catch {
      setRulesError("Грешка при качване.");
    } finally {
      setRulesUploading(false);
      e.target.value = "";
    }
  };

  const handleRulesDelete = async (docId: string) => {
    if (!clubId) return;
    setRulesError("");
    setRulesDeletingId(docId);
    try {
      const res = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/rules/${encodeURIComponent(docId)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setRulesDocs((prev) => prev.filter((d) => d.id !== docId));
      } else {
        const data = (await res.json()) as { error?: string };
        setRulesError(data.error ?? "Грешка при изтриване.");
      }
    } catch {
      setRulesError("Грешка при изтриване.");
    } finally {
      setRulesDeletingId(null);
    }
  };

  const openPaymentWorkflowModal = () => {
    setPaymentWorkflowDraft(clubPaymentWorkflow);
    setPaymentWorkflowError("");
    setPaymentWorkflowSuccess("");
    setPaymentWorkflowModalOpen(true);
  };

  const closePaymentWorkflowModal = () => {
    if (paymentWorkflowSaving) return;
    setPaymentWorkflowModalOpen(false);
    setPaymentWorkflowError("");
    setPaymentWorkflowSuccess("");
  };

  const handleSavePaymentWorkflow = async () => {
    if (!clubId || paymentWorkflowSaving) return;

    setPaymentWorkflowSaving(true);
    setPaymentWorkflowError("");
    setPaymentWorkflowSuccess("");

    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/payment-workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentWorkflow: paymentWorkflowDraft }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setPaymentWorkflowError(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error.trim()
            : "Неуспешно запазване на метода за плащане.",
        );
        return;
      }

      setClubPaymentWorkflow(paymentWorkflowDraft);
      setClubs((prev) =>
        prev.map((club) => (club.id === clubId ? { ...club, paymentWorkflow: paymentWorkflowDraft } : club)),
      );
      setPaymentWorkflowSuccess("Методът за плащане е обновен за клуба.");
      await refreshMembersList();
    } catch (error) {
      console.error("Payment workflow save error:", error);
      setPaymentWorkflowError("Възникна грешка при запазване на метода за плащане.");
    } finally {
      setPaymentWorkflowSaving(false);
    }
  };

  return {
    paymentWorkflowModalOpen,
    paymentWorkflowDraft,
    setPaymentWorkflowDraft,
    paymentWorkflowSaving,
    paymentWorkflowError,
    setPaymentWorkflowError,
    paymentWorkflowSuccess,
    setPaymentWorkflowSuccess,
    paymentAmountModalOpen,
    setPaymentAmountModalOpen,
    feeAssignments,
    setFeeAssignments,
    feeDeleteGroupId,
    setFeeDeleteGroupId,
    rulesModalOpen,
    setRulesModalOpen,
    rulesDocs,
    rulesLoading,
    rulesUploading,
    rulesDeletingId,
    rulesError,
    openPaymentAmountModal,
    openRulesModal,
    handleRulesUpload,
    handleRulesDelete,
    openPaymentWorkflowModal,
    closePaymentWorkflowModal,
    handleSavePaymentWorkflow,
  };
}

export type ClubSettings = ReturnType<typeof useClubSettings>;
