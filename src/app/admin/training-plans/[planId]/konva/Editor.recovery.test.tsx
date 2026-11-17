vi.mock("@/lib/exercise/useTrainingPlanAccess", () => ({ useTrainingPlanAccess: () => ({ access: {canSave:true,canPrint:true}, error: "" }), trainingSubscriptionMessage: "Subscription required", trainingSubscriptionInactiveMessage: "Inactive subscription" }));
import { afterEach, expect, it, vi } from "vitest";
import { type ReactElement, type ReactNode } from "react";
import { EMPTY_EXERCISE } from "@/lib/exercise/model";
import { draftKey, readDraft } from "@/lib/exercise/drafts";
import Editor from "./Editor";

// Exercise the editor's handlers and effects without mounting the Konva canvas.
const hooks = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0, changed: false,
  effects: [] as (() => void)[], cleanups: [] as (() => void)[],
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState(initial: unknown) {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = initial;
    return [hooks.slots[index], (value: unknown) => {
      const next = typeof value === "function" ? value(hooks.slots[index]) : value;
      if (!Object.is(next, hooks.slots[index])) hooks.changed = true;
      hooks.slots[index] = next;
    }];
  },
  useRef(initial: unknown) {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
    return hooks.slots[index];
  },
  useEffect(effect: () => (() => void) | void, deps?: unknown[]) {
    const index = hooks.cursor++;
    const previous = hooks.slots[index] as unknown[] | undefined;
    if (!deps || !previous || deps.some((value, i) => !Object.is(value, previous[i]))) {
      hooks.slots[index] = deps;
      hooks.effects.push(() => {
        hooks.cleanups[index]?.();
        hooks.cleanups[index] = effect() || (() => {});
      });
    }
  },
  useMemo: (fn: () => unknown) => fn(),
  useCallback: (fn: unknown) => fn,
  useId: () => `id-${hooks.cursor++}`,
  useSyncExternalStore: () => false,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./Canvas", () => ({ default: () => null }));
vi.mock("./Visuals", () => ({ EquipmentPreview: () => null }));

function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...nodes(element.props.children as ReactNode)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string") return node;
  if (node && typeof node === "object" && "props" in node)
    return text((node as ReactElement<{ children?: ReactNode }>).props.children);
  return "";
}
function unmount() {
  hooks.cleanups.forEach((cleanup) => cleanup());
  hooks.slots = []; hooks.cleanups = []; hooks.effects = [];
}
afterEach(() => { unmount(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it.each(["debounce", "pagehide"])("keeps a stale draft conflicted after %s persistence and reopening", (persistence) => {
  vi.useFakeTimers();
  const baseA = "2026-11-10T10:00:00.000Z";
  const baseB = "2026-11-15T10:00:00.000Z";
  const key = draftKey("user", "club", "plan");
  const storage = new Map([[key, JSON.stringify({
    baseRevision: baseA, layout: EMPTY_EXERCISE, title: "Draft A", savedAt: 1,
  })]]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  const events = new EventTarget();
  vi.stubGlobal("window", events);
  vi.stubGlobal("document", new EventTarget());
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  let tree: ReactNode;
  function render() {
    do {
      hooks.changed = false; hooks.cursor = 0;
      tree = Editor({
        plan: { id: "plan", title: "Server B", layout: EMPTY_EXERCISE, updatedAt: baseB },
        clubId: "club", userId: "user", categories: [],
      });
      hooks.effects.splice(0).forEach((effect) => effect());
    } while (hooks.changed);
  }
  function click(label: string) {
    const button = nodes(tree).find((node) => node.type === "button" && text(node.props.children as ReactNode) === label);
    expect(button, label).toBeDefined();
    (button!.props.onClick as () => void)();
    render();
  }
  render();
  click("Възстанови");
  click("Отказ");
  if (persistence === "debounce") vi.advanceTimersByTime(600);
  else events.dispatchEvent(new Event("pagehide"));
  expect(readDraft(storage.get(key)!)?.baseRevision).toBe(baseA);
  expect(readDraft(storage.get(key)!)?.title).toBe("Draft A");
  unmount();
  render();
  click("Възстанови");
  click("Отказ");
  click("Запази");
  expect(text(tree)).toContain("Има по-нов запис");
  expect(text(tree)).toContain("Запази като нов план");
  expect(text(tree)).toContain("Зареди от сървъра");
  expect(fetch).not.toHaveBeenCalled();
});
