"use client";

import {
  detectIPhoneSafari,
  getCompatiblePushSubscription,
  isStandaloneMode,
  registerServiceWorker,
} from "@/lib/push/browser";
import {
  getPushSubscribeDiagnostics,
  reportPushClientError,
} from "@/lib/push/clientDiagnostics";
import { useEffect, useState } from "react";

export function usePushSubscription(cardCode: string) {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");

  const [isSupported, setIsSupported] = useState(true);

  const [isSubscribed, setIsSubscribed] = useState(false);

  const [isBusy, setIsBusy] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  const [isIPhoneSafari, setIsIPhoneSafari] = useState(false);

  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const supportsPush =
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supportsPush);
    setPermission(
      "Notification" in window ? Notification.permission : "denied",
    );
    const iosSafari = detectIPhoneSafari();
    setIsIPhoneSafari(iosSafari);
    setIsStandalone(isStandaloneMode());

    if (!supportsPush) {
      return;
    }

    let cancelled = false;

    const prepare = async () => {
      try {
        const registration = await registerServiceWorker();
        const currentSubscription =
          await registration.pushManager.getSubscription();
        if (!currentSubscription) {
          if (!cancelled) {
            setIsSubscribed(false);
          }
          return;
        }

        const search = new URLSearchParams({
          endpoint: currentSubscription.endpoint,
        });
        const response = await fetch(
          `/api/members/${encodeURIComponent(cardCode)}/push-subscriptions?${search.toString()}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          if (!cancelled) {
            setIsSubscribed(false);
          }
          return;
        }

        const payload = (await response.json()) as { isActive?: unknown };
        if (!cancelled) {
          setIsSubscribed(Boolean(payload.isActive));
        }
      } catch (error) {
        console.error("Service worker registration error:", error);
      }
    };

    void prepare();

    return () => {
      cancelled = true;
    };
  }, [cardCode]);

  const handleEnableNotifications = async () => {
    setStatusMessage("");
    setErrorMessage("");

    if (!isSupported) {
      setErrorMessage(
        "Този браузър не поддържа push notifications или липсва HTTPS.",
      );
      return;
    }

    if (isIPhoneSafari && !isStandalone) {
      setErrorMessage(
        "На iPhone push известията работят само след Add to Home Screen и отваряне на приложението от иконата.",
      );
      return;
    }

    setIsBusy(true);

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission === "denied") {
        setErrorMessage("Достъпът до известия е отказан от браузъра.");
        setIsSubscribed(false);
        return;
      }

      if (nextPermission !== "granted") {
        setStatusMessage("Разрешението за известия не беше дадено.");
        return;
      }

      const registration = await registerServiceWorker();
      const publicKeyResponse = await fetch("/api/push/public-key", {
        cache: "no-store",
      });
      if (!publicKeyResponse.ok) {
        const errorPayload = await publicKeyResponse
          .json()
          .catch(() => ({ error: "Missing VAPID configuration" }));
        throw new Error(
          String(errorPayload.error ?? "Failed to get VAPID public key"),
        );
      }

      const { publicKey } = (await publicKeyResponse.json()) as {
        publicKey: string;
      };
      let subscription: PushSubscription;

      try {
        subscription = await getCompatiblePushSubscription(
          registration,
          publicKey,
        );
      } catch (subscribeError) {
        const diagnostics = await getPushSubscribeDiagnostics(
          registration,
          publicKey,
        );

        if (
          subscribeError instanceof DOMException &&
          subscribeError.name === "AbortError"
        ) {
          void reportPushClientError({
            cardCode,
            phase: "subscribe",
            errorName: subscribeError.name,
            errorMessage: subscribeError.message,
            diagnostics,
          });
          console.error("Push subscribe AbortError diagnostics:", {
            name: subscribeError.name,
            message: subscribeError.message,
            diagnostics,
          });
          throw new Error(
            "Push subscription failed at browser push service. Disable ad blockers/privacy extensions for this site, avoid Incognito/Guest mode, and allow access to fcm.googleapis.com, then retry.",
          );
        }

        const fallbackErrorName =
          subscribeError instanceof Error
            ? subscribeError.name
            : "UnknownError";
        const fallbackErrorMessage =
          subscribeError instanceof Error
            ? subscribeError.message
            : String(subscribeError);

        void reportPushClientError({
          cardCode,
          phase: "subscribe",
          errorName: fallbackErrorName,
          errorMessage: fallbackErrorMessage,
          diagnostics,
        });
        console.error("Push subscribe unexpected error diagnostics:", {
          error: subscribeError,
          diagnostics,
        });
        throw subscribeError;
      }

      const saveResponse = await fetch(
        `/api/members/${encodeURIComponent(cardCode)}/push-subscriptions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
          }),
        },
      );

      if (!saveResponse.ok) {
        const payload = await saveResponse.json().catch(() => ({
          error: "Failed to save subscription",
        }));
        throw new Error(String(payload.error ?? "Failed to save subscription"));
      }

      setIsSubscribed(true);
      setStatusMessage("Известията са активирани успешно.");
    } catch (error) {
      console.error("Enable notifications error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Неуспешно активиране на известията.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisableNotifications = async () => {
    setStatusMessage("");
    setErrorMessage("");
    setIsBusy(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      const endpoint = subscription.endpoint;

      const deleteResponse = await fetch(
        `/api/members/${encodeURIComponent(cardCode)}/push-subscriptions`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ endpoint }),
        },
      );

      if (!deleteResponse.ok) {
        const payload = await deleteResponse.json().catch(() => ({
          error: "Failed to disable subscription",
        }));
        throw new Error(
          String(payload.error ?? "Failed to disable subscription"),
        );
      }

      const deletePayload = (await deleteResponse.json().catch(() => ({}))) as {
        shouldUnsubscribeBrowser?: unknown;
      };

      if (deletePayload.shouldUnsubscribeBrowser !== false) {
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setStatusMessage("Известията са изключени.");
    } catch (error) {
      console.error("Disable notifications error:", error);
      setErrorMessage("Неуспешно изключване на известията.");
    } finally {
      setIsBusy(false);
    }
  };
  return {
    permission,
    isSupported,
    isSubscribed,
    isBusy,
    statusMessage,
    errorMessage,
    isIPhoneSafari,
    isStandalone,
    handleEnableNotifications,
    handleDisableNotifications,
  };
}
