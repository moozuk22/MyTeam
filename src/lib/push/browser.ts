export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(normalized);
  const output = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }

  return output;
}

function buffersEqual(left: ArrayBuffer | null, right: Uint8Array) {
  if (!left) {
    return true;
  }

  const leftBytes = new Uint8Array(left);
  if (leftBytes.length !== right.length) {
    return false;
  }

  for (let i = 0; i < leftBytes.length; i += 1) {
    if (leftBytes[i] !== right[i]) {
      return false;
    }
  }

  return true;
}

export async function getCompatiblePushSubscription(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
) {
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  const existingSubscription = await registration.pushManager.getSubscription();

  if (existingSubscription) {
    const existingKey =
      existingSubscription.options?.applicationServerKey ?? null;

    if (buffersEqual(existingKey, applicationServerKey)) {
      return existingSubscription;
    }

    await existingSubscription.unsubscribe();
  }

  return await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as unknown as BufferSource,
  });
}

export function detectIPhoneSafari() {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  return isIOS && isSafari;
}

export function isStandaloneMode() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

export async function registerServiceWorker() {
  await navigator.serviceWorker.register("/sw.js");
  return await navigator.serviceWorker.ready;
}
