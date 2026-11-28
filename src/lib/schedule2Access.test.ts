import { describe, expect, it } from "vitest";
import { canUseSchedule2 } from "./schedule2Access";

const clubId = "b5d54111-4d5a-4d88-9ffa-8724a0328d47";

describe("Schedule 2 access", () => {
  it("allows admins and coaches in every club", () => {
    expect(canUseSchedule2({ roles: ["admin"] }, clubId)).toBe(true);
    expect(canUseSchedule2({ roles: ["coach"] }, clubId)).toBe(true);
    expect(canUseSchedule2({ roles: ["coach"] }, "4fed63dd-fbe2-42e8-a8bc-c7036496a3e5")).toBe(true);
  });

  it("refuses requests without a session or club", () => {
    expect(canUseSchedule2(null, clubId)).toBe(false);
    expect(canUseSchedule2({ roles: ["coach"] }, "")).toBe(false);
  });
});
