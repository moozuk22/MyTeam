import { describe, expect, it } from "vitest";
import { blankDocument, summarizeDocument } from "./document";

describe("summarizeDocument", () => {
  it("returns null for content that is not a document", () => {
    expect(summarizeDocument(null)).toBeNull();
    expect(summarizeDocument({ sections: [] })).toBeNull();
  });

  it("keeps only short session fields", () => {
    const content = blankDocument();
    content.session.date = "2026-11-19";
    content.session.objective = "а".repeat(400);
    const preview = summarizeDocument(content)!;
    expect(preview.date).toBe("2026-11-19");
    expect(preview.objective).toHaveLength(160);
    expect(preview.drawings).toBe(0);
  });

  it("counts drawings and adds section minutes when the session has no duration", () => {
    const content = blankDocument();
    content.sections[0].duration = "15";
    content.sections[2].duration = "20,5";
    content.sections[3].duration = "около 10";
    const sections = content.sections.map((section, index) => index === 1 ? { ...section, drawing: { layout: {} } } : section);
    expect(summarizeDocument({ ...content, sections })).toMatchObject({ duration: "36", drawings: 1 });
    content.session.duration = "90";
    expect(summarizeDocument(content)?.duration).toBe("90");
  });
});
