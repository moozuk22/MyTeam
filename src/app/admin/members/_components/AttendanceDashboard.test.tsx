import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const hooks = vi.hoisted(() => ({ effects: [] as Array<() => unknown> }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useEffect: (effect: () => unknown) => { hooks.effects.push(effect); },
}));
import { AttendanceDashboard } from "./members-page-components";

afterEach(() => {
  hooks.effects = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("hides the coach selector on a coach page", () => {
  const html = renderToStaticMarkup(<AttendanceDashboard clubId="club" coachGroupId="current-coach" onClose={() => {}} />);
  expect(html).not.toContain('aria-label="Треньор"');
});

it("keeps the coach selector on the club page", () => {
  const html = renderToStaticMarkup(<AttendanceDashboard clubId="club" onClose={() => {}} />);
  expect(html).toContain('aria-label="Треньор"');
});

it("requests the current coach's custom groups and scopes the initial report", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockImplementation(async () => Response.json([]));
  vi.stubGlobal("fetch", fetch);
  renderToStaticMarkup(<AttendanceDashboard clubId="club" coachGroupId="current-coach" onClose={() => {}} />);
  // Run the custom-group and report effects without mounting browser-only effects.
  const cleanupGroups = hooks.effects[3]();
  const cleanupReport = hooks.effects[4]();
  await vi.advanceTimersByTimeAsync(300);
  const urls = fetch.mock.calls.map(([url]) => String(url));
  expect(urls).toContain("/api/admin/clubs/club/custom-training-groups?coachGroupId=current-coach");
  expect(urls.some(url => url.includes("training-attendance/report?") && new URL(url, "http://localhost").searchParams.get("coachGroupId") === "current-coach")).toBe(true);
  if (typeof cleanupGroups === "function") cleanupGroups();
  if (typeof cleanupReport === "function") cleanupReport();
});
