import { afterEach, expect, it, vi } from "vitest";
import { createMemberNotificationInbox } from "./memberNotificationInbox";

const unread = { notifications: [{ id: "old", readAt: null }], unreadCount: 1 };
const read = { notifications: [{ id: "old", readAt: "2026-11-23T12:00:00Z" }], unreadCount: 0 };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function setup() {
  const callbacks = { onData: vi.fn(), onLoading: vi.fn(), onError: vi.fn() };
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  return { ...callbacks, fetcher, inbox: createMemberNotificationInbox("CARD", callbacks) };
}
afterEach(() => vi.unstubAllGlobals());

it("always saves when opening the bell, even without a previously loaded unread count", async () => {
  const { inbox, fetcher, onData } = setup();
  fetcher.mockResolvedValueOnce(json({ success: true, markedRead: 1 })).mockResolvedValueOnce(json(read));
  await inbox.refresh(true);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    "/api/members/CARD/notifications/read", "/api/members/CARD/notifications",
  ]);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", keepalive: true });
  expect(onData).toHaveBeenCalledExactlyOnceWith(read);
});

it("does not allow a slow background response to restore the unread badge", async () => {
  const { inbox, fetcher, onData } = setup();
  const oldRequest = deferred<Response>();
  fetcher.mockReturnValueOnce(oldRequest.promise)
    .mockResolvedValueOnce(json({ success: true })).mockResolvedValueOnce(json(read));
  const background = inbox.refresh();
  await inbox.refresh(true);
  oldRequest.resolve(json(unread));
  await background;
  expect(onData).toHaveBeenCalledExactlyOnceWith(read);
});

it("waits for the save and coalesces refreshes while it is pending", async () => {
  const { inbox, fetcher, onData } = setup();
  const save = deferred<Response>();
  fetcher.mockReturnValueOnce(save.promise).mockResolvedValueOnce(json(read));
  const opening = inbox.refresh(true);
  await inbox.refresh();
  await inbox.refresh(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(onData).not.toHaveBeenCalled();
  save.resolve(json({ success: true }));
  await opening;
  expect(onData).toHaveBeenCalledExactlyOnceWith(read);
});

it("preserves unread state after a failed save, exposes an error, and allows retry", async () => {
  const { inbox, fetcher, onData, onError, onLoading } = setup();
  fetcher.mockResolvedValueOnce(json({ error: "Database unavailable" }, 500))
    .mockResolvedValueOnce(json(unread));
  await inbox.refresh(true);
  expect(onData).toHaveBeenLastCalledWith(unread);
  expect(onError).toHaveBeenLastCalledWith(expect.stringContaining("Неуспешно отбелязване"));
  expect(onLoading).toHaveBeenLastCalledWith(false);
  fetcher.mockResolvedValueOnce(json({ success: true })).mockResolvedValueOnce(json(read));
  await inbox.refresh(true);
  expect(onData).toHaveBeenLastCalledWith(read);
  expect(onError).toHaveBeenLastCalledWith("");
});

it("keeps a notification arriving after the save unread instead of clearing every badge", async () => {
  const { inbox, fetcher, onData } = setup();
  const newArrival = { notifications: [...read.notifications, { id: "new", readAt: null }], unreadCount: 1 };
  fetcher.mockResolvedValueOnce(json({ success: true })).mockResolvedValueOnce(json(newArrival));
  await inbox.refresh(true);
  expect(onData).toHaveBeenCalledExactlyOnceWith(newArrival);
});

it("reports failed history loading and does not replace existing data", async () => {
  const { inbox, fetcher, onData, onError } = setup();
  fetcher.mockResolvedValueOnce(json({ success: true })).mockRejectedValueOnce(new TypeError("Offline"));
  await inbox.refresh(true);
  expect(onData).not.toHaveBeenCalled();
  expect(onError).toHaveBeenLastCalledWith(expect.stringContaining("Неуспешно зареждане"));
});

it("ignores results from a previous card or an unmounted page", async () => {
  const { inbox, fetcher, onData, onError } = setup();
  const pending = deferred<Response>();
  fetcher.mockReturnValueOnce(pending.promise);
  const refresh = inbox.refresh();
  inbox.cancel();
  pending.resolve(json(unread));
  await refresh;
  expect(onData).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});
