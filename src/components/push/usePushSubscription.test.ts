import { afterEach, beforeEach, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => ({ states: [] as unknown[], cursor: 0 }));
const browser = vi.hoisted(() => ({ register: vi.fn(), subscribe: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: () => {},
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [
      harness.states[index],
      (next: unknown) => {
        harness.states[index] =
          typeof next === "function" ? next(harness.states[index]) : next;
      },
    ];
  },
}));
vi.mock("@/lib/push/browser", () => ({
  registerServiceWorker: browser.register,
  getCompatiblePushSubscription: browser.subscribe,
  detectIPhoneSafari: () => false,
  isStandaloneMode: () => false,
}));
vi.mock("@/lib/push/clientDiagnostics", () => ({
  getPushSubscribeDiagnostics: vi.fn().mockResolvedValue({}),
  reportPushClientError: vi.fn().mockResolvedValue(undefined),
}));
import { usePushSubscription } from "./usePushSubscription";
function SubscriptionHarness() {
  return usePushSubscription("A/B");
}
function renderSubscription() {
  harness.cursor = 0;
  return SubscriptionHarness();
}
beforeEach(() => {
  harness.states = [];
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("saves the compatible subscription under the encoded card path", async () => {
  const registration = {};
  browser.register.mockResolvedValue(registration);
  browser.subscribe.mockResolvedValue({
    toJSON: () => ({ endpoint: "https://push.example/device" }),
  });
  vi.stubGlobal("Notification", {
    requestPermission: vi.fn().mockResolvedValue("granted"),
  });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ publicKey: "test-key" }))
    .mockResolvedValueOnce(Response.json({ success: true }));
  vi.stubGlobal("fetch", fetch);
  await renderSubscription().handleEnableNotifications();
  expect(browser.subscribe).toHaveBeenCalledWith(registration, "test-key");
  expect(fetch).toHaveBeenLastCalledWith(
    "/api/members/A%2FB/push-subscriptions",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        subscription: { endpoint: "https://push.example/device" },
      }),
    }),
  );
  expect(renderSubscription()).toMatchObject({
    isSubscribed: true,
    isBusy: false,
    errorMessage: "",
  });
});
it("stops before subscribing when permission is denied", async () => {
  vi.stubGlobal("Notification", {
    requestPermission: vi.fn().mockResolvedValue("denied"),
  });
  await renderSubscription().handleEnableNotifications();
  expect(browser.register).not.toHaveBeenCalled();
  expect(renderSubscription()).toMatchObject({
    isSubscribed: false,
    isBusy: false,
    permission: "denied",
  });
});
it("does not mark the device subscribed when saving fails", async () => {
  browser.register.mockResolvedValue({});
  browser.subscribe.mockResolvedValue({ toJSON: () => ({ endpoint: "test" }) });
  vi.stubGlobal("Notification", {
    requestPermission: vi.fn().mockResolvedValue("granted"),
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ publicKey: "key" }))
      .mockResolvedValueOnce(
        Response.json({ error: "Тестова грешка" }, { status: 500 }),
      ),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  await renderSubscription().handleEnableNotifications();
  expect(renderSubscription()).toMatchObject({
    isSubscribed: false,
    isBusy: false,
    errorMessage: "Тестова грешка",
  });
});
it("deactivates the server subscription and unsubscribes the browser", async () => {
  const unsubscribe = vi.fn().mockResolvedValue(true);
  const registration = {
    pushManager: {
      getSubscription: vi
        .fn()
        .mockResolvedValue({
          endpoint: "https://push.example/device",
          unsubscribe,
        }),
    },
  };
  vi.stubGlobal("navigator", {
    serviceWorker: { ready: Promise.resolve(registration) },
  });
  const fetch = vi.fn().mockResolvedValue(Response.json({ success: true }));
  vi.stubGlobal("fetch", fetch);
  await renderSubscription().handleDisableNotifications();
  expect(fetch).toHaveBeenCalledWith(
    "/api/members/A%2FB/push-subscriptions",
    expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({ endpoint: "https://push.example/device" }),
    }),
  );
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(renderSubscription()).toMatchObject({
    isSubscribed: false,
    isBusy: false,
    errorMessage: "",
  });
});
