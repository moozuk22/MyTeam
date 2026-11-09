"use client";

import { uploadImage } from "@/lib/uploadImage";
import { useState, type Dispatch, type SetStateAction } from "react";
import { type PartnerDiscount } from "../_types/discount-types";

type Options = {
  setSaving: Dispatch<SetStateAction<boolean>>;
  fetchData: () => Promise<void>;
};
export function usePartnerEditor({ setSaving, fetchData }: Options) {
  const [editingPartner, setEditingPartner] =
    useState<Partial<PartnerDiscount> | null>(null);

  const [badgeIsText, setBadgeIsText] = useState(false);

  const handleSavePartner = async () => {
    if (!editingPartner?.name) return;
    setSaving(true);
    try {
      const method = editingPartner.id ? "PUT" : "POST";
      const url = "/api/admin/discounts";

      // Ensure badgeText is formatted with - and % if it's just a number
      const payload = {
        ...editingPartner,
        badgeText: badgeIsText
          ? editingPartner.badgeText || null
          : editingPartner.badgeText?.startsWith("-")
            ? editingPartner.badgeText
            : `-${editingPartner.badgeText}%`,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditingPartner(null);
        fetchData();
      }
    } catch (error) {
      console.error("Save partner error:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePartner = async (id: string) => {
    if (!confirm("Сигурни ли сте, че искате да изтриете този партньор?"))
      return;
    try {
      const res = await fetch(`/api/admin/discounts?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error("Delete partner error:", error);
    }
  };

  const handleImageUpload = async (file: File) => {
    setSaving(true);
    try {
      const response = await uploadImage(
        file,
        "club",
        editingPartner?.name || "partner-logo",
      );
      setEditingPartner({ ...editingPartner, logoUrl: response.secure_url });
    } catch (error) {
      alert(
        "Грешка при качване: " +
          (error instanceof Error ? error.message : "Неизвестна грешка"),
      );
    } finally {
      setSaving(false);
    }
  };
  return {
    editingPartner,
    setEditingPartner,
    badgeIsText,
    setBadgeIsText,
    handleSavePartner,
    handleDeletePartner,
    handleImageUpload,
  };
}
