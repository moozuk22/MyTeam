import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { blankDocument, type PlanContent } from "@/lib/exercise/document";

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: () => {},
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.values[index], (value: unknown) => {
      hooks.values[index] = typeof value === "function" ? value(hooks.values[index]) : value;
    }];
  },
}));
import PrintChoiceDialog, { type PrintTraining } from "./PrintChoiceDialog";

type Props = Record<string, unknown> & { children?: ReactNode };
const LOADED = 2;
const plan = (title: string): PlanContent => { const content = blankDocument(); content.session.title = title; return content; };
const trainings: PrintTraining[] = [
  { rowId: "r1", number: 1, documentId: "d1" },
  { rowId: "r2", number: 2, documentId: undefined },
  { rowId: "r3", number: 3, documentId: null },
  { rowId: "r4", number: 4, documentId: "d4" },
];

function render() {
  hooks.cursor = 0;
  const onConfirm = vi.fn();
  const tree = PrintChoiceDialog({ pdf: false, endpoint: "/documents", weekLabel: "Група · 16 – 22 ноември", trainings, onConfirm, onClose: vi.fn() });
  return { tree, onConfirm };
}
function all(node: ReactNode, found: ReactElement<Props>[] = []): ReactElement<Props>[] {
  if (Array.isArray(node)) node.forEach((child) => all(child, found));
  else if (isValidElement<Props>(node)) { found.push(node); all(node.props.children, found); }
  return found;
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return isValidElement<Props>(node) ? text(node.props.children) : "";
}
const checkboxes = (tree: ReactNode) => all(tree).filter((element) => element.props.type === "checkbox");
const button = (tree: ReactNode, label: string) => all(tree).find((element) => element.type === "button" && text(element).includes(label))!;

beforeEach(() => {
  hooks.values = [];
  render();
  hooks.values[LOADED] = { d1: { content: plan("Пасове") }, d4: { content: plan("Удари") } };
});

it("lets the user choose only the trainings with an own plan", () => {
  const { tree } = render();
  expect(checkboxes(tree).map((box) => !!box.props.disabled)).toEqual([false, false, true, true, false]);
  expect(text(tree)).toContain("Пасове");
  expect(text(tree)).toContain("Няма план-конспект");
  expect(text(tree)).toContain("Има план-конспект от друг автор");
});

it("selects all pages and gives the plans in the order of the trainings", () => {
  (button(render().tree, "Избери всички").props.onClick as () => void)();
  const { tree, onConfirm } = render();
  expect(checkboxes(tree).map((box) => !!box.props.checked)).toEqual([true, true, false, false, true]);
  expect(text(button(tree, "Печат"))).toContain("(3)");
  (button(tree, "Печат").props.onClick as () => void)();
  const choice = onConfirm.mock.calls[0][0];
  expect(choice.week).toBe(true);
  expect(choice.documents.map((item: { rowId: string; number: number; content: PlanContent }) => [item.rowId, item.number, item.content.session.title]))
    .toEqual([["r1", 1, "Пасове"], ["r4", 4, "Удари"]]);
  expect(text(button(render().tree, "Премахни избора"))).toBe("Премахни избора");
});

it("prints one plan without the week", () => {
  const first = checkboxes(render().tree);
  (first[0].props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } });
  (checkboxes(render().tree)[4].props.onChange as () => void)();
  const { tree, onConfirm } = render();
  (button(tree, "Печат").props.onClick as () => void)();
  expect(onConfirm).toHaveBeenCalledWith({ week: false, documents: [expect.objectContaining({ rowId: "r4", number: 4 })] });
});

it("does not print when nothing is selected", () => {
  (checkboxes(render().tree)[0].props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } });
  const { tree, onConfirm } = render();
  expect(button(tree, "Печат").props.disabled).toBe(true);
  (button(tree, "Печат").props.onClick as () => void)();
  expect(onConfirm).not.toHaveBeenCalled();
});

it("keeps the selected plans when the user retries a plan that failed", () => {
  (checkboxes(render().tree)[0].props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } });
  (checkboxes(render().tree)[4].props.onChange as () => void)();
  hooks.values[LOADED] = { d1: { error: "Грешка" }, d4: { content: plan("Удари") } };
  (button(render().tree, "Опитай отново").props.onClick as () => void)();
  expect(hooks.values[LOADED]).toEqual({ d4: { content: plan("Удари") } });
  const { tree, onConfirm } = render();
  expect(text(button(tree, "Печат"))).toContain("(1)");
  (button(tree, "Печат").props.onClick as () => void)();
  expect(onConfirm).toHaveBeenCalledWith({ week: false, documents: [expect.objectContaining({ rowId: "r4" })] });
});

it("keeps a plan that still loads in the selection of all pages", () => {
  hooks.values[LOADED] = { d1: { content: plan("Пасове") } };
  (button(render().tree, "Избери всички").props.onClick as () => void)();
  let { tree, onConfirm } = render();
  // The print waits for the plan of training 4.
  expect(button(tree, "Печат").props.disabled).toBe(true);
  (button(tree, "Печат").props.onClick as () => void)();
  expect(onConfirm).not.toHaveBeenCalled();
  expect(checkboxes(tree)[4].props.checked).toBe(true);
  hooks.values[LOADED] = { d1: { content: plan("Пасове") }, d4: { content: plan("Удари") } };
  ({ tree, onConfirm } = render());
  expect(text(button(tree, "Печат"))).toContain("(3)");
  (button(tree, "Печат").props.onClick as () => void)();
  expect(onConfirm).toHaveBeenCalledWith({ week: true, documents: [expect.objectContaining({ rowId: "r1" }), expect.objectContaining({ rowId: "r4" })] });
});
