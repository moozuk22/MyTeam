"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCompatiblePushSubscription } from "@/lib/push/browser";
import { type CoachGroup, type MemberNotification } from "../_types/members-page-types";

type ClubNotificationsOptions = {
  clubId: string;
  coachGroupId: string;
  coachGroups: CoachGroup[];
  searchParams: ReturnType<typeof useSearchParams>;
  router: ReturnType<typeof useRouter>;
};

export function useClubNotifications({
  clubId,
  coachGroupId,
  coachGroups,
  searchParams,
  router,
}: ClubNotificationsOptions) {
  const [isClubPushSupported, setIsClubPushSupported] = useState(true);

  const [isClubPushSubscribed, setIsClubPushSubscribed] = useState(false);

  const [clubPushBusy, setClubPushBusy] = useState(false);

  const [clubPushStatusMessage, setClubPushStatusMessage] = useState("");

  const [clubPushErrorMessage, setClubPushErrorMessage] = useState("");

  const [isClubIPhone, setIsClubIPhone] = useState(false);

  const [isClubStandalone, setIsClubStandalone] = useState(false);

  const [showClubIphoneGuide, setShowClubIphoneGuide] = useState(false);

  const [clubNotificationsPanelOpen, setClubNotificationsPanelOpen] = useState(false);

  const [clubNotificationsLoading, setClubNotificationsLoading] = useState(false);

  const [clubNotifications, setClubNotifications] = useState<MemberNotification[]>([]);

  const [clubNotificationsUnreadCount, setClubNotificationsUnreadCount] = useState(0);

  const [clubNotificationsDateFilter, setClubNotificationsDateFilter] = useState("");

  const [clubNotificationsScopeType, setClubNotificationsScopeType] = useState<
    "team" | "trainingGroup" | "admin"
  >("team");

  const [clubNotificationsScopeValue, setClubNotificationsScopeValue] = useState("all");

  const [lastHandledCoachPushOpenTs, setLastHandledCoachPushOpenTs] = useState<string | null>(null);

  const clubNotificationTeamGroups = Array.from(
    new Set(
      clubNotifications
        .map((item) => (typeof item.teamGroup === "number" ? item.teamGroup : null))
        .filter((value): value is number => typeof value === "number"),
    ),
  ).sort((a, b) => a - b);

  const clubNotificationTrainingGroups = Array.from(
    new Map(
      clubNotifications.flatMap((item) =>
        Array.isArray(item.trainingGroups)
          ? item.trainingGroups.map((group) => [group.id, group] as const)
          : [],
      ),
    ).values(),
  );

  const filteredClubNotifications = clubNotifications.filter((item) => {
    const notifDate = new Date(item.sentAt).toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });
    if (clubNotificationsDateFilter && notifDate !== clubNotificationsDateFilter) {
      return false;
    }
    if (clubNotificationsScopeType === "admin") {
      return item.type === "admin_message" || item.type === "myteam_message";
    }
    if (clubNotificationsScopeValue !== "all") {
      if (clubNotificationsScopeType === "team") {
        const selectedGroup = Number.parseInt(clubNotificationsScopeValue, 10);
        if (!Number.isInteger(selectedGroup) || item.teamGroup !== selectedGroup) {
          return false;
        }
      } else {
        const hasTrainingGroup = Array.isArray(item.trainingGroups)
          ? item.trainingGroups.some((group) => group.id === clubNotificationsScopeValue)
          : false;
        if (!hasTrainingGroup) {
          return false;
        }
      }
    }
    return true;
  });

  useEffect(() => {
    if (!clubId) return;

    const sendPresence = (action: "connect" | "disconnect") => {
      const blob = new Blob([JSON.stringify({ clubId, action })], { type: "application/json" });
      try {
        navigator.sendBeacon("/api/admin/track/presence", blob);
      } catch {
        // Presence tracking is best-effort and should not interrupt the admin page.
      }
    };

    const sendConnect = () => {
      sendPresence("connect");
    };

    const sendDisconnect = () => {
      sendPresence("disconnect");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendDisconnect();
      } else {
        sendConnect();
      }
    };

    sendConnect();
    window.addEventListener("pagehide", sendDisconnect);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", sendDisconnect);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sendDisconnect();
    };
  }, [clubId]);

  useEffect(() => {
    if (!clubId) {
      setClubNotifications([]);
      setClubNotificationsUnreadCount(0);
      setClubNotificationsDateFilter("");
      setClubNotificationsScopeType("team");
      setClubNotificationsScopeValue("all");
      return;
    }
    void fetchClubNotifications();
  }, [clubId]);

  useEffect(() => {
    if (!clubId) {
      return;
    }

    const streamUrl = `/api/admin/clubs/${encodeURIComponent(clubId)}/notifications/events`;
    const source = new EventSource(streamUrl, { withCredentials: true });

    source.onmessage = (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (!payload || typeof payload !== "object") {
        return;
      }

      const type = "type" in payload ? String((payload as { type?: unknown }).type ?? "") : "";
      if (type !== "notification-created") {
        return;
      }

      void fetchClubNotifications();
    };

    source.onerror = () => {
      // Let browser auto-reconnect.
    };

    return () => {
      source.close();
    };
  }, [clubId]);

  const handleEnableClubNotifications = async () => {
    setClubPushStatusMessage("");
    setClubPushErrorMessage("");

    if (!clubId || !isClubPushSupported) {
      setClubPushErrorMessage("Този браузър не поддържа push известия или липсва HTTPS.");
      return;
    }

    setClubPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setClubPushErrorMessage("Достъпът до известия е отказан от браузъра.");
        setIsClubPushSubscribed(false);
        return;
      }

      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;

      const publicKeyResponse = await fetch("/api/push/public-key", { cache: "no-store" });
      if (!publicKeyResponse.ok) {
        const payload = await publicKeyResponse
          .json()
          .catch(() => ({ error: "Missing VAPID configuration" }));
        throw new Error(String(payload.error ?? "Failed to get VAPID public key"));
      }
      const { publicKey } = (await publicKeyResponse.json()) as { publicKey: string };
      const subscription = await getCompatiblePushSubscription(registration, publicKey);

      const saveResponse = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/push-subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          ...(coachGroupId ? { coachGroupId } : {}),
        }),
      });

      if (!saveResponse.ok) {
        const payload = await saveResponse.json().catch(() => ({ error: "Failed to save subscription" }));
        throw new Error(String(payload.error ?? "Failed to save subscription"));
      }

      setIsClubPushSubscribed(true);
      const scopeLabel = coachGroupId
        ? (coachGroups.find((g) => g.id === coachGroupId)?.name ?? "тази група треньор")
        : "този отбор";
      setClubPushStatusMessage(`Известията за треньори са активирани за ${scopeLabel}.`);
    } catch (error) {
      console.error("Enable club notifications error:", error);
      setClubPushErrorMessage(error instanceof Error ? error.message : "Неуспешно активиране на известията.");
    } finally {
      setClubPushBusy(false);
    }
  };

  const handleDisableClubNotifications = async () => {
    setClubPushStatusMessage("");
    setClubPushErrorMessage("");

    if (!clubId) {
      return;
    }

    setClubPushBusy(true);
    try {
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsClubPushSubscribed(false);
        return;
      }

      const endpoint = subscription.endpoint;
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/push-subscriptions`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ endpoint }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to disable subscription" }));
        throw new Error(String(payload.error ?? "Failed to disable subscription"));
      }

      setIsClubPushSubscribed(false);
      setClubPushStatusMessage("Известията за треньори са изключени за този отбор.");
    } catch (error) {
      console.error("Disable club notifications error:", error);
      setClubPushErrorMessage(error instanceof Error ? error.message : "Неуспешно изключване на известията.");
    } finally {
      setClubPushBusy(false);
    }
  };

  const fetchClubNotifications = async () => {
    if (!clubId) {
      setClubNotifications([]);
      setClubNotificationsUnreadCount(0);
      return;
    }

    setClubNotificationsLoading(true);
    try {
      const search = new URLSearchParams();
      if (coachGroupId) {
        search.set("coachGroupId", coachGroupId);
      }
      const response = await fetch(
        `/api/admin/clubs/${encodeURIComponent(clubId)}/notifications${search.size ? `?${search.toString()}` : ""}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      setClubNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
      setClubNotificationsUnreadCount(Number(payload.unreadCount ?? 0));
    } catch (error) {
      console.error("Failed to fetch club notifications:", error);
    } finally {
      setClubNotificationsLoading(false);
    }
  };

  const markClubNotificationsRead = async () => {
    if (!clubId) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/notifications/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(coachGroupId ? { coachGroupId } : {}),
        }),
      });
      if (!response.ok) {
        return;
      }

      const nowIso = new Date().toISOString();
      setClubNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? nowIso })));
      setClubNotificationsUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark club notifications as read:", error);
    }
  };

  const handleOpenClubNotificationsPanel = async () => {
    setClubNotificationsPanelOpen(true);
    await fetchClubNotifications();
    await markClubNotificationsRead();
  };

  useEffect(() => {
    const pushOpenTs = searchParams.get("pushOpenTs");
    const shouldOpenFromPush =
      searchParams.get("fromPush") === "1" &&
      searchParams.get("openCoachNotifications") === "1" &&
      Boolean(pushOpenTs);

    if (!shouldOpenFromPush || !pushOpenTs || pushOpenTs === lastHandledCoachPushOpenTs) {
      return;
    }

    setLastHandledCoachPushOpenTs(pushOpenTs);
    void handleOpenClubNotificationsPanel();

    const cleanedParams = new URLSearchParams(searchParams.toString());
    cleanedParams.delete("fromPush");
    cleanedParams.delete("openBell");
    cleanedParams.delete("openCoachNotifications");
    cleanedParams.delete("pushOpenTs");
    const cleanedQuery = cleanedParams.toString();
    const cleanPath = "/admin/members";
    router.replace(cleanedQuery ? `${cleanPath}?${cleanedQuery}` : cleanPath, { scroll: false });
  }, [lastHandledCoachPushOpenTs, router, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const ua = window.navigator.userAgent || "";
    setIsClubIPhone(/iPhone/i.test(ua));
    const standaloneByDisplayMode = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
    const standaloneByNavigator =
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsClubStandalone(standaloneByDisplayMode || standaloneByNavigator);
  }, []);

  const clubPushScopeKey = `${clubId}|${coachGroupId}`;

  useEffect(() => {
    let cancelled = false;

    const syncClubPushState = async () => {
      setClubPushErrorMessage("");
      setClubPushStatusMessage("");

      if (!clubId || typeof window === "undefined") {
        if (!cancelled) {
          setIsClubPushSubscribed(false);
        }
        return;
      }

      const supportsPush =
        window.isSecureContext &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!supportsPush) {
        if (!cancelled) {
          setIsClubPushSupported(false);
          setIsClubPushSubscribed(false);
        }
        return;
      }

      if (!cancelled) {
        setIsClubPushSupported(true);
      }

      try {
        await navigator.serviceWorker.register("/sw.js");
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          if (!cancelled) {
            setIsClubPushSubscribed(false);
          }
          return;
        }

        const endpoint = subscription.endpoint.trim();
        const search = new URLSearchParams({ endpoint });
        if (coachGroupId) {
          search.set("coachGroupId", coachGroupId);
        }
        const response = await fetch(
          `/api/admin/clubs/${encodeURIComponent(clubId)}/push-subscriptions?${search.toString()}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          if (!cancelled) {
            setIsClubPushSubscribed(false);
          }
          return;
        }

        const payload = (await response.json()) as { isActive?: unknown };
        if (!cancelled) {
          setIsClubPushSubscribed(Boolean(payload.isActive));
        }
      } catch (error) {
        console.error("Club push state sync error:", error);
        if (!cancelled) {
          setIsClubPushSubscribed(false);
        }
      }
    };

    void syncClubPushState();

    return () => {
      cancelled = true;
    };
  }, [clubPushScopeKey]);

  return {
    isClubPushSupported,
    isClubPushSubscribed,
    clubPushBusy,
    clubPushStatusMessage,
    clubPushErrorMessage,
    isClubIPhone,
    isClubStandalone,
    showClubIphoneGuide,
    setShowClubIphoneGuide,
    clubNotificationsPanelOpen,
    setClubNotificationsPanelOpen,
    clubNotificationsLoading,
    clubNotifications,
    clubNotificationsUnreadCount,
    clubNotificationsDateFilter,
    setClubNotificationsDateFilter,
    clubNotificationsScopeType,
    setClubNotificationsScopeType,
    clubNotificationsScopeValue,
    setClubNotificationsScopeValue,
    clubNotificationTeamGroups,
    clubNotificationTrainingGroups,
    filteredClubNotifications,
    handleEnableClubNotifications,
    handleDisableClubNotifications,
    handleOpenClubNotificationsPanel,
  };
}

export type ClubNotifications = ReturnType<typeof useClubNotifications>;
