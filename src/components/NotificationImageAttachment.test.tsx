import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { NotificationImageAttachment } from "./NotificationImageAttachment";
import PlayerNotificationForm from "@/app/admin/players/PlayerNotificationForm";
import { validateMessageImage } from "@/lib/messageImage";

it("renders an optional image control in the admin player notification form", () => {
  const html = renderToStaticMarkup(<PlayerNotificationForm clubs={[]} loading={false} />);
  expect(html).toContain('type="file"');
  expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
  expect(html).toContain("Снимка към съобщението");
  expect(html).not.toContain('alt="Преглед на избраната снимка"');
});
it("allows removing a selected image and disables uploads while sending", () => {
  const html = renderToStaticMarkup(<NotificationImageAttachment file={new File(["png"], "photo.png", { type: "image/png" })} onChange={() => {}} disabled />);
  expect(html).toContain("Премахни снимката");
  expect(html).toContain('alt="Преглед на избраната снимка"');
  expect(html).toMatch(/<input[^>]*disabled=""/);
  expect(html).toMatch(/<button[^>]*disabled=""/);
});
it("accepts supported files up to 9 MB and rejects empty, oversized, or unsupported files", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    expect(validateMessageImage({ type, size: 9 * 1024 * 1024 })).toBe(true);
    expect(validateMessageImage({ type, size: 9 * 1024 * 1024 + 1 })).toBe(false);
    expect(validateMessageImage({ type, size: 0 })).toBe(false);
  }
  expect(validateMessageImage({ type: "image/svg+xml", size: 100 })).toBe(false);
});
