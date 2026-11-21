import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { blankDocument } from "./document";

const mocks = vi.hoisted(() => ({
  usages: vi.fn<(id: string) => unknown[] | undefined>(),
  linked: vi.fn<() => boolean | undefined>(),
  session: vi.fn(),
  reference: vi.fn(),
  find: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  createLink: vi.fn(),
  updateLink: vi.fn(),
  club: vi.fn(),
}));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.session }));
vi.mock("@/lib/exercise/trainingUsage", async (original) => ({
  ...await original<typeof import("./trainingUsage")>(),
  documentUsages: async (_db: unknown, _club: string, ids: string[]) => new Map(ids.map(id => [id, mocks.usages?.(id) ?? []])),
  hasTrainingLinks: async () => mocks.linked?.() ?? false,
}));
vi.mock("@/lib/trainingPlanSubscriptions", () => ({ trainingPlanCapabilities: async () => ({ enabled: true, canSave: true, canPrint: true }) }));
vi.mock("@/lib/exercise/trainingSessionAccess", () => ({
  coachAuthor: (id: string) => `coach-group:${id}`,
  documentOwnerFilter: async () => "owner",
  trainingReference: mocks.reference,
}));
vi.mock("@/lib/exercise/imageStorage", async (original) => ({
  ...await original<typeof import("./imageStorage")>(),
  storeDocumentImages: async (_tx: unknown, _club: string, _owner: string, content: unknown) => ({ content, imageIds: [] }),
  syncDocumentImages: async () => {},
  removeUnusedImages: async () => {},
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    trainingPlanDocument: { findFirst: mocks.find },
    coachGroup: { findFirst: async ({ where }: { where: { id: string } }) => ({ id: where.id, name: "Треньор" }) },
    $transaction: (fn: (tx: unknown) => unknown) => fn({
      $executeRaw: vi.fn(),
      club: { findUnique: mocks.club },
      trainingPlan: { findMany: vi.fn().mockResolvedValue([]) },
      trainingPlanDocument: { findFirst: mocks.find, createMany: mocks.createDocument, updateMany: mocks.updateDocument },
      trainingSessionDocument: { create: mocks.createLink, update: mocks.updateLink },
    }),
  },
}));

import { POST } from "@/app/api/admin/clubs/[id]/training-plans/documents/route";
import { GET, PUT } from "@/app/api/admin/clubs/[id]/training-plans/documents/[documentId]/route";

const clubId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";
const coach = "33333333-3333-4333-8333-333333333333";
const copyId = "55555555-5555-4555-8555-555555555555";
const current = "88888888-8888-4888-8888-888888888888";
const stale = "99999999-9999-4999-8999-999999999999";
const target = { cycleId: "44444444-4444-4444-8444-444444444444", rowId: "66666666-6666-4666-8666-666666666666", groupKey: "custom:77777777-7777-4777-8777-777777777777", week: "2026-11-16" };
const link = { clubId, groupKey: target.groupKey, cycleId: target.cycleId, rowId: target.rowId };
const row = { cycleId_groupKey_rowId: { cycleId: target.cycleId, groupKey: target.groupKey, rowId: target.rowId } };
const reference = { cells: ["", "", "", "", ""], group: "Група", microcycle: "1", season: "", halfSeason: "", sessionNumber: "1" };
const content = blankDocument();
const base = "http://localhost";

function request(method: string, body: unknown) {
  return new NextRequest(`${base}/api/admin/clubs/${clubId}/training-plans/documents`, {
    method, body: JSON.stringify(body),
    headers: { cookie: "admin_session=test", origin: base, "content-type": "application/json", "x-coach-group": coach },
  });
}
const put = (body: object) => PUT(request("PUT", { content, revision: 1, target, ...body }), { params: Promise.resolve({ id: clubId, documentId }) });
const fork = (body: object) => POST(request("POST", { id: copyId, content, target, forkFrom: documentId, sourceRevision: 1, ...body }), { params: Promise.resolve({ id: clubId }) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ sub: "owner", roles: ["coach"], defaultClubId: clubId });
  mocks.club.mockResolvedValue({ id: clubId });
  mocks.updateDocument.mockResolvedValue({ count: 1 });
  mocks.createDocument.mockResolvedValue({ count: 1 });
});

