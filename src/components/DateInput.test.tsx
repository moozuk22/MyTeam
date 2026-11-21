import { afterEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const hooks = vi.hoisted(() => ({ mockRefs: false, typing: false, setTyping: (() => {}) as (value: boolean) => void }));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {
    ...react,
    useRef: (initial: unknown) => hooks.mockRefs ? { current: initial } : react.useRef(initial),
    useState: (initial: unknown) => hooks.mockRefs ? [hooks.typing, hooks.setTyping] : react.useState(initial),
    useLayoutEffect: (...args: Parameters<typeof react.useLayoutEffect>) => hooks.mockRefs ? undefined : react.useLayoutEffect(...args),
  };
});
import { DateInput, formatDateInputValue } from "./DateInput";

afterEach(() => { hooks.mockRefs = false; hooks.typing = false; hooks.setTyping = () => {}; });

function find(node: ReactNode, predicate: (props: Record<string, unknown>) => boolean): ReactElement<Record<string, unknown>> {
  if (isValidElement<Record<string, unknown>>(node)) {
    if (predicate(node.props)) return node;
    for (const child of [node.props.children].flat(Infinity) as ReactNode[]) {
      try { return find(child, predicate); } catch { /* Inspect the next child. */ }
    }
  }
  throw new Error("Control not found");
}

it("formats only complete ISO dates as dd.mm.yyyy", () => {
  expect(formatDateInputValue("2026-11-05")).toBe("05.11.2026");
  expect(formatDateInputValue("")).toBe("");
  expect(formatDateInputValue("2026-11")).toBe("");
});

it("shows dd.mm.yyyy over a native date input that keeps its value and attributes", () => {
  const html = renderToStaticMarkup(<DateInput id="birth" className="amp-edit-input" value="2026-11-05" min="2000-01-01" max="2026-12-31"
    required disabled onValueChange={() => {}} />);
  expect(html).toMatch(/<input[^>]*type="date"/);
  expect(html).toContain('id="birth"');
  expect(html).toContain('value="2026-11-05"');
  expect(html).toContain('min="2000-01-01"');
  expect(html).toContain('max="2026-12-31"');
  expect(html).toContain('required=""');
  expect(html).toContain('disabled=""');
  expect(html).toContain("amp-edit-input");
  expect(html).toMatch(/aria-hidden="true"><span>05\.11\.2026<\/span>/);
  expect(html).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
});

it("shows a Bulgarian placeholder for an empty date", () => {
  const html = renderToStaticMarkup(<DateInput value="" onValueChange={() => {}} />);
  expect(html).toMatch(/aria-hidden="true"><span class="[^"]+">дд\.мм\.гггг<\/span>/);
});

it("applies wrapper layout props to the wrapper", () => {
  const html = renderToStaticMarkup(<DateInput value="" wrapperClassName="grow" wrapperStyle={{ flex: "1 1 60px" }} onValueChange={() => {}} />);
  expect(html).toMatch(/^<span class="[^"]* grow" style="flex:1 1 60px">/);
});

it("reports changes and opens the calendar instead of typing into hidden segments", () => {
  hooks.mockRefs = true;
  const onValueChange = vi.fn();
  const onKeyDown = vi.fn();
  const tree = DateInput({ value: "", onValueChange, onKeyDown });
  const input = find(tree, (props) => props.type === "date");
  (input.props.onChange as (event: unknown) => void)({ target: { value: "2026-11-05" } });
  expect(onValueChange).toHaveBeenCalledWith("2026-11-05");

  const showPicker = vi.fn();
  const target = { disabled: false, readOnly: false, showPicker };
  const press = (key: string) => {
    const event = { key, currentTarget: target, preventDefault: vi.fn() };
    (input.props.onKeyDown as (event: unknown) => void)(event);
    return event;
  };
  expect(press("5").preventDefault).toHaveBeenCalled();
  expect(press(" ").preventDefault).toHaveBeenCalled();
  expect(showPicker).toHaveBeenCalledTimes(2);
  expect(press("Tab").preventDefault).not.toHaveBeenCalled();
  expect(showPicker).toHaveBeenCalledTimes(2);
  expect(onKeyDown).toHaveBeenCalledTimes(3);

  target.disabled = true;
  (input.props.onClick as (event: unknown) => void)({ currentTarget: target });
  expect(showPicker).toHaveBeenCalledTimes(2);
});

it("lets digits through and shows the native text when the calendar cannot open", () => {
  hooks.mockRefs = true;
  const setTyping = vi.fn();
  hooks.setTyping = setTyping;
  const input = find(DateInput({ value: "", onValueChange: () => {} }), (props) => props.type === "date");
  const press = (target: Record<string, unknown>) => {
    const event = { key: "5", currentTarget: { disabled: false, readOnly: false, ...target }, preventDefault: vi.fn() };
    (input.props.onKeyDown as (event: unknown) => void)(event);
    return event;
  };

  expect(press({ showPicker: undefined }).preventDefault).not.toHaveBeenCalled();
  expect(press({ showPicker: () => { throw new Error("NotAllowedError"); } }).preventDefault).not.toHaveBeenCalled();
  expect(setTyping).toHaveBeenCalledTimes(2);
  expect(setTyping).toHaveBeenCalledWith(true);

  press({ showPicker: undefined, readOnly: true });
  expect(setTyping).toHaveBeenCalledTimes(2);

  (input.props.onBlur as (event: unknown) => void)({});
  expect(setTyping).toHaveBeenLastCalledWith(false);
});

it("shows the native text and hides the overlay in typing mode", () => {
  hooks.mockRefs = true;
  hooks.typing = true;
  const html = renderToStaticMarkup(DateInput({ value: "2026-11-05", className: "field", onValueChange: () => {} }));
  expect(html).toMatch(/<input[^>]*class="field "/);
  expect(html).toMatch(/aria-hidden="true" hidden="">/);
});

it("shows the native segments before arrow, delete or backspace keys edit the date", () => {
  hooks.mockRefs = true;
  const setTyping = vi.fn();
  hooks.setTyping = setTyping;
  const showPicker = vi.fn();
  const target = { disabled: false, readOnly: false, showPicker };
  const press = (key: string) => {
    const input = find(DateInput({ value: "2026-11-05", onValueChange: () => {} }), (props) => props.type === "date");
    const event = { key, currentTarget: target, preventDefault: vi.fn() };
    (input.props.onKeyDown as (event: unknown) => void)(event);
    return event;
  };

  for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Backspace", "Delete"]) {
    expect(press(key).preventDefault).toHaveBeenCalled();
  }
  expect(setTyping).toHaveBeenCalledTimes(6);
  expect(setTyping).toHaveBeenCalledWith(true);
  expect(press("Tab").preventDefault).not.toHaveBeenCalled();
  expect(showPicker).not.toHaveBeenCalled();

  // In typing mode the native field handles every key, including digits.
  hooks.typing = true;
  expect(press("ArrowUp").preventDefault).not.toHaveBeenCalled();
  expect(press("5").preventDefault).not.toHaveBeenCalled();
  expect(showPicker).not.toHaveBeenCalled();
  expect(setTyping).toHaveBeenCalledTimes(6);

  hooks.typing = false;
  target.readOnly = true;
  expect(press("ArrowUp").preventDefault).not.toHaveBeenCalled();
  expect(setTyping).toHaveBeenCalledTimes(6);
});
