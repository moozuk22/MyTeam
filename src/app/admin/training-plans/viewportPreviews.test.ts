import { afterEach, expect, it, vi } from "vitest";
import { EMPTY_EXERCISE } from "@/lib/exercise/model";
import { observePreviews } from "./viewportPreviews";

let notify: (entries: IntersectionObserverEntry[]) => void;
const disconnect = vi.fn();
const observe = vi.fn();
function setup(count = 400) {
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: typeof notify) { notify = callback; }
    observe = observe;
    unobserve = vi.fn();
    disconnect = disconnect;
  });
  const cards = Array.from({ length: count }, (_, id) => ({
    dataset: { previewId: `plan-${id}`, previewKey: `plan-${id}:revision` },
  } as unknown as HTMLElement));
  const publish = vi.fn();
  const host = { querySelectorAll: () => cards } as unknown as HTMLElement;
  const stop = observePreviews(host, "club", publish);
  const visible = (indices: number[], isIntersecting: boolean) => notify(indices.map((index) => ({
    target: cards[index], isIntersecting,
  } as unknown as IntersectionObserverEntry)));
  return { publish, stop, visible };
}
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("releases drawings after scrolling through 400 exercises and reloads returning cards", async () => {
  const fetcher = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => ({ previews: new URL(url, "http://localhost").searchParams.get("ids")!.split(",")
      .map((id) => ({ id, layout: EMPTY_EXERCISE })) }),
  }));
  vi.stubGlobal("fetch", fetcher);
  const { visible, publish, stop } = setup();
  for (let index = 0; index < 400; index += 10) {
    if (index) visible(Array.from({ length: 10 }, (_, i) => index - 10 + i), false);
    visible(Array.from({ length: 10 }, (_, i) => index + i), true);
    await flush();
    const current = publish.mock.calls.at(-1)![0];
    expect(Object.keys(current)).toHaveLength(10);
    expect(current[`plan-${index}:revision`]).toEqual(EMPTY_EXERCISE);
    if (index) expect(current[`plan-${index - 10}:revision`]).toBeUndefined();
  }
  visible(Array.from({ length: 10 }, (_, i) => 390 + i), false);
  expect(publish.mock.calls.at(-1)![0]).toEqual({});
  const previousCalls = fetcher.mock.calls.length;
  visible([0], true);
  await flush();
  expect(fetcher.mock.calls.length).toBe(previousCalls + 1);
  expect(publish.mock.calls.at(-1)![0]["plan-0:revision"]).toEqual(EMPTY_EXERCISE);
  stop();
});

it("does not restore an exited card from a late response, even after re-entry", async () => {
  let resolve!: (value: unknown) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise((done) => { resolve = done; }))
    .mockResolvedValue({ ok: true, json: async () => ({ previews: [{ id: "plan-0", layout: EMPTY_EXERCISE }] }) });
  vi.stubGlobal("fetch", fetcher);
  const { visible, publish, stop } = setup(1);
  visible([0], true);
  visible([0], false);
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  visible([0], true);
  resolve({ ok: true, json: async () => ({ previews: [{ id: "plan-0", layout: { ...EMPTY_EXERCISE, surface: "blank" } }] }) });
  await flush();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(publish.mock.calls.at(-1)![0]["plan-0:revision"]).toEqual(EMPTY_EXERCISE);
  expect(publish.mock.calls.some(([value]) => value["plan-0:revision"]?.surface === "blank")).toBe(false);
  stop();
});

it("bounds batches and concurrent requests, and skips cards that leave the queue", async () => {
  let resolve!: (value: unknown) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise((done) => { resolve = done; }))
    .mockResolvedValue({ ok: true, json: async () => ({ previews: [] }) });
  vi.stubGlobal("fetch", fetcher);
  const { visible, publish, stop } = setup(50);
  visible(Array.from({ length: 50 }, (_, i) => i), true);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const firstIds = new URL(fetcher.mock.calls[0][0], "http://localhost").searchParams.get("ids")!.split(",");
  expect(firstIds).toHaveLength(12);
  visible(Array.from({ length: 38 }, (_, i) => i + 12), false);
  resolve({ ok: true, json: async () => ({ previews: firstIds.map((id) => ({ id, layout: EMPTY_EXERCISE })) }) });
  await flush();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(Object.keys(publish.mock.calls.at(-1)![0])).toHaveLength(12);
  stop();
});

it("handles missing previews and network errors, and retries on re-entry", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue({ ok: false }));
  const { visible, publish, stop } = setup(1);
  visible([0], true);
  await flush();
  expect(publish.mock.calls.at(-1)![0]).toEqual({ "plan-0:revision": null });
  visible([0], false);
  visible([0], true);
  await flush();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(publish.mock.calls.at(-1)![0]).toEqual({ "plan-0:revision": null });
  stop();
});

it("disconnects and aborts on cleanup without publishing a late response", async () => {
  let resolve!: (value: unknown) => void;
  const fetcher = vi.fn(() => new Promise((done) => { resolve = done; }));
  vi.stubGlobal("fetch", fetcher);
  const { visible, publish, stop } = setup(1);
  visible([0], true);
  stop();
  expect(disconnect).toHaveBeenCalledOnce();
  expect((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true);
  const calls = publish.mock.calls.length;
  resolve({ ok: true, json: async () => ({ previews: [{ id: "plan-0", layout: EMPTY_EXERCISE }] }) });
  await flush();
  expect(publish).toHaveBeenCalledTimes(calls);
  expect(publish.mock.calls.at(-1)![0]).toEqual({});
});
