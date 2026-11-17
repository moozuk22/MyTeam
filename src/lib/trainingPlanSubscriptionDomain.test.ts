import { describe, expect, it } from "vitest";
import { trainingPlanAccess } from "./trainingPlanSubscriptionDomain";
import type { CalculatorGrant } from "./calculatorSubscriptionDomain";

const at = new Date("2026-11-17T12:00:00Z");
const grant: CalculatorGrant = {
  id: "grant", kind: "paid", startsAt: "2026-11-01T00:00:00Z",
  endsAt: "2026-12-01T00:00:00Z", revokedAt: null, paymentId: "payment", amount: "10.00",
};

describe("training plan subscription access", () => {
  it("requires a grant for coaches", () => {
    expect(trainingPlanAccess([], ["coach"], at)).toEqual({ enabled: false, canSave: false, canPrint: false });
  });
  it("allows only the admin role to bypass missing grants", () => {
    expect(trainingPlanAccess([], ["admin"], at)).toEqual({ enabled: false, canSave: true, canPrint: true });
    expect(trainingPlanAccess([], ["administrator"], at).canSave).toBe(false);
  });
  it("allows active paid, free, and lifetime grants", () => {
    for (const kind of ["paid", "free", "lifetime"]) {
      expect(trainingPlanAccess([{ ...grant, kind, endsAt: kind === "lifetime" ? null : grant.endsAt }], ["coach"], at).canSave).toBe(true);
    }
  });
  it("rejects expired, future, and revoked grants", () => {
    for (const patch of [{ endsAt: at.toISOString() }, { startsAt: "2026-12-01T00:00:00Z" }, { revokedAt: at.toISOString() }]) {
      expect(trainingPlanAccess([{ ...grant, ...patch }], ["coach"], at)).toEqual({ enabled: false, canSave: false, canPrint: false });
    }
  });
});
