import { afterEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, refs: [] as Array<{ current: unknown }>, refCursor: 0 }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useEffect: () => {},
  useRef: (initial: unknown) => {
    const index = hooks.refCursor++;
    return hooks.refs[index] ??= { current: initial };
  },
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => { hooks.values[index] = value; }];
  },
}));
import { ClockPicker } from "./TimeInput";

afterEach(() => { hooks.values = []; hooks.cursor = 0; hooks.refs = []; hooks.refCursor = 0; });
function find(node: ReactNode, predicate: (props: Record<string, unknown>) => boolean): ReactElement<Record<string, unknown>> {
  if (isValidElement<Record<string, unknown>>(node)) {
    if (predicate(node.props)) return node;
    const children = [node.props.children].flat(Infinity) as ReactNode[];
    for (const child of children) {
      try { return find(child, predicate); } catch { /* Search the next child. */ }
    }
  }
  throw new Error("Control not found");
}
function setup() {
  const onSet = vi.fn(); const onClear = vi.fn(); const onClose = vi.fn();
  const render = () => { hooks.cursor = 0; hooks.refCursor = 0; return ClockPicker({ value: "10:15", onSet, onClear, onClose }); };
  const click = (label: string) => {
    const element = find(render(), props => props["aria-label"] === label || props.children === label);
    (element.props.onClick as (event: unknown) => void)({ detail: 0 });
  };
  return { render, click, onSet, onClear, onClose };
}

it("stages a 24-hour time, advances to minutes, and applies only on Set", () => {
  const picker = setup();
  picker.click("Час 22");
  expect(picker.onSet).not.toHaveBeenCalled();
  picker.click("Минути 35");
  picker.click("Задай");
  expect(picker.onSet).toHaveBeenCalledWith("22:35");
});

it("cancels without applying a draft and clears only on explicit action", () => {
  const picker = setup();
  picker.click("Час 00");
  picker.click("Отказ");
  expect(picker.onClose).toHaveBeenCalledOnce();
  expect(picker.onSet).not.toHaveBeenCalled();
  picker.click("Изчисти");
  expect(picker.onClear).toHaveBeenCalledOnce();
});

it("allows exact minutes with arrow keys and wraps at midnight", () => {
  const picker = setup();
  picker.click("Час 23");
  picker.click("Минути 55");
  for (let i = 0; i < 6; i++) {
    const face = find(picker.render(), props => props["aria-label"] === "Минути 00–59");
    (face.props.onKeyDown as (event: unknown) => void)({ key: "ArrowRight", preventDefault: vi.fn() });
  }
  picker.click("Задай");
  expect(picker.onSet).toHaveBeenCalledWith("23:01");
});

it("drags through both hour rings and advances to minutes only on release", () => {
  const picker = setup();
  const surface = { focus: vi.fn(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 256, height: 256 }), setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() };
  const pointer = (handler: string, x: number, y: number, label = "Часове 00–23") => {
    const face = find(picker.render(), props => props["aria-label"] === label);
    expect(face.props[handler]).toBeTypeOf("function");
    (face.props[handler] as (event: unknown) => void)({ currentTarget: surface, pointerId: 1, button: 0, isPrimary: true, clientX: x, clientY: y, preventDefault: vi.fn(), target: { closest: () => null } });
  };
  pointer("onPointerDown", 228, 128);
  pointer("onPointerMove", 193, 128);
  expect(find(picker.render(), props => props["aria-label"] === "Час 15").props["aria-pressed"]).toBe(true);
  pointer("onPointerUp", 128, 63);
  pointer("onPointerDown", 228, 128, "Минути 00–59");
  pointer("onPointerMove", 128, 228, "Минути 00–59");
  pointer("onPointerUp", 128, 228, "Минути 00–59");
  picker.click("Задай");
  expect(picker.onSet).toHaveBeenCalledWith("00:30");
  expect(surface.setPointerCapture).toHaveBeenCalledWith(1);
  expect(surface.releasePointerCapture).toHaveBeenCalledWith(1);
});
