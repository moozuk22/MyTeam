import { afterEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const hooks = vi.hoisted(() => ({
  values: [] as unknown[], cursor: 0, effectCursor: 0,
  effects: [] as Array<{ deps: unknown[]; cleanup?: () => void }>,
  pending: [] as Array<() => void>, request: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useId: () => "drawing-search",
  useRef: (initial: unknown) => ({ current: initial }),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => {
      hooks.values[index] = typeof value === "function" ? value(hooks.values[index]) : value;
    }];
  },
  useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
    const index = hooks.effectCursor++;
    const previous = hooks.effects[index];
    if (previous && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
    hooks.pending.push(() => {
      previous?.cleanup?.();
      hooks.effects[index] = { deps, cleanup: effect() };
    });
  },
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("./documentRequest", () => ({ documentRequest: hooks.request }));
import DrawingPicker from "./DrawingPicker";
import DocumentFields from "./DocumentFields";
import { blankDocument } from "@/lib/exercise/document";

function reset() {
  hooks.effects.forEach((effect) => effect.cleanup?.());
  hooks.values = []; hooks.cursor = 0; hooks.effectCursor = 0;
  hooks.effects = []; hooks.pending = [];
}
afterEach(() => { reset(); hooks.request.mockReset(); });
function find(node: ReactNode, predicate: (props: Record<string, unknown>) => boolean): ReactElement<Record<string, unknown>> {
  if (isValidElement<Record<string, unknown>>(node)) {
    if (predicate(node.props)) return node;
    for (const child of [node.props.children].flat(Infinity) as ReactNode[]) {
      try { return find(child, predicate); } catch { /* Inspect the next child. */ }
    }
  }
  throw new Error("Control not found");
}
function setup() {
  const props = { endpoint: "/drawings", location: "clubId=club", onPick: vi.fn(), onClose: vi.fn() };
  function render() {
    hooks.cursor = 0; hooks.effectCursor = 0;
    const tree = DrawingPicker(props);
    hooks.pending.splice(0).forEach((effect) => effect());
    return tree;
  }
  const click = (label: string) => (find(render(), (props) => props.children === label).props.onClick as () => void)();
  const search = (value: string) => (find(render(), (props) => props.type === "search").props.onChange as (event: unknown) => void)({ target: { value } });
  const query = () => new URL(hooks.request.mock.calls.at(-1)![0], "http://localhost").searchParams;
  return { render, click, search, query };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

it("opens on Mine and retains the search when switching filters", () => {
  hooks.request.mockReturnValue(new Promise(() => {}));
  const picker = setup();
  expect(find(picker.render(), (props) => props.children === "Мои").props["aria-pressed"]).toBe(true);
  expect(picker.query().get("scope")).toBe("mine");
  picker.search("  Пас  "); picker.render();
  expect(picker.query().get("search")).toBe("Пас");
  picker.click("Клубни"); picker.render();
  expect(picker.query().get("scope")).toBe("club");
  expect(picker.query().get("search")).toBe("Пас");
  expect(find(picker.render(), (props) => props.type === "search").props.value).toBe("  Пас  ");
});

it("shows separate messages for an empty scope and no search matches", async () => {
  hooks.request.mockResolvedValue({ plans: [], nextCursor: null });
  const picker = setup(); picker.render(); await flush();
  expect(find(picker.render(), (props) => props.className === "td-muted").props.children).toBe("Няма запазени упражнения в избрания филтър.");
  picker.search("липсва"); picker.render(); await flush();
  expect(find(picker.render(), (props) => props.className === "td-muted").props.children).toBe("Няма упражнения, които отговарят на търсенето.");
});

it("starts on Mine with no search after an unmount and reopen", () => {
  hooks.request.mockReturnValue(new Promise(() => {}));
  const picker = setup(); picker.click("Клубни"); picker.search("Пас"); picker.render();
  reset();
  picker.render();
  expect(picker.query().get("scope")).toBe("mine");
  expect(picker.query().get("search")).toBe("");
});

it("clears the page cursor on search and scope changes", async () => {
  hooks.request.mockResolvedValue({ plans: [], nextCursor: "next-page" });
  const picker = setup(); picker.render(); await flush();
  picker.click("Следваща страница"); picker.render();
  expect(picker.query().get("cursor")).toBe("next-page");
  picker.search("Пас"); picker.render();
  expect(picker.query().has("cursor")).toBe(false);
  await flush(); picker.click("Следваща страница"); picker.render();
  picker.click("Клубни"); picker.render();
  expect(picker.query().has("cursor")).toBe(false);
});

it("ignores an obsolete list response after a filter change", async () => {
  let resolveOld!: (value: unknown) => void;
  hooks.request.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValue({ plans: [], nextCursor: null });
  const picker = setup(); picker.render();
  const signal = hooks.request.mock.calls[0][2].signal as AbortSignal;
  picker.click("Клубни"); picker.render(); await flush();
  expect(signal.aborted).toBe(true);
  resolveOld({ plans: [{ id: "old", title: "Old", layoutVersion: 2 }], nextCursor: null }); await flush();
  expect(find(picker.render(), (props) => props.className === "td-muted").props.children).toBe("Няма запазени упражнения в избрания филтър.");
});

it("gives each section a distinct picker key when switching within a merged cell", () => {
  const content = { ...blankDocument(), merge: "left" as const };
  function render() {
    hooks.cursor = 0;
    return DocumentFields({ content, disabled: false, drawingEndpoint: "/drawings", location: "clubId=club",
      onSession: vi.fn(), onSection: vi.fn(), onDrawing: vi.fn(), onMerge: vi.fn() });
  }
  function buttons(node: ReactNode): ReactElement<Record<string, unknown>>[] {
    if (!isValidElement<Record<string, unknown>>(node)) return [];
    return [
      ...(node.props.children === "Добави упражнение" ? [node] : []),
      ...([node.props.children].flat(Infinity) as ReactNode[]).flatMap(buttons),
    ];
  }
  (buttons(render())[2].props.onClick as () => void)();
  const first = find(render(), (props) => props.endpoint === "/drawings");
  (buttons(render())[3].props.onClick as () => void)();
  const second = find(render(), (props) => props.endpoint === "/drawings");
  expect(first.key).toBe("2");
  expect(second.key).toBe("3");
});