describe("saving an unlinked plan for a training", () => {
  describe("over the existing plan", () => {
    beforeEach(() => mocks.find.mockResolvedValue({ id: documentId, content, revision: 1, ownerId: "owner", originKey: null }));

    it("updates the plan and links it to a free training", async () => {
      mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: false });
      expect((await put({ link: true })).status).toBe(200);
      expect(mocks.updateDocument).toHaveBeenCalledOnce();
      expect(mocks.createLink).toHaveBeenCalledWith({ data: { ...link, documentId } });
    });

    it("does not link again when the training already uses this plan", async () => {
      mocks.reference.mockResolvedValue({ ...reference, documentId, occupied: true });
      expect((await put({ link: true })).status).toBe(200);
      expect(mocks.createLink).not.toHaveBeenCalled();
    });

    it("rejects a training that got another plan and keeps the plan unchanged", async () => {
      mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: true });
      const response = await put({ link: true });
      expect(response.status).toBe(409);
      expect((await response.json()).error).toContain("вече има план-конспект");
      expect(mocks.updateDocument).not.toHaveBeenCalled();
      expect(mocks.createLink).not.toHaveBeenCalled();
    });

    it("keeps rejecting an unlinked plan without the link request", async () => {
      mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: false });
      expect((await put({})).status).toBe(409);
      expect(mocks.updateDocument).not.toHaveBeenCalled();
    });

    it("rejects a link request without a training", async () => {
      const response = await PUT(request("PUT", { content, revision: 1, link: true }), { params: Promise.resolve({ id: clubId, documentId }) });
      expect(response.status).toBe(400);
      expect(mocks.updateDocument).not.toHaveBeenCalled();
    });
  });

  describe("as a new plan", () => {
    const source = { id: documentId, content, revision: 1, originKey: null };
    beforeEach(() => mocks.find
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce({ id: copyId, content, revision: 1 }));

    it("creates the copy and links it to a free training", async () => {
      mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: false });
      expect((await fork({ link: true })).status).toBe(201);
      expect(mocks.createLink).toHaveBeenCalledWith({ data: { ...link, documentId: copyId } });
      expect(mocks.updateLink).not.toHaveBeenCalled();
    });

    it("rejects a training that got another plan before the copy is created", async () => {
      mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: true });
      expect((await fork({ link: true })).status).toBe(409);
      expect(mocks.createDocument).not.toHaveBeenCalled();
      expect(mocks.createLink).not.toHaveBeenCalled();
    });

    it("keeps replacing the link when the source is the linked plan", async () => {
      mocks.reference.mockResolvedValue({ ...reference, documentId, occupied: true });
      expect((await fork({})).status).toBe(201);
      expect(mocks.updateLink).toHaveBeenCalledOnce();
      expect(mocks.createLink).not.toHaveBeenCalled();
    });

    it("does not copy a plan of another author", async () => {
      mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: false });
      // The source lookup is limited to the coach's plans, so it finds no plan of another author.
      mocks.find.mockReset().mockResolvedValue(null);
      expect((await fork({ link: true })).status).toBe(409);
      expect(mocks.find).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: documentId, clubId, ownerId: "owner" } }));
      expect(mocks.createDocument).not.toHaveBeenCalled();
      expect(mocks.createLink).not.toHaveBeenCalled();
    });

    it("keeps rejecting a copy of an unlinked plan without the link request", async () => {
      mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: false });
      expect((await fork({})).status).toBe(409);
      expect(mocks.createDocument).not.toHaveBeenCalled();
    });

    it("rejects a link request without a source plan", async () => {
      const response = await POST(request("POST", { id: copyId, content, target, link: true }), { params: Promise.resolve({ id: clubId }) });
      expect(response.status).toBe(400);
    });
  });

  describe("in place of the current plan", () => {
    const occupiedBy = (documentId: string) => mocks.reference.mockResolvedValue({ ...reference, documentId, occupied: true });
    const linkOnly = (body: object) => POST(request("POST", { target, linkDocumentId: documentId, ...body }), { params: Promise.resolve({ id: clubId }) });

    it("replaces the current plan with a chosen plan", async () => {
      occupiedBy(current);
      mocks.find.mockResolvedValue({ id: documentId });
      expect((await linkOnly({ replaceDocumentId: current })).status).toBe(201);
      expect(mocks.updateLink).toHaveBeenCalledWith({ where: row, data: { documentId } });
      expect(mocks.createLink).not.toHaveBeenCalled();
    });

    it("rejects the replacement when the training got another plan", async () => {
      occupiedBy(stale);
      mocks.find.mockResolvedValue({ id: documentId });
      expect((await linkOnly({ replaceDocumentId: current })).status).toBe(409);
      expect(mocks.updateLink).not.toHaveBeenCalled();
    });

    it("rejects the replacement of a plan from another author", async () => {
      mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: true });
      mocks.find.mockResolvedValue({ id: documentId });
      expect((await linkOnly({ replaceDocumentId: current })).status).toBe(409);
      expect(mocks.updateLink).not.toHaveBeenCalled();
    });

    it("replaces the current plan when an edited plan is saved over the existing one", async () => {
      occupiedBy(current);
      mocks.find.mockResolvedValue({ id: documentId, content, revision: 1, ownerId: "owner", originKey: null });
      expect((await put({ link: true, replaceDocumentId: current })).status).toBe(200);
      expect(mocks.updateLink).toHaveBeenCalledWith({ where: row, data: { documentId } });
    });

    it("keeps the current plan when the edited plan conflicts", async () => {
      occupiedBy(stale);
      mocks.find.mockResolvedValue({ id: documentId, content, revision: 1, ownerId: "owner", originKey: null });
      expect((await put({ link: true, replaceDocumentId: current })).status).toBe(409);
      expect(mocks.updateDocument).not.toHaveBeenCalled();
      expect(mocks.updateLink).not.toHaveBeenCalled();
    });

    it("replaces the current plan with a copy of an edited plan", async () => {
      occupiedBy(current);
      mocks.find.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: documentId, content, revision: 1, originKey: null })
        .mockResolvedValueOnce({ id: copyId, content, revision: 1 });
      expect((await fork({ link: true, replaceDocumentId: current })).status).toBe(201);
      expect(mocks.updateLink).toHaveBeenCalledWith({ where: row, data: { documentId: copyId } });
    });

    it("replaces the current plan with a new plan", async () => {
      occupiedBy(current);
      mocks.find.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: copyId, content, revision: 1 });
      const response = await POST(request("POST", { id: copyId, content, target, automaticNumber: true, replaceDocumentId: current }), { params: Promise.resolve({ id: clubId }) });
      expect(response.status).toBe(201);
      expect(mocks.updateLink).toHaveBeenCalledWith({ where: row, data: { documentId: copyId } });
    });

    it.each([{ replaceDocumentId: "bad" }, { replaceDocumentId: current, link: undefined }])("rejects an invalid replacement %o", async (body) => {
      mocks.find.mockResolvedValue({ id: documentId, content, revision: 1, ownerId: "owner", originKey: null });
      expect((await put({ link: true, ...body })).status).toBe(400);
      expect(mocks.updateDocument).not.toHaveBeenCalled();
    });
  });
});

