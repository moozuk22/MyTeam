import { describe, expect, it } from "vitest";
import { isMatchEventType, matchEventTypeLabel } from "@/lib/matchEventType";

describe("event types", () => {
  it("accepts exactly the supported values", () => {
    for (const type of ["match", "duel", "competition", "participation", "tournament"]) expect(isMatchEventType(type)).toBe(true);
    for (const type of ["other", "constructor", "toString", null, 1]) expect(isMatchEventType(type)).toBe(false);
  });
  it("translates types and defaults existing events to match", () => {
    expect(["match", "duel", "competition", "participation", "tournament"].map(matchEventTypeLabel)).toEqual(["Мач", "Двубой", "Състезание", "Участие", "Турнир"]);
    expect(matchEventTypeLabel()).toBe("Мач");
  });
});
