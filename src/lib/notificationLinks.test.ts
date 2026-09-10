import { describe, expect, it } from "vitest";
import { notificationLinks } from "./notificationLinks";

describe("notificationLinks", () => {
  it("recognizes multiple links and preserves the original message", () => {
    const text = "Тренировка: https://example.com/a?x=1&y=2\nВиж www.example.com. http://example.org";
    const parts = notificationLinks(text);
    expect(parts.map((part) => part.text).join("")).toBe(text);
    expect(parts.filter((part) => part.href).map((part) => part.href)).toEqual([
      "https://example.com/a?x=1&y=2", "https://www.example.com", "http://example.org",
    ]);
  });

  it("excludes prose punctuation while retaining balanced URL parentheses", () => {
    const text = "(https://example.com/wiki/Test_(sport)).";
    const parts = notificationLinks(text);
    expect(parts.find((part) => part.href)?.href).toBe("https://example.com/wiki/Test_(sport)");
    expect(parts.map((part) => part.text).join("")).toBe(text);
  });

  it("leaves unsafe schemes, invalid URLs and HTML as plain text", () => {
    const text = '<script>alert(1)</script> javascript:alert(1) data:text/html,test https://';
    expect(notificationLinks(text)).toEqual([{ text }]);
  });
});
