import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  verifyAdminToken: vi.fn(),
  findMany: vi.fn(),
  buildNotificationPayload: vi.fn(),
  sendPushToMember: vi.fn(),
}));
vi.mock("@/lib/uploadMessageImage", () => ({ uploadMessageImage: mocks.upload }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.verifyAdminToken }));
vi.mock("@/lib/db", () => ({
  prisma: { player: { findMany: mocks.findMany } },
  withPrismaPoolRetry: (operation: () => Promise<unknown>) => operation(),
}));
vi.mock("@/lib/push/templates", () => ({ buildNotificationPayload: mocks.buildNotificationPayload }));
vi.mock("@/lib/push/service", () => ({ sendPushToMember: mocks.sendPushToMember }));

const clubId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const coachGroupId = "33333333-3333-4333-8333-333333333333";
function request(groupId?: string, message = "Hello") {
  return new NextRequest("http://localhost/api/admin/members/notify", {
    method: "POST",
    headers: { cookie: "admin_session=test", "Content-Type": "application/json" },
    body: JSON.stringify({ clubId, memberIds: [memberId], message, coachGroupId: groupId }),
  });
}

describe("member message permissions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.upload.mockResolvedValue({ imageUrl: "https://example.com/photo.webp", imagePublicId: "messages/photo" });
    mocks.verifyAdminToken.mockResolvedValue({ roles: ["coach"] });
    mocks.findMany.mockResolvedValue([{ id: memberId, fullName: "Player", cards: [{ cardCode: "ABC" }] }]);
    mocks.buildNotificationPayload.mockReturnValue({ title: "Message", body: "Hello" });
    mocks.sendPushToMember.mockResolvedValue({ sent: 1, failed: 0 });
  });

  it.each(["coach", "admin"])("allows a %s to message selected club members without a coach group", async role => {
    mocks.verifyAdminToken.mockResolvedValue({ roles: [role] });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, targeted: 1, sent: 1, skipped: 0, failed: 0 });
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ id: { in: [memberId] }, clubId, isActive: true });
    expect(mocks.sendPushToMember).toHaveBeenCalledWith(memberId, { title: "Message", body: "Hello" }, "trainer_message");
  });

  it("sends messages longer than 300 characters without truncating them", async () => {
    const message = "Съобщение ".repeat(100);
    const response = await POST(request(undefined, message));
    expect(response.status).toBe(200);
    expect(mocks.buildNotificationPayload).toHaveBeenCalledWith(expect.objectContaining({
      trainerMessage: message.trim(),
    }));
    expect(mocks.sendPushToMember).toHaveBeenCalledOnce();
  });

  it.each(["", "   "])("rejects empty messages %j", async message => {
    expect((await POST(request(undefined, message))).status).toBe(400);
    expect(mocks.sendPushToMember).not.toHaveBeenCalled();
  });

  it("preserves the coach-group filter when provided", async () => {
    expect((await POST(request(coachGroupId))).status).toBe(200);
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({
      id: { in: [memberId] }, clubId, isActive: true, coachGroups: { some: { id: coachGroupId } },
    });
  });

  it("does not send to members excluded by the database scope", async () => {
    mocks.findMany.mockResolvedValue([]);
    const response = await POST(request());
    expect(await response.json()).toEqual({ success: true, targeted: 1, sent: 0, skipped: 1, failed: 0 });
    expect(mocks.sendPushToMember).not.toHaveBeenCalled();
  });

  it.each([[null, 401], [{ roles: ["member"] }, 403]])("rejects unauthorized sessions %j", async (session, status) => {
    mocks.verifyAdminToken.mockResolvedValue(session);
    expect((await POST(request())).status).toBe(status);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.sendPushToMember).not.toHaveBeenCalled();
  });

  it("rejects malformed coach-group IDs", async () => {
    expect((await POST(request("invalid"))).status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  function imageRequest(file: File) {
    const form = new FormData();
    form.append("payload", JSON.stringify({ clubId, memberIds: [memberId], message: "Photo", coachGroupId }));
    form.append("image", file);
    return new NextRequest("http://localhost/api/admin/members/notify", { method: "POST", headers: { cookie: "admin_session=test" }, body: form });
  }
  it("uploads a coach's image once and attaches it to the player notification", async () => {
    const response = await POST(imageRequest(new File(["png"], "photo.png", { type: "image/png" })));
    expect(response.status).toBe(200);
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.sendPushToMember).toHaveBeenCalledWith(memberId, expect.objectContaining({ image: "https://example.com/photo.webp", imagePublicId: "messages/photo" }), "trainer_message");
    expect(mocks.findMany.mock.calls[0][0].where.coachGroups).toEqual({ some: { id: coachGroupId } });
  });
  it.each([
    new File(["svg"], "bad.svg", { type: "image/svg+xml" }),
    new File([], "empty.png", { type: "image/png" }),
    new File([new Uint8Array(9 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
  ])("rejects invalid images before uploading or delivering", async file => {
    expect((await POST(imageRequest(file))).status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.sendPushToMember).not.toHaveBeenCalled();
  });
  it("does not deliver a text-only message when the image upload fails", async () => {
    mocks.upload.mockRejectedValue(new Error("Invalid image"));
    expect((await POST(imageRequest(new File(["png"], "photo.png", { type: "image/png" })))).status).toBe(400);
    expect(mocks.sendPushToMember).not.toHaveBeenCalled();
  });
  it("does not upload when no players match the requested scope", async () => {
    mocks.findMany.mockResolvedValue([]);
    expect((await POST(imageRequest(new File(["png"], "photo.png", { type: "image/png" })))).status).toBe(200);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

});
