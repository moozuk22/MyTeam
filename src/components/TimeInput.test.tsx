import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const viewport = vi.hoisted(() => ({ desktop: false }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useSyncExternalStore: () => viewport.desktop,
}));
import { ClockPicker, TimeInput } from "./TimeInput";

afterEach(() => { viewport.desktop = false; });

it("opens a dialog from a locale-independent 24-hour desktop field", () => {
  viewport.desktop = true;
  const html = renderToStaticMarkup(<TimeInput id="time" className="amp-edit-input" value="18:30" onValueChange={() => {}} />);
  expect(html).toContain('type="text"');
  expect(html).toContain('value="18:30"');
  expect(html).toContain('aria-haspopup="dialog"');
  expect(html).toContain('placeholder="Изберете час"');
  expect(html).toContain('id="time"');
  expect(html).toContain("amp-edit-input");
});

it("renders the reference clock's outer and inner hour rings and confirmation actions", () => {
  const html = renderToStaticMarkup(<ClockPicker value="22:15" onSet={() => {}} onClear={() => {}} onClose={() => {}} />);
  expect(html).toContain('aria-label="Избор на час"');
  for (let hour = 0; hour < 24; hour++) {
    expect(html).toContain(`aria-label="Час ${String(hour).padStart(2, "0")}"`);
  }
  expect(html).toMatch(/aria-label="Час 22" aria-pressed="true"/);
  expect(html).toContain("Изчисти");
  expect(html).toContain("Отказ");
  expect(html).toContain("Задай");
  expect(html).not.toMatch(/AM|PM/);
});

it("preserves the native mobile time input and form attributes", () => {
  const html = renderToStaticMarkup(<TimeInput className="amp-inner-time-input" value="09:05" step={60} required disabled onValueChange={() => {}} />);
  expect(html).toContain('type="time"');
  expect(html).toContain('step="60"');
  expect(html).toContain('required=""');
  expect(html).toContain('disabled=""');
});
