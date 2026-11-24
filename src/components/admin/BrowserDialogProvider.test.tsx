import { beforeEach, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ setCurrent: vi.fn(), cleanup: [] as (() => void)[] }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: () => [null, hooks.setCurrent],
  useRef: (initial: unknown) => ({ current: initial }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) hooks.cleanup.push(cleanup);
  },
}));
import { BrowserDialogProvider } from "./BrowserDialogProvider";

type Request = { finish: (result: boolean | string | null | undefined) => void };
type Open = (kind: "alert" | "confirm" | "prompt", message: string, initial: string, signal: AbortSignal, options?: { title?: string; confirmLabel?: string }) => Promise<unknown>;
function setup() {
  const provider = BrowserDialogProvider({ children: null });
  const open = (provider.props as { value: Open }).value;
  const signal = new AbortController().signal;
  return { open, signal, current: () => hooks.setCurrent.mock.lastCall?.[0] as Request | null };
}
beforeEach(() => { hooks.setCurrent.mockReset(); hooks.cleanup = []; });

it("keeps overlapping alerts in order without losing a message", async () => {
  const { open, signal, current } = setup();
  const first = open("alert", "Първо", "", signal);
  const firstRequest = current()!;
  const second = open("alert", "Второ", "", signal);
  expect(current()).toBe(firstRequest);
  firstRequest.finish(true);
  await expect(first).resolves.toBe(true);
  expect(current()).not.toBe(firstRequest);
  current()!.finish(null);
  await expect(second).resolves.toBe(null);
  expect(current()).toBeNull();
});

it("settles a request only once", async () => {
  const { open, signal, current } = setup();
  const result = open("confirm", "Потвърждение", "", signal);
  const request = current()!;
  request.finish(true);
  request.finish(false);
  await expect(result).resolves.toBe(true);
  expect(hooks.setCurrent).toHaveBeenCalledTimes(2);
});

it("distinguishes owner removal from prompt dismissal", async () => {
  const { open, current } = setup();
  const owner = new AbortController();
  const result = open("prompt", "Име", "default", owner.signal);
  owner.abort();
  await expect(result).resolves.toBeUndefined();
  expect(current()).toBeNull();
  await expect(open("confirm", "Потвърждение", "", owner.signal)).resolves.toBeUndefined();
});

it("removes an aborted queued request without closing the active dialog", async () => {
  const { open, signal, current } = setup();
  const first = open("alert", "Първо", "", signal);
  const firstRequest = current()!;
  const owner = new AbortController();
  const queued = open("confirm", "Второ", "", owner.signal);
  owner.abort();
  await expect(queued).resolves.toBeUndefined();
  expect(current()).toBe(firstRequest);
  firstRequest.finish(true);
  await first;
  expect(current()).toBeNull();
});

it("cancels active and queued requests when the provider is removed", async () => {
  const { open, signal, current } = setup();
  const first = open("alert", "Първо", "", signal);
  const second = open("prompt", "Второ", "", signal);
  hooks.cleanup.forEach((cleanup) => cleanup());
  await expect(first).resolves.toBeUndefined();
  await expect(second).resolves.toBeUndefined();
  expect(current()).toBeNull();
});

it("keeps custom confirmation labels on the request", async () => {
  const { open, signal, current } = setup();
  const result = open("confirm", "Да излезете ли?", "", signal, { title: "Незапазени промени", confirmLabel: "Излез" });
  expect(current()).toMatchObject({ options: { title: "Незапазени промени", confirmLabel: "Излез" } });
  current()!.finish(true);
  await expect(result).resolves.toBe(true);
});