describe("one plan for more than one training", () => {
  const numbered = { ...content, session: { ...content.session, microcycle: "3", sessionNumber: "2" } };
  const linkOnly = (body: object) => POST(request("POST", { target, linkDocumentId: documentId, ...body }), { params: Promise.resolve({ id: clubId }) });

  it("adds a training to the plan without a copy or a content change", async () => {
    mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: false });
    mocks.find.mockResolvedValue({ id: documentId });
    mocks.usages.mockReturnValue([{ microcycle: "3", sessionNumber: "2" }]);
    const response = await linkOnly({});
    expect(response.status).toBe(201);
    expect((await response.json()).usages).toEqual([{ microcycle: "3", sessionNumber: "2" }]);
    expect(mocks.createLink).toHaveBeenCalledWith({ data: { ...link, documentId } });
    expect(mocks.createDocument).not.toHaveBeenCalled();
    expect(mocks.updateDocument).not.toHaveBeenCalled();
  });

  it("gives the plan that the coach can replace when the training has another plan", async () => {
    mocks.reference.mockResolvedValue({ ...reference, documentId: current, occupied: true });
    mocks.find.mockResolvedValue({ id: documentId });
    const response = await linkOnly({});
    expect(response.status).toBe(409);
    expect((await response.json()).replaceDocumentId).toBe(current);
    expect(mocks.createLink).not.toHaveBeenCalled();
  });

  it("does not offer to replace a plan that the coach cannot see", async () => {
    mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: true });
    mocks.find.mockResolvedValue({ id: documentId, content, revision: 1, ownerId: "owner", originKey: null });
    const response = await put({ link: true });
    expect(response.status).toBe(409);
    expect((await response.json()).replaceDocumentId).toBeUndefined();
  });

  it("gives the plan to replace when an edited plan is saved for an occupied training", async () => {
    mocks.reference.mockResolvedValue({ ...reference, documentId: current, occupied: true });
    mocks.find.mockResolvedValue({ id: documentId, content, revision: 1, ownerId: "owner", originKey: null });
    const response = await put({ link: true });
    expect(response.status).toBe(409);
    expect((await response.json()).replaceDocumentId).toBe(current);
    expect(mocks.updateDocument).not.toHaveBeenCalled();
  });

  it("does not store the training numbers in a linked plan", async () => {
    mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: false });
    mocks.find.mockResolvedValue({ id: documentId, content, revision: 1, ownerId: "owner", originKey: null });
    expect((await put({ content: numbered, link: true })).status).toBe(200);
    const saved = mocks.updateDocument.mock.calls[0][0].data.content.session;
    expect([saved.microcycle, saved.sessionNumber]).toEqual(["", ""]);
  });

  it("does not store the training numbers in a new plan for a training", async () => {
    mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: false });
    mocks.find.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: copyId, content, revision: 1 });
    expect((await POST(request("POST", { id: copyId, content: numbered, target }), { params: Promise.resolve({ id: clubId }) })).status).toBe(201);
    const saved = mocks.createDocument.mock.calls[0][0].data.content.session;
    expect([saved.microcycle, saved.sessionNumber]).toEqual(["", ""]);
  });

  it("does not store the training numbers when a linked plan is saved in the library", async () => {
    mocks.linked.mockReturnValue(true);
    mocks.find.mockResolvedValue({ id: documentId, content, revision: 1, ownerId: "owner", originKey: null });
    const response = await PUT(request("PUT", { content: numbered, revision: 1 }), { params: Promise.resolve({ id: clubId, documentId }) });
    expect(response.status).toBe(200);
    expect(mocks.updateDocument.mock.calls[0][0].data.content.session.microcycle).toBe("");
  });

  it("keeps the numbers of a plan that no training uses", async () => {
    mocks.linked.mockReturnValue(false);
    mocks.find.mockResolvedValue({ id: documentId, content, revision: 1, ownerId: "owner", originKey: null });
    expect((await PUT(request("PUT", { content: numbered, revision: 1 }), { params: Promise.resolve({ id: clubId, documentId }) })).status).toBe(200);
    expect(mocks.updateDocument.mock.calls[0][0].data.content.session.sessionNumber).toBe("2");
  });
});

