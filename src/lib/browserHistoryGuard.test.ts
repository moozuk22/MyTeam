import { expect, it, vi } from "vitest";
import { guardBrowserHistory, trackBrowserHistory } from "./browserHistoryGuard";

function browser() {
  const events = new EventTarget();
  const entries = [{ state: { __NA: true, tree: "list" }, url: "/list" }];
  let index = 0;
  const jobs: (() => void)[] = [];
  const history = {
    get state() { return entries[index].state; },
    pushState(state: object, _title: string, url?: string | URL | null) {
      entries.splice(++index, entries.length, { state: state as typeof entries[0]["state"], url: String(url) });
    },
    replaceState(state: object, _title: string, url?: string | URL | null) {
      entries[index] = { state: state as typeof entries[0]["state"], url: url == null ? entries[index].url : String(url) };
    },
    go(delta: number) {
      jobs.push(() => {
        index += delta;
        const event = new Event("popstate");
        Object.defineProperty(event, "state", { value: history.state });
        events.dispatchEvent(event);
      });
    },
  };
  const window = { history, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) } as unknown as Window;
  const flush = () => { while (jobs.length) jobs.shift()!(); };
  return { window, history, entries, flush, url: () => entries[index].url };
}

it("asks before browser Back and preserves the editor when cancelled", async () => {
  const app = browser();
  trackBrowserHistory(app.window);
  app.history.pushState({ __NA: true, tree: "editor" }, "", "/editor");
  const confirm = vi.fn(async () => false);
  const router = vi.fn();
  app.window.addEventListener("popstate", router);
  guardBrowserHistory(app.window, confirm);
  app.history.go(-1);
  app.flush();
  await Promise.resolve();
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(app.url()).toBe("/editor");
  expect(router).not.toHaveBeenCalled();
  expect(app.entries).toHaveLength(2);
});

it("replays the original history traversal once after approval", async () => {
  const app = browser();
  trackBrowserHistory(app.window);
  app.history.pushState({ __NA: true }, "", "/middle");
  app.history.pushState({ __NA: true }, "", "/editor");
  guardBrowserHistory(app.window, async () => true);
  const router = vi.fn();
  app.window.addEventListener("popstate", router);
  app.history.go(-2);
  app.flush();
  await Promise.resolve();
  app.flush();
  expect(app.url()).toBe("/list");
  expect(router).toHaveBeenCalledTimes(1);
  expect(app.entries).toHaveLength(3);
});

it("keeps Next.js state and the position when the editor URL is replaced after a save", () => {
  const app = browser();
  trackBrowserHistory(app.window);
  app.history.pushState({ __NA: true, tree: "editor" }, "", "/new");
  const position = app.history.state;
  app.history.replaceState(null as unknown as object, "", "/saved");
  expect(app.history.state).toEqual(position);
});

it("does not resume a pending traversal after the editor is removed", async () => {
  const app = browser();
  trackBrowserHistory(app.window);
  app.history.pushState({ __NA: true }, "", "/editor");
  let resolve!: (approved: boolean) => void;
  const remove = guardBrowserHistory(app.window, () => new Promise((done) => { resolve = done; }));
  app.history.go(-1);
  app.flush();
  remove();
  resolve(true);
  await Promise.resolve();
  app.flush();
  expect(app.url()).toBe("/editor");
});

it("guards browser Forward and keeps the editor when cancelled", async () => {
  const app = browser();
  trackBrowserHistory(app.window);
  app.history.pushState({ __NA: true }, "", "/editor");
  app.history.pushState({ __NA: true }, "", "/future");
  app.history.go(-1);
  app.flush();
  const confirm = vi.fn(async () => false);
  guardBrowserHistory(app.window, confirm);
  app.history.go(1);
  app.flush();
  await Promise.resolve();
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(app.url()).toBe("/editor");
});

it("shows one dialog for repeated Back actions while a decision is pending", async () => {
  const app = browser();
  trackBrowserHistory(app.window);
  app.history.pushState({ __NA: true }, "", "/editor");
  let resolve!: (approved: boolean) => void;
  const confirm = vi.fn(() => new Promise<boolean>((done) => { resolve = done; }));
  guardBrowserHistory(app.window, confirm);
  app.history.go(-1);
  app.flush();
  app.history.go(-1);
  app.flush();
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(app.url()).toBe("/editor");
  resolve(false);
  await Promise.resolve();
  app.history.go(-1);
  app.flush();
  expect(confirm).toHaveBeenCalledTimes(2);
});

it("allows normal browser Back after the guard is removed following a save", () => {
  const app = browser();
  trackBrowserHistory(app.window);
  app.history.pushState({ __NA: true }, "", "/editor");
  const confirm = vi.fn(async () => false);
  const remove = guardBrowserHistory(app.window, confirm);
  remove();
  app.history.go(-1);
  app.flush();
  expect(app.url()).toBe("/list");
  expect(confirm).not.toHaveBeenCalled();
});

it("restores the original history methods after tracking stops", () => {
  const app = browser();
  const push = app.history.pushState;
  const replace = app.history.replaceState;
  const stop = trackBrowserHistory(app.window);
  stop();
  expect(app.history.pushState).toBe(push);
  expect(app.history.replaceState).toBe(replace);
});

it("continues an approved Back action if the save finishes while the warning is open", async () => {
  const app = browser();
  trackBrowserHistory(app.window);
  app.history.pushState({ __NA: true }, "", "/new");
  let blocked = true;
  let resolve!: (approved: boolean) => void;
  guardBrowserHistory(app.window, () => new Promise((done) => { resolve = done; }), () => blocked);
  app.history.go(-1);
  app.flush();
  app.history.replaceState(null as unknown as object, "", "/saved");
  blocked = false;
  resolve(true);
  await Promise.resolve();
  app.flush();
  expect(app.url()).toBe("/list");
});

it("uses the current source after clean navigation and later edits", async () => {
  const app = browser();
  trackBrowserHistory(app.window);
  app.history.pushState({ __NA: true }, "", "/first-editor");
  app.history.pushState({ __NA: true }, "", "/second-editor");
  let blocked = false;
  const confirm = vi.fn(async () => false);
  guardBrowserHistory(app.window, confirm, () => blocked);
  app.history.go(-1);
  app.flush();
  expect(app.url()).toBe("/first-editor");
  expect(confirm).not.toHaveBeenCalled();
  blocked = true;
  app.history.go(-1);
  app.flush();
  await Promise.resolve();
  expect(app.url()).toBe("/first-editor");
  expect(confirm).toHaveBeenCalledTimes(1);
});

it("guards later edits if the editor stays mounted after an approved traversal", async () => {
  const app = browser();
  trackBrowserHistory(app.window);
  app.history.pushState({ __NA: true }, "", "/editor");
  const confirm = vi.fn(async () => true);
  guardBrowserHistory(app.window, confirm);
  app.history.go(-1);
  app.flush();
  await Promise.resolve();
  app.flush();
  app.history.pushState({ __NA: true }, "", "/next-editor");
  app.history.go(-1);
  app.flush();
  await Promise.resolve();
  app.flush();
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(app.url()).toBe("/list");
});
