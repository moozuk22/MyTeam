import { describe, expect, it, vi } from "vitest";

vi.mock("./access", async (original) => ({
  ...await original<typeof import("./access")>(),
  findTrainingPlanCoachGroup: async (_club: string, id: string) => ({ id, name: "Треньор" }),
}));

import { emptyCycle } from "./microcycle";
import { documentOwnerFilter, trainingReference } from "./trainingSessionAccess";

const clubId = "11111111-1111-4111-8111-111111111111";
const coach = "33333333-3333-4333-8333-333333333333";
const groupId = "77777777-7777-4777-8777-777777777777";
const documentId = "22222222-2222-4222-8222-222222222222";
const target = { cycleId: "44444444-4444-4444-8444-444444444444", rowId: "66666666-6666-4666-8666-666666666666", groupKey: `custom:${groupId}`, week: "2026-11-16" };

describe("plans of other authors", () => {
  it("gives a coach only the plans of their coach group", async () => {
    // The shared account of the coaches is not the author of a coach's plans.
    expect(await documentOwnerFilter(clubId, "user", coach)).toBe(`coach-group:${coach}`);
  });

  it("gives the signed-in account as the author without a coach link", async () => {
    expect(await documentOwnerFilter(clubId, "admin", null)).toBe("admin");
  });

  it("gives the plan of the training only when the coach is its author", async () => {
    const cycle = (ownerId: string) => ({
      content: { ...emptyCycle(), number: "15", rows: [{ id: target.rowId, cells: ["", "", "", "", ""] }] },
      documents: [{ document: { id: documentId, ownerId } }],
    });
    const db = (ownerId: string) => ({
      clubCustomTrainingGroup: { findFirst: async () => ({ name: "Група" }) },
      trainingMicrocycle: { findFirst: async () => cycle(ownerId) },
    }) as never;
    expect(await trainingReference(db(`coach-group:${coach}`), clubId, coach, target)).toMatchObject({ documentId, occupied: true });
    expect(await trainingReference(db("coach-group:55555555-5555-4555-8555-555555555555"), clubId, coach, target)).toMatchObject({ documentId: null, occupied: true });
    // All coaches sign in with one account. A plan that was made without a coach link belongs to an admin.
    expect(await trainingReference(db("shared-account"), clubId, coach, target)).toMatchObject({ documentId: null, occupied: true });
  });
});