describe("a plan of another author", () => {
  const read = () => GET(new NextRequest(`${base}/api/admin/clubs/${clubId}/training-plans/documents/${documentId}`, {
    headers: { cookie: "admin_session=test", "x-coach-group": coach },
  }), { params: Promise.resolve({ id: clubId, documentId }) });

  it("cannot be opened by the coach", async () => {
    mocks.find.mockResolvedValue(null);
    expect((await read()).status).toBe(404);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: documentId, clubId, ownerId: "owner" } }));
  });

  it("cannot be used for a training of the coach", async () => {
    mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: false });
    mocks.find.mockResolvedValue(null);
    const response = await POST(request("POST", { target, linkDocumentId: documentId }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(404);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: documentId, clubId, ownerId: "owner" } }));
    expect(mocks.createLink).not.toHaveBeenCalled();
  });

  it("cannot be changed by the coach", async () => {
    mocks.find.mockResolvedValue(null);
    mocks.reference.mockResolvedValue({ ...reference, documentId: null, occupied: true });
    expect((await put({})).status).toBe(404);
    expect(mocks.updateDocument).not.toHaveBeenCalled();
  });

  it("does not hide the own plan of the coach", async () => {
    mocks.find.mockResolvedValue({ id: documentId, content, revision: 3, updatedAt: new Date(0), originKey: null });
    mocks.usages.mockReturnValue([]);
    const body = await (await read()).json();
    expect(body.document).toMatchObject({ id: documentId, usages: [] });
  });
});

describe("the author of a plan", () => {
  it("is the coach group when a coach makes a plan in the library", async () => {
    mocks.find.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: copyId, content, revision: 1 });
    const response = await POST(request("POST", { id: copyId, content }), { params: Promise.resolve({ id: clubId }) });
    expect(response.status).toBe(201);
    expect(mocks.createDocument).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: `coach-group:${coach}` }) }));
  });
});
