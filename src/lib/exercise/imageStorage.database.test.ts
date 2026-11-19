import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { blankDocument, type PlanContent } from "./document";
import { EMPTY_EXERCISE, type Exercise } from "./model";
import { imageMigrationStatements, imageTestSchema } from "./imageTestSchema";

const state = vi.hoisted(() => ({
  enabled: process.env.TRAINING_IMAGE_DB_TEST === "1",
  beforeImageRead: undefined as (() => Promise<void>) | undefined,
  schema: `training_images_test_${globalThis.crypto.randomUUID().replaceAll("-", "")}`,
  session: { sub: "99999999-9999-4999-8999-999999999999", roles: ["coach"], defaultClubId: "11111111-1111-4111-8111-111111111111" },
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  if (!state.enabled) return { prisma: {} };
  const url = new URL(process.env.DATABASE_URL!);
  if (!url.hostname.endsWith(".neon.tech") || url.pathname !== "/neondb")
    throw new Error("These checks require the configured Neon development database.");
  url.searchParams.set("schema", state.schema);
  const client = new PrismaClient({ datasources: { db: { url: url.toString() } } }).$extends({
    query: { trainingImage: { async findFirst({ args, query }) {
      await state.beforeImageRead?.();
      return query(args);
    } } },
  });
  type TestTransaction = Omit<typeof client, "$extends" | "$transaction" | "$connect" | "$disconnect" | "$on" | "$use">;
  const scoped = async <T,>(operation: (tx: TestTransaction) => Promise<T>, options?: { isolationLevel?: import("@prisma/client").Prisma.TransactionIsolationLevel }) =>
    client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${state.schema}"`);
      return operation(tx);
    }, options);
  return { prisma: new Proxy(client, {
    get(target, property) {
      if (property === "$transaction") return scoped;
      if (property === "$queryRaw") return (strings: TemplateStringsArray, ...values: unknown[]) =>
        scoped((tx) => tx.$queryRaw(strings, ...values));
      if (property === "$executeRaw") return (strings: TemplateStringsArray, ...values: unknown[]) =>
        scoped((tx) => tx.$executeRaw(strings, ...values));
      return Reflect.get(target, property);
    },
  }) };
});
vi.mock("@/lib/adminAuth", () => ({ verifyAdminToken: async () => state.session }));
vi.mock("@/lib/trainingPlanSubscriptions", () => ({ trainingPlanCapabilities: async () => ({ canSave: true }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "test" }) }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("TEST_NOT_FOUND"); }, redirect: () => { throw new Error("TEST_REDIRECT"); } }));
vi.mock("./categories", () => ({ listTrainingPlanCategories: async () => [], isTrainingPlanCategoryAvailable: async () => true }));
vi.mock("@/app/admin/training-plans/[planId]/konva/EditorLoader", () => ({ default: () => null }));
import KonvaPage from "@/app/admin/training-plans/[planId]/konva/page";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/admin/clubs/[id]/training-plans/route";
import { GET, PUT, DELETE } from "@/app/api/admin/clubs/[id]/training-plans/[planId]/route";
import { POST as createDocument } from "@/app/api/admin/clubs/[id]/training-plans/documents/route";
import { PUT as updateDocument, DELETE as deleteDocument } from "@/app/api/admin/clubs/[id]/training-plans/documents/[documentId]/route";
import { GET as getImage } from "@/app/api/admin/clubs/[id]/training-plans/images/[imageId]/route";
import { backfillTrainingImages } from "./imageBackfill";

