import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), cards: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { playerNotification: { create: mocks.create }, card: { findMany: mocks.cards } } }));
vi.mock("@/lib/memberEvents", () => ({ publishMemberUpdated: vi.fn() }));
vi.mock("@/lib/push/trainingPause", () => ({ isTrainingNotificationPaused: vi.fn().mockResolvedValue(false) }));
import { saveMemberNotificationHistory } from "./history";
beforeEach(() => { vi.clearAllMocks(); mocks.cards.mockResolvedValue([]); });
it("persists the uploaded attachment with the player's message", async () => {
  await saveMemberNotificationHistory("player", "trainer_message", { title: "Coach", body: "Hello", image: "https://example.com/photo.webp", imagePublicId: "messages/photo" });
  expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ playerId: "player", imageUrl: "https://example.com/photo.webp", imagePublicId: "messages/photo" }) });
});
it("keeps text-only notifications compatible", async () => {
  await saveMemberNotificationHistory("player", "myteam_message", { title: "Admin", body: "Hello" });
  expect(mocks.create.mock.calls[0][0].data).not.toHaveProperty("imageUrl");
});
