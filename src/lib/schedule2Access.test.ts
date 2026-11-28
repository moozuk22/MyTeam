import { describe, expect, it } from "vitest";
import { canUseSchedule2 } from "./schedule2Access";

const allowedClub = "4fed63dd-fbe2-42e8-a8bc-c7036496a3e5";
const otherClub = "b5d54111-4d5a-4d88-9ffa-8724a0328d47";

describe("Schedule 2 access", () => {
  it("allows admins in every club", () => {
    expect(canUseSchedule2({ roles: ["admin"] }, otherClub)).toBe(true);
  });

  it("allows coaches only in the listed club", () => {
    expect(canUseSchedule2({ roles: ["coach"] }, allowedClub)).toBe(true);
    expect(canUseSchedule2({ roles: ["coach"] }, allowedClub.toUpperCase())).toBe(true);
    expect(canUseSchedule2({ roles: ["coach"] }, otherClub)).toBe(false);
    expect(canUseSchedule2({ roles: ["coach"] }, "")).toBe(false);
  });

  it("refuses requests without a session", () => {
    expect(canUseSchedule2(null, allowedClub)).toBe(false);
  });
});
