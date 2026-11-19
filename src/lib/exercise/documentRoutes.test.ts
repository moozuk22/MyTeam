import { trainingPlanCapabilities } from "@/lib/trainingPlanSubscriptions";
vi.mock("@/lib/trainingPlanSubscriptions", () => ({ trainingPlanCapabilities: vi.fn() }));
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { blankDocument, currentCompetitionSeason } from "./document";
import { EMPTY_EXERCISE } from "./model";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  club: vi.fn(),
  drawings: vi.fn(),
  find: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
  syncImages: vi.fn(),
}));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: mocks.session }));
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    club: { findUnique: mocks.club },
    trainingPlan: { findMany: mocks.drawings },
    trainingPlanDocument: {
      findFirst: mocks.find,
      findMany: mocks.list,
      createMany: mocks.create,
      updateMany: mocks.update,
      deleteMany: mocks.delete,
    },
  },
}));

import { GET as list, POST } from "@/app/api/admin/clubs/[id]/training-plans/documents/route";
import { DELETE, GET, PUT } from "@/app/api/admin/clubs/[id]/training-plans/documents/[documentId]/route";

const clubId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";
const drawingId = "33333333-3333-4333-8333-333333333333";
const otherClub = "44444444-4444-4444-8444-444444444444";
const ownerId = "test-owner";
const scope = { clubId, ownerId, id: documentId };
const route = `http://localhost/api/admin/clubs/${clubId}/training-plans/documents`;
const collection = { params: Promise.resolve({ id: clubId }) };
const detail = { params: Promise.resolve({ id: clubId, documentId }) };

function request(method: string, body?: unknown, path = "", origin = "http://localhost") {
  return new NextRequest(`${route}${path}`, {
    method,
    headers: { cookie: "admin_session=test", origin, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ sub: ownerId, roles: ["coach"], defaultClubId: clubId });
  vi.mocked(trainingPlanCapabilities).mockResolvedValue({enabled:true,canSave:true,canPrint:true});
  mocks.club.mockResolvedValue({ id: clubId });
  mocks.transaction.mockImplementation((fn) => fn({
    $executeRaw: vi.fn(),
    club: { findUnique: mocks.club },
    trainingPlan: { findMany: mocks.drawings },
    trainingPlanDocument: { findFirst: mocks.find, createMany: mocks.create, updateMany: mocks.update, deleteMany: mocks.delete },
    trainingDocumentImage: { deleteMany: mocks.syncImages },
  }));
});

