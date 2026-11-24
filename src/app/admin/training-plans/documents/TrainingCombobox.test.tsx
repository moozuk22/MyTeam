import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useId: () => "combo",
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: () => {},
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => {
      hooks.values[index] = typeof value === "function" ? value(hooks.values[index]) : value;
    }];
  },
}));
import TrainingCombobox, { type ComboOption } from "./TrainingCombobox";

type Props = Record<string, unknown> & { children?: ReactNode };
const options: ComboOption[] = [
  { key: "a", value: "3", label: "Микроцикъл 3", hint: "16 – 22 ноември 2026 г." },
  { key: "b", value: "12", label: "Микроцикъл 12" },
];

function render(props: Partial<Parameters<typeof TrainingCombobox>[0]> = {}) {
  hooks.cursor = 0;
  const handlers = { onChange: vi.fn(), onPick: vi.fn() };
  const tree = TrainingCombobox({ label: "Микроцикъл", max: 40, value: "", options, empty: "Няма", ...handlers, ...props });
  return { tree, ...handlers };
}
function all(node: ReactNode, test: (element: ReactElement<Props>) => boolean): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(child => all(child, test));
  if (!isValidElement<Props>(node)) return [];
  return [...(test(node) ? [node] : []), ...all(node.props.children, test)];
}
const input = (tree: ReactNode) => all(tree, element => element.type === "input")[0];
const items = (tree: ReactNode) => all(tree, element => element.props.role === "option");
const keyDown = (tree: ReactNode, key: string) => (input(tree).props.onKeyDown as (event: object) => void)({ key, preventDefault: vi.fn() });

beforeEach(() => { hooks.values = []; });

describe("TrainingCombobox", () => {
  it("keeps typed text that is not a suggestion and filters the list", () => {
    const { tree, onChange } = render({ value: "1" });
    (input(tree).props.onChange as (event: object) => void)({ target: { value: "1" } });
    expect(onChange).toHaveBeenCalledWith("1");
    const next = render({ value: "1" });
    expect(input(next.tree).props["aria-expanded"]).toBe(true);
    expect(items(next.tree).map(item => item.key)).toEqual(["b"]);
  });

  it("shows every suggestion when the text matches none", () => {
    render({ value: "9" });
    (input(render({ value: "9" }).tree).props.onChange as (event: object) => void)({ target: { value: "9" } });
    expect(items(render({ value: "9" }).tree)).toHaveLength(2);
  });

  it("picks a suggestion with the keyboard", () => {
    keyDown(render().tree, "ArrowDown");
    keyDown(render().tree, "ArrowDown");
    const { tree, onPick } = render();
    expect(input(tree).props["aria-activedescendant"]).toBe("combo-list-0");
    keyDown(tree, "Enter");
    expect(onPick).toHaveBeenCalledWith(options[0]);
    expect(input(render().tree).props["aria-expanded"]).toBe(false);
  });

  it("closes the list with Escape", () => {
    keyDown(render().tree, "ArrowDown");
    keyDown(render().tree, "Escape");
    expect(input(render().tree).props["aria-expanded"]).toBe(false);
  });

  it("links the warning to the field without blocking the value", () => {
    const { tree } = render({ value: "7", warning: "Няма микроцикъл „7“ за групата. Проверете номера." });
    expect(input(tree).props["aria-invalid"]).toBe(true);
    expect(input(tree).props["aria-describedby"]).toBe("combo-warning");
    expect(input(tree).props.value).toBe("7");
    expect(all(tree, element => element.props.id === "combo-warning")).toHaveLength(1);
  });

  it("shows the empty text when there are no suggestions", () => {
    keyDown(render({ options: [] }).tree, "ArrowDown");
    const { tree } = render({ options: [], empty: "Първо въведете микроцикъл." });
    expect(all(tree, element => element.props.className === "td-combo-empty")[0].props.children).toBe("Първо въведете микроцикъл.");
  });
});
