import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { imageTestSchema } from "./imageTestSchema";

const db = new PGlite();
const club = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const image = "33333333-3333-4333-8333-333333333333";
beforeAll(async () => {
  await db.exec(imageTestSchema);
  await db.exec(readFileSync("prisma/migrations/20261119160000_shared_training_images/migration.sql", "utf8"));
  await db.query("INSERT INTO clubs VALUES ($1),($2)", [club, other]);
  await db.query("INSERT INTO training_images(id,club_id,sha256,bytes) VALUES ($1,$2,$3,decode('ffd8ff00','hex'))", [image, club, "a".repeat(64)]);
}, 30000);
afterAll(() => db.close());
it("prevents duplicate image bytes per club and changes to shared records", async () => {
  await expect(db.query("INSERT INTO training_images(club_id,sha256,bytes) VALUES ($1,$2,decode('ffd8ff00','hex'))", [club, "a".repeat(64)])).rejects.toThrow(/unique/);
  await expect(db.query("UPDATE training_images SET bytes=decode('ffd8ff01','hex') WHERE id=$1", [image])).rejects.toThrow(/immutable/);
  await expect(db.query("INSERT INTO training_images(club_id,sha256,bytes) VALUES ($1,$2,decode('001122','hex'))", [club, "b".repeat(64)])).rejects.toThrow(/check constraint/);
});
it("enforces club isolation and keeps an image until its final document reference is removed", async () => {
  await expect(db.query("INSERT INTO training_plans(club_id,title,layout,background_image_id) VALUES ($1,'Test','{}',$2)", [other, image])).rejects.toThrow(/foreign key/);
  const plan = (await db.query<{id:string}>("INSERT INTO training_plans(club_id,title,layout,background_image_id) VALUES ($1,'Test','{}',$2) RETURNING id", [club, image])).rows[0].id;
  const doc = "44444444-4444-4444-8444-444444444444";
  await db.query("INSERT INTO training_plan_documents(id,club_id,owner_id,title,content) VALUES ($1,$2,'owner','Document','{}')", [doc, club]);
  await db.query("INSERT INTO training_document_images VALUES ($1,$2,$3)", [doc, image, club]);
  await db.query("DELETE FROM training_plans WHERE id=$1", [plan]);
  await expect(db.query("DELETE FROM training_images WHERE id=$1", [image])).rejects.toThrow(/foreign key/);
  await db.query("DELETE FROM training_plan_documents WHERE id=$1", [doc]);
  await db.query("DELETE FROM training_images WHERE id=$1", [image]);
  expect((await db.query("SELECT * FROM training_document_images")).rows).toEqual([]);
});
it("allows club deletion to remove its images and all references", async () => {
  const created = (await db.query<{id:string}>("INSERT INTO training_images(club_id,sha256,bytes) VALUES ($1,$2,decode('ffd8ff00','hex')) RETURNING id", [club, "a".repeat(64)])).rows[0].id;
  await db.query("INSERT INTO training_plans(club_id,title,layout,background_image_id) VALUES ($1,'Test','{}',$2)", [club, created]);
  const doc = "55555555-5555-4555-8555-555555555555";
  await db.query("INSERT INTO training_plan_documents(id,club_id,owner_id,title,content) VALUES ($1,$2,'owner','Document','{}')", [doc, club]);
  await db.query("INSERT INTO training_document_images VALUES ($1,$2,$3)", [doc, created, club]);
  await db.query("DELETE FROM clubs WHERE id=$1", [club]);
  expect((await db.query("SELECT * FROM training_images WHERE club_id=$1", [club])).rows).toEqual([]);
});
