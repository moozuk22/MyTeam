import { isStandaloneMode } from "./browser";

export type NotificationPermissionState =
  PermissionState | "unsupported" | "unavailable";

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (
    !("permissions" in navigator) ||
    typeof navigator.permissions.query !== "function"
  ) {
    return "unsupported";
  }

  try {
    const result = await navigator.permissions.query({
      name: "notifications" as PermissionName,
    });
    return result.state;
  } catch {
    return "unavailable";
  }
}

export async function getPushSubscribeDiagnostics(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
) {
  const swState =
    registration.active?.state ??
    registration.installing?.state ??
    registration.waiting?.state ??
    "none";

  return {
    isSecureContext: window.isSecureContext,
    notificationPermission: Notification.permission,
    permissionApiState: await getNotificationPermissionState(),
    isOnline: navigator.onLine,
    visibilityState: document.visibilityState,
    serviceWorkerController: Boolean(navigator.serviceWorker.controller),
    serviceWorkerState: swState,
    supportsPushManager: "PushManager" in window,
    standaloneDisplayMode: isStandaloneMode(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    vapidPublicKeyLength: vapidPublicKey.length,
    timestamp: new Date().toISOString(),
  };
}

export async function reportPushClientError(payload: {
  cardCode: string;
  phase: "subscribe";
  errorName: string;
  errorMessage: string;
  diagnostics: Awaited<ReturnType<typeof getPushSubscribeDiagnostics>>;
}) {
  try {
    await fetch("/api/push/client-error", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Best-effort reporting only; user flow must continue.
  }
}