const club = "11111111-1111-4111-8111-111111111111";
const otherClub = "22222222-2222-4222-8222-222222222222";
const owner = state.session.sub;
const otherOwner = "88888888-8888-4888-8888-888888888888";
const inline = (lastByte = "00") => `data:image/jpeg;base64,${Buffer.from(`ffd8ff${lastByte}`, "hex").toString("base64")}`;
const drawing = (lastByte = "00"): Exercise => ({ ...EMPTY_EXERCISE, background: { src: inline(lastByte), x: 525, y: 350, width: 100, height: 80, rotation: 0 } });
const params = (id: string, clubId = club) => ({ params: Promise.resolve({ id: clubId, planId: id }) });
const docParams = (id: string) => ({ params: Promise.resolve({ id: club, documentId: id }) });
function request(method: string, body?: unknown, suffix = "") {
  return new NextRequest(`http://localhost/api/admin/clubs/${club}/training-plans${suffix}`, {
    method, headers: { cookie: "admin_session=test", origin: "http://localhost", "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function create(layout = drawing(), clubId = club) {
  const response = await POST(request("POST", { title: "Упражнение", layout }), { params: Promise.resolve({ id: clubId }) });
  expect(response.status).toBe(201);
  return (await response.json()).plan.id as string;
}
async function edit(id: string, layout: Exercise) {
  const before = await prisma.trainingPlan.findUniqueOrThrow({ where: { id } });
  const response = await PUT(request("PUT", { layout, expectedUpdatedAt: before.updatedAt.toISOString() }), params(id));
  expect(response.status).toBe(200);
  return (await response.json()).plan;
}
async function imageResponse(imageId: string, clubId = club) {
  return getImage(request("GET"), { params: Promise.resolve({ id: clubId, imageId }) });
}

describe.skipIf(!state.enabled)("shared images in an isolated development schema", () => {
  let admin: PrismaClient;
  beforeAll(async () => {
    vi.stubEnv("APP_BASE_URL", "http://localhost");
    admin = new PrismaClient();
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${state.schema}"`);
    await admin.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${state.schema}"`);
      for (const sql of imageMigrationStatements(imageTestSchema)) await tx.$executeRawUnsafe(sql);
      const migration = readFileSync("prisma/migrations/20261119160000_shared_training_images/migration.sql", "utf8");
      for (const sql of imageMigrationStatements(migration)) await tx.$executeRawUnsafe(sql);
    });
    await prisma.$executeRaw`INSERT INTO clubs(id) VALUES (${club}::uuid), (${otherClub}::uuid)`;
  }, 30000);
  afterAll(async () => {
    vi.unstubAllEnvs();
    await prisma.$disconnect();
    if (admin) {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${state.schema}" CASCADE`);
      await admin.$disconnect();
    }
  });

  it("deduplicates copies, preserves snapshots, supports undo, and removes only unused images", async () => {
    const id = await create();
    const first = await prisma.trainingPlan.findUniqueOrThrow({ where: { id } });
    const originalImage = first.backgroundImageId!;
    expect(JSON.stringify(first.layout)).not.toContain("base64");
    expect(await prisma.trainingImage.count()).toBe(1);
    const duplicate = await POST(request("POST", { title: "Копие", sourcePlanId: id }), { params: Promise.resolve({ id: club }) });
    expect(duplicate.status).toBe(201);
    const duplicateId = (await duplicate.json()).plan.id;
    expect((await prisma.trainingPlan.findUniqueOrThrow({ where: { id: duplicateId } })).backgroundImageId).toBe(originalImage);

    const documentId = randomUUID();
    const content = blankDocument();
    const input = { ...content, sections: content.sections.map((section, index) => ({ ...section, drawing: index < 2 ? id : null })) };
    const saved = await createDocument(request("POST", { id: documentId, content: input }), { params: Promise.resolve({ id: club }) });
    expect(saved.status).toBe(201);
    const savedContent = (await saved.json()).document.content as PlanContent;
    expect(JSON.stringify(savedContent)).not.toContain("base64");
    expect(savedContent.sections[0].drawing?.layout).toEqual(first.layout);
    expect(await prisma.trainingDocumentImage.count({ where: { documentId } })).toBe(1);
    expect(await prisma.trainingImage.count()).toBe(1);

    const hydrated = await GET(request("GET", undefined, "?inlineBackground=1"), params(id));
    expect((await hydrated.json()).plan.layout.background.src).toBe(inline());
    const changed = await edit(id, drawing("01"));
    expect(changed.layout.background.src).not.toBe((first.layout as Exercise).background?.src);
    expect(await prisma.trainingImage.count()).toBe(2);
    expect((await prisma.trainingPlanDocument.findUniqueOrThrow({ where: { id: documentId } })).content).toEqual(savedContent);
    await edit(id, drawing()); // Undo keeps bytes locally and can save the original again.
    expect(await prisma.trainingImage.count()).toBe(1);
    await edit(id, drawing("01")); // Recreate the image removed after Undo.
    expect(await prisma.trainingImage.count()).toBe(2);

    const stale = await PUT(request("PUT", { layout: drawing("02"), expectedUpdatedAt: first.updatedAt.toISOString() }), params(id));
    expect(stale.status).toBe(409);
    expect(await prisma.trainingImage.count()).toBe(2); // The failed save rolls back its new image.

    const concurrent = await Promise.all(Array.from({ length: 4 }, () => create(drawing("01"))));
    expect(await prisma.trainingImage.count()).toBe(2);
    for (const planId of [id, duplicateId, ...concurrent]) expect((await DELETE(request("DELETE"), params(planId))).status).toBe(200);
    expect(await prisma.trainingImage.count()).toBe(1);
    expect((await imageResponse(originalImage)).status).toBe(200);
    const repeat = await createDocument(request("POST", { id: documentId, content: input }), { params: Promise.resolve({ id: club }) });
    expect(repeat.status).toBe(200); // A retry still works after the source exercise is deleted.
    expect((await repeat.json()).alreadyCreated).toBe(true);

    state.session.sub = otherOwner;
    expect((await imageResponse(originalImage)).status).toBe(404);
    const forged = await POST(request("POST", { title: "Чужда рисунка", layout: first.layout }), { params: Promise.resolve({ id: club }) });
    expect(forged.status).toBe(400);
    state.session.sub = owner;
    expect((await imageResponse(originalImage, otherClub)).status).toBe(403);
    const foreignLayout = { ...drawing(), background: { ...drawing().background!, src: `/api/admin/clubs/${otherClub}/training-plans/images/${originalImage}` } };
    expect((await POST(request("POST", { title: "Чужд клуб", layout: foreignLayout }), { params: Promise.resolve({ id: club }) })).status).toBe(400);

    const keep = { ...savedContent, sections: savedContent.sections.map((section) => ({ ...section, drawing: section.drawing ? "keep" : null })) };
    const concurrentEdits = await Promise.all([1, 2].map(() => updateDocument(request("PUT", { content: keep, revision: 1 }), docParams(documentId))));
    expect(concurrentEdits.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await prisma.trainingImage.count()).toBe(1);
    expect((await deleteDocument(request("DELETE", undefined, "?revision=1"), docParams(documentId))).status).toBe(409);
    expect((await deleteDocument(request("DELETE", undefined, "?revision=2"), docParams(documentId))).status).toBe(204);
    expect(await prisma.trainingImage.count()).toBe(0);
    expect((await imageResponse(originalImage)).status).toBe(404);
  }, 60000);

  for (const reader of ["page", "api"] as const) {
    for (const writer of ["replace", "delete"] as const) {
      it(`${reader} hydrates a consistent snapshot during concurrent ${writer}`, async () => {
        const id = await create(drawing("03"));
        const previous = await prisma.trainingPlan.findUniqueOrThrow({ where: { id } });
        let reached!: () => void;
        let resume!: () => void;
        const paused = new Promise<void>((resolve) => { reached = resolve; });
        const released = new Promise<void>((resolve) => { resume = resolve; });
        state.beforeImageRead = async () => {
          state.beforeImageRead = undefined;
          reached();
          await released;
        };
        const read = () => reader === "api"
          ? GET(request("GET", undefined, "?inlineBackground=1"), params(id))
          : KonvaPage({ params: Promise.resolve({ planId: id }), searchParams: Promise.resolve({ clubId: club }) });
        const pending = read();
        try {
          await paused;
          if (writer === "replace") await edit(id, drawing("04"));
          else expect((await DELETE(request("DELETE"), params(id))).status).toBe(200);
          expect(await prisma.trainingImage.findUnique({ where: { id: previous.backgroundImageId! } })).toBeNull();
        } finally {
          state.beforeImageRead = undefined;
          resume();
        }
        const result = await pending;
        const snapshot = result instanceof Response ? (await result.json()).plan : result.props.plan;
        expect(snapshot.layout.background.src).toBe(inline("03"));
        expect(snapshot.updatedAt).toBe(previous.updatedAt.toISOString());
        if (writer === "replace") expect((await DELETE(request("DELETE"), params(id))).status).toBe(200);
        // Readers that start after deletion use the existing missing-plan response.
        if (reader === "api") expect((await GET(request("GET", undefined, "?inlineBackground=1"), params(id))).status).toBe(404);
        else await expect(read()).rejects.toThrow("TEST_NOT_FOUND");
      }, 30000);
    }
  }

  it("backfills embedded images, including document-only copies, without changing revisions", async () => {
    const timestamp = new Date("2026-01-01T10:00:00Z");
    const plan = await prisma.trainingPlan.create({ data: { clubId: club, title: "Legacy", layout: drawing(), updatedAt: timestamp } });
    const content = blankDocument();
    content.sections[0].drawing = { sourceId: randomUUID(), title: "Deleted source", layout: drawing() };
    const documentId = randomUUID();
    await prisma.trainingPlanDocument.create({ data: { id: documentId, clubId: club, ownerId: owner, title: "Legacy document", content, revision: 7, updatedAt: timestamp } });
    state.session.defaultClubId = otherClub;
    const otherId = await create(drawing(), otherClub);
    state.session.defaultClubId = club;
    expect(await backfillTrainingImages()).toEqual({ plans: 1, documents: 1 });
    expect(await backfillTrainingImages()).toEqual({ plans: 0, documents: 0 });
    const storedPlan = await prisma.trainingPlan.findUniqueOrThrow({ where: { id: plan.id } });
    const storedDocument = await prisma.trainingPlanDocument.findUniqueOrThrow({ where: { id: documentId } });
    expect(storedPlan.updatedAt).toEqual(timestamp);
    expect(storedDocument.updatedAt).toEqual(timestamp);
    expect(storedDocument.revision).toBe(7);
    expect(JSON.stringify(storedDocument.content)).not.toContain("base64");
    expect(await prisma.trainingImage.count()).toBe(2);
    expect((await prisma.trainingPlan.findUniqueOrThrow({ where: { id: otherId } })).backgroundImageId).not.toBe(storedPlan.backgroundImageId);
    expect((await DELETE(request("DELETE"), params(plan.id))).status).toBe(200);
    expect((await imageResponse(storedPlan.backgroundImageId!)).status).toBe(200);
    const remove = { ...content, sections: content.sections.map((section) => ({ ...section, drawing: null })) };
    expect((await updateDocument(request("PUT", { content: remove, revision: 7 }), docParams(documentId))).status).toBe(200);
    expect(await prisma.trainingImage.count({ where: { clubId: club } })).toBe(0);
  }, 60000);
});
