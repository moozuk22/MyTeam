"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(normalized);
  const output = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }

  return output.buffer;
}

function detectIPhoneSafari() {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  return isIOS && isSafari;
}

function isStandaloneMode() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

async function registerServiceWorker() {
  await navigator.serviceWorker.register("/sw.js");
  return await navigator.serviceWorker.ready;
}

interface PushNotificationsPanelProps {
  cardCode: string;
}

export function PushNotificationsPanel({ cardCode }: PushNotificationsPanelProps) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
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
    setPermission("Notification" in window ? Notification.permission : "denied");
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
        const currentSubscription = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setIsSubscribed(Boolean(currentSubscription));
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
      setErrorMessage("Този браузър не поддържа push notifications или липсва HTTPS.");
      return;
    }

    if (isIPhoneSafari && !isStandalone) {
      setErrorMessage(
        "На iPhone push известията работят само след Add to Home Screen и отваряне на приложението от иконата."
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
      const existingSubscription = await registration.pushManager.getSubscription();

      const publicKeyResponse = await fetch("/api/push/public-key", { cache: "no-store" });
      if (!publicKeyResponse.ok) {
        const errorPayload = await publicKeyResponse
          .json()
          .catch(() => ({ error: "Missing VAPID configuration" }));
        throw new Error(String(errorPayload.error ?? "Failed to get VAPID public key"));
      }

      const { publicKey } = (await publicKeyResponse.json()) as { publicKey: string };
      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

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
        }
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
        error instanceof Error ? error.message : "Неуспешно активиране на известията."
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
      await subscription.unsubscribe();

      await fetch(`/api/members/${encodeURIComponent(cardCode)}/push-subscriptions`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ endpoint }),
      });

      setIsSubscribed(false);
      setStatusMessage("Известията са изключени.");
    } catch (error) {
      console.error("Disable notifications error:", error);
      setErrorMessage("Неуспешно изключване на известията.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendTestNotification = async () => {
    setStatusMessage("");
    setErrorMessage("");
    setIsBusy(true);

    try {
      const response = await fetch(
        `/api/members/${encodeURIComponent(cardCode)}/push-test`,
        {
          method: "POST",
        }
      );

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        total?: number;
        sent?: number;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Неуспешно изпращане на тестово известие.");
      }

      if ((payload.total ?? 0) === 0) {
        setStatusMessage("Няма активна subscription сесия за това устройство.");
      } else if ((payload.sent ?? 0) > 0) {
        setStatusMessage("Тестовото известие е изпратено.");
      } else {
        setStatusMessage("Изпращането е заявено, но няма потвърдено доставяне.");
      }
    } catch (error) {
      console.error("Send test notification error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Грешка при тестово известие."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleLocalNotificationTest = async () => {
    setStatusMessage("");
    setErrorMessage("");

    try {
      if (!("Notification" in window)) {
        throw new Error("Browser notifications are not supported.");
      }

      if (Notification.permission !== "granted") {
        throw new Error("Notification permission is not granted.");
      }

      const notification = new Notification("Local Notification Test", {
        body: "If you see this, OS/browser notification display is working.",
        icon: "/logo.png",
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setStatusMessage("Local notification fired.");
    } catch (error) {
      console.error("Local notification test error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to display local notification."
      );
    }
  };

  const handleServiceWorkerNotificationTest = async () => {
    setStatusMessage("");
    setErrorMessage("");
    setIsBusy(true);

    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service Worker is not supported.");
      }
      if (!("Notification" in window)) {
        throw new Error("Browser notifications are not supported.");
      }
      if (Notification.permission !== "granted") {
        throw new Error("Notification permission is not granted.");
      }

      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("SW Notification Test", {
        body: "If you see this, service worker notifications are working.",
        icon: "/logo.png",
        badge: "/logo.png",
        tag: `sw-test-${Date.now()}`,
        data: { url: window.location.pathname },
      });

      setStatusMessage("Service worker notification fired.");
    } catch (error) {
      console.error("Service worker notification test error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to display service worker notification."
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="card mb-6"
      style={{
        textAlign: "left",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
      }}
    >
      <h3 className="text-gold mb-2" style={{ fontSize: "1rem" }}>
        Browser Notifications
      </h3>

      {!isSupported && (
        <div className="alert alert-warning" style={{ marginTop: "8px" }}>
          Този браузър не поддържа push известия. Нужни са HTTPS, Service Worker и Push API.
        </div>
      )}

      {isSupported && permission === "default" && (
        <p className="text-secondary" style={{ fontSize: "14px" }}>
          Натиснете бутона, за да разрешите известия за тази карта.
        </p>
      )}

      {isSupported && permission === "denied" && (
        <div className="alert alert-warning" style={{ marginTop: "8px" }}>
          Известията са блокирани. Разрешете ги от настройките на браузъра за този сайт.
        </div>
      )}

      {isSupported && permission === "granted" && isSubscribed && (
        <div className="alert alert-success" style={{ marginTop: "8px" }}>
          Известията са активни за това устройство.
        </div>
      )}

      {isIPhoneSafari && !isStandalone && (
        <div className="alert alert-warning" style={{ marginTop: "8px" }}>
          На iPhone Safari push известията работят само за Home Screen web app.
          <p className="mt-2 mb-0">
            1. Отворете Share менюто в Safari.
            <br />
            2. Изберете Add to Home Screen.
            <br />
            3. Отворете приложението от иконата и натиснете Enable Notifications.
          </p>
        </div>
      )}

      {statusMessage && (
        <p className="text-secondary" style={{ marginTop: "10px", fontSize: "13px" }}>
          {statusMessage}
        </p>
      )}

      {errorMessage && (
        <p className="text-secondary" style={{ marginTop: "10px", fontSize: "13px", color: "var(--error)" }}>
          {errorMessage}
        </p>
      )}

      {isSupported && (
        <div className="flex gap-3 mt-4" style={{ flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleEnableNotifications}
            className="btn btn-primary"
            disabled={isBusy || permission === "denied"}
          >
            {isBusy ? "Please wait..." : "Enable Notifications"}
          </button>

          {isSubscribed && (
            <button
              type="button"
              onClick={handleDisableNotifications}
              className="btn btn-secondary"
              disabled={isBusy}
            >
              Disable Notifications
            </button>
          )}

          {isSubscribed && (
            <button
              type="button"
              onClick={handleSendTestNotification}
              className="btn btn-secondary"
              disabled={isBusy}
            >
              Send Test Notification
            </button>
          )}

          {permission === "granted" && (
            <button
              type="button"
              onClick={handleLocalNotificationTest}
              className="btn btn-secondary"
              disabled={isBusy}
            >
              Local Notification Test
            </button>
          )}

          {permission === "granted" && (
            <button
              type="button"
              onClick={handleServiceWorkerNotificationTest}
              className="btn btn-secondary"
              disabled={isBusy}
            >
              Service Worker Notification Test
            </button>
          )}
        </div>
      )}
    </div>
  );
}
