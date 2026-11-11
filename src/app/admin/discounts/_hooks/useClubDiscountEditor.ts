"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { type Team } from "../_types/discount-types";

type Options = {
  setSaving: Dispatch<SetStateAction<boolean>>;
  fetchData: () => Promise<void>;
};
export function useClubDiscountEditor({ setSaving, fetchData }: Options) {
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [dragY, setDragY] = useState(0);

  const [startY, setStartY] = useState(0);

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleSaveTeamConfig = async () => {
    if (!editingTeam) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/teams/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId: editingTeam.clubId,
          teamGroup: 0, // Set to 0 for entire club
          discountConfigs: editingTeam.configs.map((c, i) => ({
            discountId: c.discountId,
            order: i,
            isVisible: c.isVisible,
          })),
        }),
      });

      if (res.ok) {
        setEditingTeam(null);
        fetchData();
      }
    } catch (error) {
      console.error("Save team config error:", error);
    } finally {
      setSaving(false);
    }
  };

  return {
    editingTeam,
    setEditingTeam,
    draggingId,
    setDraggingId,
    dragY,
    setDragY,
    startY,
    setStartY,
    dragIndex,
    setDragIndex,
    handleSaveTeamConfig,
  };
}
