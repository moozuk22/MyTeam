import { afterEach, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ open: false, refs: [] as Array<{ current: unknown }>, cursor: 0, effects: [] as Array<() => void> }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useSyncExternalStore: () => true,
  useId: () => "clock-dialog",
  useState: () => [hooks.open, (value: boolean) => { hooks.open = value; }],
  useRef: (initial: unknown) => {
    const index = hooks.cursor++;
    return hooks.refs[index] ??= { current: initial };
  },
  useEffect: (effect: () => void) => { hooks.effects.push(effect); },
}));
vi.mock("react-dom", () => ({ createPortal: (element: unknown) => element }));
import { TimeInput } from "./TimeInput";

afterEach(() => { hooks.open = false; hooks.refs = []; hooks.cursor = 0; hooks.effects = []; vi.unstubAllGlobals(); });
it("restores focus after dialog teardown, rather than during the close callback", () => {
  vi.stubGlobal("document", { body: {} });
  const focus = vi.fn();
  const render = () => {
    hooks.cursor = 0;
    hooks.effects = [];
    return TimeInput({ value: "22:37", onValueChange: vi.fn() });
  };
  const flushEffects = () => { hooks.effects.forEach(effect => effect()); };
  const initial = render();
  initial.props.children[0].props.ref.current = { focus };
  flushEffects();
  initial.props.children[0].props.onClick();
  const opened = render();
  flushEffects();
  opened.props.children[1].props.onClose();
  expect(focus).not.toHaveBeenCalled();
  render();
  // Passive effects run after the dialog child has been removed and closed.
  flushEffects();
  expect(focus).toHaveBeenCalledOnce();
});
