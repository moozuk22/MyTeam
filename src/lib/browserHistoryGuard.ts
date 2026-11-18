const positionKey = "__myteamHistoryPosition";
type Tracker = { current: number | null; onPopState?: (event: PopStateEvent, source: number | null) => void };
const trackers = new WeakMap<Window, Tracker>();

function position(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>)[positionKey];
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

export function trackBrowserHistory(browser: Window): () => void {
  const tracker: Tracker = { current: position(browser.history.state) ?? 0 };
  trackers.set(browser, tracker);
  const onPopState = (event: PopStateEvent) => {
    const source = tracker.current;
    tracker.current = position(event.state);
    tracker.onPopState?.(event, source);
  };
  browser.addEventListener("popstate", onPopState, true);
  const history = browser.history;
  const push = history.pushState;
  const replace = history.replaceState;
  let active = true;
  const withPosition = (data: unknown, value: number) => ({ ...(data ?? history.state), [positionKey]: value });
  replace.call(history, withPosition(history.state, position(history.state) ?? 0), "");
  const pushState: History["pushState"] = function (data, unused, url) {
    push.call(history, active ? withPosition(data, (position(history.state) ?? 0) + 1) : data, unused, url);
    if (active) tracker.current = position(history.state);
  };
  const replaceState: History["replaceState"] = function (data, unused, url) {
    replace.call(history, active ? withPosition(data, position(history.state) ?? 0) : data, unused, url);
    if (active) tracker.current = position(history.state);
  };
  history.pushState = pushState;
  history.replaceState = replaceState;
  return () => {
    active = false;
    browser.removeEventListener("popstate", onPopState, true);
    if (trackers.get(browser) === tracker) trackers.delete(browser);
    if (history.pushState === pushState) history.pushState = push;
    if (history.replaceState === replaceState) history.replaceState = replace;
  };
}

export function guardBrowserHistory(browser: Window, requestConfirmation: () => Promise<boolean>, shouldBlock: () => boolean = () => true): () => void {
  const tracker = trackers.get(browser);
  if (!tracker) return () => {};
  let source: number | null = null;
  let target: number | null = null;
  let restoring = false;
  let pending = false;
  let approved = false;
  let bypass = false;
  let active = true;

  const resume = () => {
    if (!active || restoring || target === null || source === null) return;
    bypass = true;
    browser.history.go(target - source);
  };
  const ask = () => {
    if (pending || target === null) return;
    pending = true;
    void requestConfirmation().then((confirmed) => {
      if (!active) return;
      if (confirmed) {
        approved = true;
        resume();
      } else {
        target = null;
        pending = false;
      }
    }, () => {
      target = null;
      pending = false;
    });
  };
  const onPopState = (event: PopStateEvent, previous: number | null) => {
    if (!active) return;
    if (bypass) {
      bypass = false;
      target = null;
      pending = false;
      approved = false;
      return;
    }
    if (!pending && !restoring && !shouldBlock()) return;
    const destination = position(event.state);
    if (destination === null) return;
    if (target === null && !restoring) source = previous;
    if (source === null) return;
    if (destination === source) {
      if (restoring) {
        event.stopImmediatePropagation();
        restoring = false;
        if (approved) resume();
        else ask();
      }
      return;
    }
    // Restore the editor before Next.js can render the destination page.
    event.stopImmediatePropagation();
    target ??= destination;
    restoring = true;
    browser.history.go(source - destination);
  };
  tracker.onPopState = onPopState;
  return () => {
    active = false;
    if (tracker.onPopState === onPopState) tracker.onPopState = undefined;
  };
}