describe("training plan documents", () => {
  it.each([`/${documentId}`, `/%32${documentId.slice(1)}`, `/${documentId}/`])("blocks an unpaid document update at %s before reads or writes", async path => {
    vi.mocked(trainingPlanCapabilities).mockResolvedValue({ enabled: false, canSave: false, canPrint: false });
    const content = blankDocument();
    mocks.find.mockResolvedValue({ id: documentId, content, revision: 1 });
    mocks.update.mockResolvedValue({ count: 1 });
    const response = await PUT(request("PUT", { content, revision: 1 }, path), detail);
    expect(response.status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each(["coach", "admin"])("keeps encoded document updates available to an authorized %s", async role => {
    mocks.session.mockResolvedValue({ sub: ownerId, roles: [role], defaultClubId: clubId });
    vi.mocked(trainingPlanCapabilities).mockResolvedValue({ enabled: role === "coach", canSave: true, canPrint: true });
    const content = blankDocument();
    mocks.find.mockResolvedValue({ id: documentId, content, revision: 1 });
    mocks.update.mockResolvedValue({ count: 1 });
    const response = await PUT(request("PUT", { content, revision: 1 }, `/%32${documentId.slice(1)}`), detail);
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { ...scope, revision: 1 } }));
    expect(vi.mocked(trainingPlanCapabilities)).toHaveBeenCalledWith(clubId, [role]);
  });

  it("scopes list and detail to the authenticated owner even for administrator accounts", async () => {
    mocks.session.mockResolvedValue({ sub: ownerId, roles: ["admin"] });
    mocks.list.mockResolvedValue([]);
    mocks.find.mockResolvedValue(null);
    expect((await list(request("GET"), collection)).status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({
      where: { clubId, ownerId }, take: 26,
      select: { id: true, title: true, updatedAt: true, revision: true, content: true },
    }));
    expect((await GET(request("GET"), detail)).status).toBe(404);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: scope }));
    mocks.delete.mockResolvedValue({ count: 0 });
    expect((await DELETE(request("DELETE", undefined, "?revision=1"), detail)).status).toBe(404);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("lists a small preview instead of the full document content", async () => {
    mocks.session.mockResolvedValue({ sub: ownerId, roles: ["admin"] });
    const content = blankDocument("U12");
    content.session.date = "2026-11-19";
    content.sections[1] = { ...content.sections[1], duration: "15", drawing: { sourceId: documentId, title: "Рисунка", layout: EMPTY_EXERCISE } };
    mocks.list.mockResolvedValue([{ id: documentId, title: "План", updatedAt: new Date(0), revision: 2, content }]);
    const body = await (await list(request("GET"), collection)).json();
    expect(body.documents[0]).not.toHaveProperty("content");
    expect(body.documents[0].preview).toMatchObject({ date: "2026-11-19" });
    expect(JSON.stringify(body)).not.toContain("objects");
  });

  it("rejects a cross-club coach, untrusted origin and forged drawing before writing", async () => {
    const content = blankDocument();
    const input = { ...content, sections: content.sections.map((section, index) => ({
      ...section, drawing: index === 0 ? drawingId : null,
    })) };
    expect((await list(request("GET"), { params: Promise.resolve({ id: otherClub }) })).status).toBe(403);
    expect((await POST(request("POST", { id: documentId, content: input }, "", "https://other.example"), collection)).status).toBe(403);
    mocks.find.mockResolvedValue(null);
    mocks.drawings.mockResolvedValue([]);
    expect((await POST(request("POST", { id: documentId, content: input }), collection)).status).toBe(400);
    expect(mocks.drawings).toHaveBeenCalledWith(expect.objectContaining({ where: { clubId, id: { in: [drawingId] } } }));
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("captures a drawing with its original orientation and keeps it while merging and splitting", async () => {
    const layout = { ...EMPTY_EXERCISE, pitchRotation: 90 };
    const input = blankDocument();
    const attach = { ...input, sections: input.sections.map((section, index) => ({
      ...section, organization: index === 2 ? "Подаване" : "", drawing: index === 2 ? drawingId : null,
    })) };
    mocks.drawings.mockResolvedValue([{ id: drawingId, title: "Схема", layout }]);
    const stored = {
      ...input,
      session: { ...input.session, ...currentCompetitionSeason() },
      sections: attach.sections.map((section, index) => ({
        ...section, drawing: index === 2 ? { sourceId: drawingId, title: "Схема", layout } : null,
      })),
    };
    const row = { id: documentId, content: stored, revision: 1 };
    mocks.find.mockResolvedValueOnce(null).mockResolvedValue(row);
    mocks.create.mockResolvedValue({ count: 1 });
    expect((await POST(request("POST", { id: documentId, content: attach }), collection)).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ...scope, content: stored }),
    }));

    mocks.drawings.mockClear();
    mocks.update.mockResolvedValue({ count: 1 });
    const keep = { ...attach, sections: attach.sections.map((section) => ({
      ...section, drawing: section.drawing ? "keep" : null,
    })) };
    const merged = await PUT(request("PUT", { content: { ...keep, merge: "left" }, revision: 1 }), detail);
    expect(merged.status).toBe(200);
    const mergedDocument = (await merged.json()).document;
    expect(mergedDocument.content).toEqual({ ...stored, merge: "left" });
    mocks.find.mockResolvedValue(mergedDocument);
    const split = await PUT(request("PUT", { content: keep, revision: 2 }), detail);
    expect((await split.json()).document.content).toEqual(stored);
    expect(mocks.drawings).not.toHaveBeenCalled();
  });

  it("keeps concurrent changes safe with a conditional revision update", async () => {
    const content = blankDocument();
    mocks.find.mockResolvedValue({ id: documentId, content, revision: 3 });
    const stale = await PUT(request("PUT", { content, revision: 2 }), detail);
    expect(stale.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
    mocks.update.mockResolvedValue({ count: 0 });
    const raced = await PUT(request("PUT", { content, revision: 3 }), detail);
    expect(raced.status).toBe(409);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { ...scope, revision: 3 },
      data: expect.objectContaining({ revision: { increment: 1 } }),
    }));
  });
});
