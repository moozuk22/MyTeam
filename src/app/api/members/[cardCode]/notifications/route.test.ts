import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ card: vi.fn(), notifications: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { card: { findFirst: mocks.card }, playerNotification: { findMany: mocks.notifications, count: mocks.count } } }));
import { GET } from "./route";
it("returns image attachments in player notification history", async () => {
  mocks.card.mockResolvedValue({ playerId: "player" });
  const notification = { id: "notification", body: "Photo", imageUrl: "https://example.com/photo.webp" };
  mocks.notifications.mockResolvedValue([notification]);
  mocks.count.mockResolvedValue(1);
  const response = await GET(new NextRequest("http://localhost/api/members/CARD/notifications"), { params: Promise.resolve({ cardCode: "CARD" }) });
  expect(await response.json()).toEqual({ notifications: [notification], unreadCount: 1 });
  expect(mocks.notifications).toHaveBeenCalledWith(expect.objectContaining({ where: { playerId: "player" }, select: expect.objectContaining({ imageUrl: true }) }));
});
