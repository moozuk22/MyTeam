import type { BrowserPushSubscription } from "@/lib/push/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function parseBrowserPushSubscription(
  value: unknown
): BrowserPushSubscription | null {
  const subscription = asRecord(value);
  if (!subscription) {
    return null;
  }

  const endpoint = subscription.endpoint;
  const keys = asRecord(subscription.keys);

  if (typeof endpoint !== "string" || endpoint.trim() === "") {
    return null;
  }

  if (!keys) {
    return null;
  }

  const p256dh = keys.p256dh;
  const auth = keys.auth;

  if (typeof p256dh !== "string" || typeof auth !== "string") {
    return null;
  }

  const expirationTime =
    typeof subscription.expirationTime === "number" || subscription.expirationTime === null
      ? subscription.expirationTime
      : undefined;

  return {
    endpoint: endpoint.trim(),
    expirationTime,
    keys: {
      p256dh,
      auth,
    },
  };
}
