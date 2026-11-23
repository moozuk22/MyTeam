import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ card: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {
  card: { findFirst: mocks.card },
  playerNotification: { updateMany: mocks.update },
} }));
import { POST } from "./route";

const request = () => POST(new NextRequest("http://localhost/api/members/CARD/notifications/read", { method: "POST" }), {
  params: Promise.resolve({ cardCode: " card " }),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.card.mockResolvedValue({ playerId: "player-a" });
  mocks.update.mockResolvedValue({ count: 2 });
});

it("marks all unread history, including notifications older than a week, for only this member", async () => {
  const response = await request();
  expect(await response.json()).toEqual({ success: true, markedRead: 2 });
  expect(mocks.card).toHaveBeenCalledWith({ where: { cardCode: "CARD", isActive: true }, select: { playerId: true } });
  expect(mocks.update).toHaveBeenCalledWith({
    where: { playerId: "player-a", readAt: null },
    data: { readAt: expect.any(Date) },
  });
});

it.each(["P2024", "P2021"])("does not report a failed database write (%s) as a successful read", async (code) => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    mocks.update.mockRejectedValue({ code });
    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.json()).toHaveProperty("error");
  } finally { log.mockRestore(); }
});

it("rejects inactive or unknown cards without changing notifications", async () => {
  mocks.card.mockResolvedValue(null);
  expect((await request()).status).toBe(404);
  expect(mocks.update).not.toHaveBeenCalled();
});

it("allows repeated reads without modifying already-read notifications", async () => {
  await request();
  mocks.update.mockResolvedValue({ count: 0 });
  expect(await (await request()).json()).toEqual({ success: true, markedRead: 0 });
  expect(mocks.update.mock.calls.every(([args]) => args.where.readAt === null)).toBe(true);
});
