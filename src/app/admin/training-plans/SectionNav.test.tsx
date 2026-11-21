import { expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import SectionNav, { trainingSectionHref } from "./SectionNav";

type Props = { href?: string; "aria-current"?: string; onNavigate?: (event: { preventDefault: () => void }) => void; children?: ReactNode };
const links = (node: ReactNode) => (isValidElement<Props>(node) ? [node.props.children].flat() : [])
  .filter((child): child is ReactElement<Props> => isValidElement<Props>(child));
const location = "clubId=club&coachGroupId=group";

it("links the three main pages and marks the open page", () => {
  const items = links(SectionNav({ location, current: "documents" }));
  expect(items.map((item) => item.props.href)).toEqual([
    `/admin/training-plans/microcycles?${location}`,
    `/admin/training-plans?${location}`,
    `/admin/training-plans/documents?${location}`,
  ]);
  expect(items.map((item) => item.props["aria-current"])).toEqual([undefined, undefined, "page"]);
  expect(trainingSectionHref("drawings", location)).toBe(`/admin/training-plans?${location}`);
});

it("lets the page stop the navigation to another page", () => {
  const onNavigate = vi.fn();
  const items = links(SectionNav({ location, current: "microcycles", onNavigate }));
  expect(items[0].props.onNavigate).toBeUndefined();
  const event = { preventDefault: vi.fn() };
  items[2].props.onNavigate!(event);
  expect(onNavigate).toHaveBeenCalledWith(event, `/admin/training-plans/documents?${location}`);
});
