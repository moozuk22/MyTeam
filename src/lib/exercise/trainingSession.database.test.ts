import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/admin/clubs/[id]/training-plans/documents/route";
import { GET as getDocument } from "@/app/api/admin/clubs/[id]/training-plans/documents/[documentId]/route";
import { POST as saveCycle } from "@/app/api/admin/clubs/[id]/training-plans/microcycles/route";
import { blankDocument } from "./document";
import { emptyCycle, parseCycle } from "./microcycle";

vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: async () => ({ sub: "shared", roles: ["coach"] }) }));
vi.mock("@/lib/trainingPlanSubscriptions", () => ({ trainingPlanCapabilities: async () => ({ canSave: true }) }));

describe.skipIf(process.env.TRAINING_SESSION_DB_TEST !== "1")("training documents in the disposable PostgreSQL database", () => {
  const clubId = randomUUID(), coach = randomUUID(), other = randomUUID(), group = randomUUID(), cycleId = randomUUID();
  const groupKey = `custom:${group}`, week = "2026-11-16";
  const context = { params: Promise.resolve({ id: clubId }) };
  const row = () => ({ id: randomUUID(), cells: ["  А\nБ", "", "", "", "Физическа подготовка"] });
  const rows = [row(), row(), row(), row()];
  const content = { ...emptyCycle(), number: "12", season: "2024/2025", rows };
  const base = "http://localhost";
  function request(method: string, body?: unknown, author = coach) {
    return new NextRequest(base, { method, headers: { origin: base, cookie: "admin_session=test", "x-coach-group": author },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  function save(rowId: string, id = randomUUID(), author = coach) {
    return POST(request("POST", { id, automaticNumber: true, content: blankDocument(), target: { cycleId, rowId, groupKey, week } }, author), context);
  }
  beforeEach(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/delivery1") throw new Error("Use the local delivery1 test database.");
    vi.stubEnv("APP_BASE_URL", base);
    await prisma.club.create({ data: { id: clubId, name: "Тест", trainingGroupMode: "custom_group" } });
    await prisma.coachGroup.createMany({ data: [coach, other].map(id => ({ id, clubId, name: "Треньор" })) });
    await prisma.clubCustomTrainingGroup.create({ data: { id: group, clubId, coachGroupId: coach, name: "Група" } });
    await prisma.trainingMicrocycle.create({ data: { id: cycleId, clubId, week, content, groups: { create: { groupKey, groupName: "Група" } } } });
  });
  afterEach(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.hostname === "127.0.0.1" && url.pathname === "/delivery1") await prisma.club.deleteMany({ where: { id: clubId } });
    vi.unstubAllEnvs();
  });
  it("rejects another coach group and replays a committed create exactly once", async () => {
    expect((await save(rows[0].id, randomUUID(), other)).status).toBe(403);
    const id = randomUUID();
    const results = await Promise.all([save(rows[0].id, id), save(rows[0].id, id)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 201]);
    expect((await save(rows[0].id, id)).status).toBe(200);
    expect(await prisma.trainingPlanDocument.count({ where: { clubId } })).toBe(1);
    expect(await prisma.trainingSessionDocument.count({ where: { cycleId } })).toBe(1);
    const detail = { params: Promise.resolve({ id: clubId, documentId: id }) };
    expect((await getDocument(request("GET"), detail)).status).toBe(200);
    expect((await getDocument(request("GET", undefined, other), detail)).status).toBe(404);
  });
  it("keeps one winner for two independent first saves and rolls back the losing draft", async () => {
    const responses = await Promise.all([save(rows[1].id), save(rows[1].id)]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await responses.find(r => r.status === 409)!.json()).toMatchObject({ recovery: "private" });
    expect(await prisma.trainingSessionDocument.count({ where: { cycleId } })).toBe(1);
    expect(await prisma.trainingPlanDocument.count({ where: { clubId } })).toBe(1);
  });
  it("rolls back the document when PostgreSQL rejects the association", async () => {
    const id = randomUUID();
    const constraint = "qa_link_" + id.replaceAll("-", "");
    await prisma.$executeRawUnsafe(`ALTER TABLE training_session_documents ADD CONSTRAINT ${constraint} CHECK (document_id <> '${id}'::uuid)`);
    try {
      await expect(save(rows[2].id, id)).rejects.toThrow();
      expect(await prisma.trainingPlanDocument.count({ where: { id } })).toBe(0);
      expect(await prisma.trainingSessionDocument.count({ where: { documentId: id } })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE training_session_documents DROP CONSTRAINT ${constraint}`);
    }
  });
  it("follows the row after insertion, then unlinks deleted rows without deleting saved documents", async () => {
    const inserted = row();
    const response = await saveCycle(request("POST", { week, groupKey, cycleId, revision: 1,
      content: { ...content, rows: [inserted, ...rows] } }), context);
    expect(response.status).toBe(200);
    const updated = parseCycle((await response.json()).content);
    expect(updated.rows[0].id).not.toBe(inserted.id);
    const id = randomUUID();
    const created = await save(rows[2].id, id);
    const createdDocument = (await created.json()).document;
    // The plan does not store the training number. The link gives it from the current row position.
    expect(createdDocument.content.session).toMatchObject({ sessionNumber: "", microcycle: "", group: "Група", date: "", coach: "", season: content.season });
    expect(createdDocument.usages).toMatchObject([{ rowId: rows[2].id, sessionNumber: "4", group: "Група" }]);
    const unconfirmed = await saveCycle(request("POST", { week, groupKey, cycleId, revision: 2, content: { ...updated, rows: [] } }), context);
    expect(unconfirmed.status).toBe(409);
    expect(await unconfirmed.json()).toMatchObject({ removedLinks: 1 });
    expect(await prisma.trainingSessionDocument.count({ where: { cycleId } })).toBe(1);
    expect((await saveCycle(request("POST", { week, groupKey, cycleId, revision: 2, content: { ...updated, rows: [] }, removedLinks: 1 }), context)).status).toBe(200);
    expect((await save(rows[3].id)).status).toBe(410);
    expect((await save(rows[2].id, id)).status).toBe(410);
    expect(await prisma.trainingSessionDocument.count({ where: { cycleId } })).toBe(0);
    expect(await prisma.trainingPlanDocument.count({ where: { clubId } })).toBe(1);
  });
});
