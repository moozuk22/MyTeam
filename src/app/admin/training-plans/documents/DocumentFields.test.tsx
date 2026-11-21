import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const viewport = vi.hoisted(() => ({ desktop: false }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useSyncExternalStore: () => viewport.desktop,
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
import DocumentFields from "./DocumentFields";
import { blankDocument } from "@/lib/exercise/document";

afterEach(() => { viewport.desktop = false; });

function render(date = "") {
  const content = blankDocument();
  content.session.time = "18:30";
  content.session.date = date;
  return renderToStaticMarkup(<DocumentFields content={content} disabled={false} drawingEndpoint="/drawings" location="clubId=club"
    onSession={() => {}} onSection={() => {}} onDrawing={() => {}} onMerge={() => {}} />);
}

it("uses the custom 24-hour time picker for the session time on desktop", () => {
  viewport.desktop = true;
  const html = render();
  expect(html).not.toContain('type="time"');
  const field = html.match(/<label for="[^"]+">Час<\/label><input[^>]*>/)?.[0];
  expect(field).toContain('type="text"');
  expect(field).toContain('value="18:30"');
  expect(field).toContain('role="combobox"');
  expect(field).toContain('aria-haspopup="dialog"');
  expect(field).toContain('aria-label="Час (24-часов формат)"');
});

it("keeps the native time input for the session time on mobile", () => {
  const html = render();
  expect(html).toMatch(/<input[^>]*type="time"[^>]*value="18:30"/);
});

it("shows the session date as dd.mm.yyyy and keeps the ISO value for the date picker", () => {
  const field = render("2026-11-05").match(/<label for="[^"]+">Дата<\/label>.*?<\/span><input[^>]*>/)?.[0];
  expect(field).toContain('<span class="td-date-value" aria-hidden="true">05.11.2026</span>');
  expect(field).toMatch(/<input[^>]*type="date"[^>]*value="2026-11-05"/);
});

it("shows a Bulgarian date placeholder when the session date is empty", () => {
  expect(render()).toContain('<span class="td-date-value td-date-empty" aria-hidden="true">дд.мм.гггг</span>');
});
