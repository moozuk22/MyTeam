import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  club: vi.fn(),
  sessions: vi.fn(),
  note: vi.fn(),
}));

vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.auth }));
vi.mock("@/lib/db", () => ({
  prisma: {
    club: { findUnique: mocks.club },
    trainingSession: { findMany: mocks.sessions, findFirst: vi.fn() },
    trainingNote: { findFirst: mocks.note },
    player: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

function request(view: string, date = "2026-11-09") {
  return GET(new NextRequest(
    `http://localhost/training-attendance?date=${date}&month=2026-11${view}`,
    { headers: { cookie: "admin_session=test" } },
  ), { params: Promise.resolve({ id: "club-1" }) });
}

describe("Schedule 2 attendance details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ roles: ["admin"] });
    mocks.club.mockResolvedValue({
      id: "club-1", trainingDates: ["2026-11-09"], trainingTime: "18:00",
    });
    mocks.sessions.mockImplementation(async ({ where, select }) =>
      select.rosterLockedAt || where.trainingDate instanceof Date
        ? []
        : [{ trainingDate: new Date("2026-11-11"), trainingTime: "17:00" }],
    );
    mocks.note.mockResolvedValue(null);
  });

  it("uses the clicked Monday even when a different day has a stored session", async () => {
    const response = await request("&view=schedule2");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ trainingDate: "2026-11-09", trainingTime: "18:00" });
    expect(mocks.sessions).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ trainingDate: new Date("2026-11-09") }),
    }));
    expect(mocks.note).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ trainingDate: new Date("2026-11-09") }),
    }));
    expect(await (await request("")).json()).toMatchObject({ trainingDate: "2026-11-11" });
  });

  it("does not substitute a different session for a missing date", async () => {
    expect(await (await request("&view=schedule2", "2026-11-10")).json()).toMatchObject({ trainingDate: "" });
  });

  it("rejects coaches before reading planner details", async () => {
    mocks.auth.mockResolvedValue({ roles: ["coach"] });
    expect((await request("&view=schedule2")).status).toBe(403);
    expect(mocks.club).not.toHaveBeenCalled();
  });
});
