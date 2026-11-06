import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifyCoachTrainingChanges } from "./coachTrainingNotifications";
import type { CoachTraining } from "@/lib/coachTrainingSchedule";

const mocks = vi.hoisted(() => ({ members: vi.fn(), fields: vi.fn(), history: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { player: { findMany: mocks.members }, field: { findMany: mocks.fields } } }));
vi.mock("@/lib/push/history", () => ({ saveMemberNotificationHistory: mocks.history }));
vi.mock("@/lib/push/service", () => ({ sendPushToMember: mocks.push }));

const training: CoachTraining = {
  id: "session", date: "2026-11-12", trainingTime: "19:00", trainingDurationMinutes: 60,
  trainingFieldId: null, trainingFieldPieceIds: [], recurrenceId: null, status: "scheduled", note: "Bring a ball",
};

describe("training session change notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.members.mockResolvedValue([{ id: "player", cards: [{ cardCode: "CARD" }] }]);
    mocks.fields.mockResolvedValue([]);
    mocks.history.mockResolvedValue({});
    mocks.push.mockResolvedValue({});
  });

  it("includes the current description in history and push when editing a session", async () => {
    await notifyCoachTrainingChanges("club", "group", [training], [{ ...training, trainingTime: "19:30", note: "Bring water" }]);
    const payload = mocks.push.mock.calls[0][1];
    expect(payload.body).toContain("19:30");
    expect(payload.body).toContain("Bring water");
    expect(payload.body).not.toContain("Bring a ball");
    expect(mocks.history).toHaveBeenCalledWith("player", "training_reminder", payload);
  });

  it("notifies members when only the description changes", async () => {
    await notifyCoachTrainingChanges("club", "group", [training], [{ ...training, note: "Bring water" }]);
    expect(mocks.push).toHaveBeenCalledOnce();
    expect(mocks.push.mock.calls[0][1].body).toContain("Bring water");
  });

  it("keeps descriptions out of new-session notifications", async () => {
    await notifyCoachTrainingChanges("club", "group", [], [training]);
    expect(mocks.push).toHaveBeenCalledOnce();
    expect(mocks.push.mock.calls[0][1].body).toBe("2026-11-12 \u00b7 19:00 \u00b7 60 \u043c\u0438\u043d.");
  });

  it.each([{ next: [] }, { next: [{ ...training, status: "cancelled" }] }])("keeps descriptions out of cancellation notifications", async ({ next }) => {
    await notifyCoachTrainingChanges("club", "group", [training], next);
    expect(mocks.push).toHaveBeenCalledOnce();
    expect(mocks.push.mock.calls[0][1].body).not.toContain(training.note);
  });

  it("does not send notifications for unchanged sessions", async () => {
    await notifyCoachTrainingChanges("club", "group", [training], [{ ...training }]);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("omits empty descriptions when editing a session", async () => {
    await notifyCoachTrainingChanges("club", "group", [training], [{ ...training, note: "" }]);
    expect(mocks.push).toHaveBeenCalledOnce();
    expect(mocks.push.mock.calls[0][1].body).toBe("2026-11-12 \u00b7 19:00 \u00b7 60 \u043c\u0438\u043d.");
  });
});
