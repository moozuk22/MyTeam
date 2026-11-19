import { describe, expect, it } from "vitest";
import { emptyCycle, formatWeekDates, formatWeekRange, monday, parseCycle, shiftWeek } from "./microcycle";
describe("microcycle", () => {
  it("uses Monday across year boundaries", () => { expect(monday("2027-01-03")).toBe("2026-12-28"); expect(shiftWeek("2026-12-28", 7)).toBe("2027-01-04"); });
  it("rejects impossible dates", () => { expect(() => monday("2026-02-30")).toThrow(); });
  it("validates all training cells and row limits", () => { expect(parseCycle(emptyCycle()).rows).toEqual([]); expect(() => parseCycle({ ...emptyCycle(), rows: [["x"]] })).toThrow(); expect(() => parseCycle({ ...emptyCycle(), rows: Array.from({ length: 31 }, () => ["", "", "", "", ""]) })).toThrow(); });
  it("formats week ranges in Bulgarian", () => {
    expect(formatWeekRange("2026-11-16")).toBe("16 – 22 ноември 2026 г.");
    expect(formatWeekRange("2026-11-30")).toBe("30 ноември – 6 декември 2026 г.");
    expect(formatWeekRange("2026-12-28")).toBe("28 декември 2026 г. – 3 януари 2027 г.");
  });
  it("formats the printed week dates", () => {
    expect(formatWeekDates("2026-11-09")).toBe("09.11.2026 г. – 15.11.2026 г.");
    expect(formatWeekDates("2026-12-28")).toBe("28.12.2026 г. – 03.01.2027 г.");
  });
});
