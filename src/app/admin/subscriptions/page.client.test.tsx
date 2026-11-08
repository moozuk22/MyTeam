import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => [Array.isArray(initial) ? [{
    id: "contract-club", name: "Contract club", billingStatus: "active",
    subscription: { mode: "contract", version: 1 }, summary: { status: "contract" },
  }] : initial === true ? false : initial, vi.fn()],
}));
vi.mock("./CalculatorSubscription", () => ({ default: () => null, SharedCalculatorPrices: () => null }));
import SubscriptionsPageClient from "./page.client";

it("offers subscription editing and history for a contract club", () => {
  const html = renderToStaticMarkup(<SubscriptionsPageClient />);
  expect(html).toContain("Редактирай абонамента");
  expect(html).toContain("История");
  expect(html).not.toContain("Маркирай като платено");
});
