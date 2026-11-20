import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { emptyCycle, parseCycle } from "./microcycle";

it("preserves duplicate and empty legacy rows and keeps the document after a cycle is removed", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE clubs(id uuid PRIMARY KEY);
      CREATE TABLE training_plan_documents(id uuid PRIMARY KEY, club_id uuid, UNIQUE(id, club_id));`);
    await db.exec(readFileSync("prisma/migrations/20261119200000_training_microcycles/migration.sql", "utf8"));
    const club = crypto.randomUUID(), cycle = crypto.randomUUID(), doc = crypto.randomUUID();
    const cells = ["  А\nБ  ", "", "", "", ""];
    const { version, ...legacy } = emptyCycle();
    expect(version).toBe(2);
    await db.query("INSERT INTO clubs VALUES ($1)", [club]);
    await db.query("INSERT INTO training_plan_documents VALUES ($1, $2)", [doc, club]);
    await db.query("INSERT INTO training_microcycles(id,club_id,group_key,group_name,week,content) VALUES ($1,$2,'g','Група','2026-11-16',$3)",
      [cycle, club, JSON.stringify({ ...legacy, rows: [cells, cells] })]);
    await db.exec(readFileSync("prisma/migrations/20261120100000_training_session_documents/migration.sql", "utf8"));
    const [saved] = (await db.query<{ content: unknown; revision: number }>("SELECT content, revision FROM training_microcycles")).rows;
    const { rows } = parseCycle(saved.content);
    expect(rows.map(r => r.cells)).toEqual([cells, cells]);
    expect(rows[0].id).not.toBe(rows[1].id);
    expect(saved.revision).toBe(2);
    await db.query("INSERT INTO training_session_documents VALUES ($1,$2,'g',$3,$4)", [cycle, club, rows[0].id, doc]);
    const secondDoc = crypto.randomUUID();
    await db.query("INSERT INTO training_plan_documents VALUES ($1, $2)", [secondDoc, club]);
    await expect(db.query("INSERT INTO training_session_documents VALUES ($1,$2,'g',$3,$4)", [cycle, club, rows[0].id, secondDoc])).rejects.toThrow();
    await db.query("INSERT INTO training_session_documents VALUES ($1,$2,'another-group',$3,$4)", [cycle, club, rows[0].id, secondDoc]);
    await db.exec(readFileSync("prisma/migrations/20261121100000_reuse_training_documents/migration.sql", "utf8"));
    const nextCycle = crypto.randomUUID();
    await db.query("INSERT INTO training_microcycles(id,club_id,group_key,group_name,week,content) VALUES ($1,$2,'g','Група','2026-11-23',$3)",
      [nextCycle, club, JSON.stringify(saved.content)]);
    await db.query("INSERT INTO training_session_documents VALUES ($1,$2,'g',$3,$4)", [nextCycle, club, rows[0].id, doc]);
    await expect(db.query("INSERT INTO training_session_documents VALUES ($1,$2,'g',$3,$4)", [nextCycle, club, rows[0].id, secondDoc])).rejects.toThrow();
    await db.query("UPDATE training_session_documents SET document_id=$1 WHERE cycle_id=$2", [secondDoc, nextCycle]);
    expect((await db.query("SELECT document_id FROM training_session_documents WHERE cycle_id=$1 AND group_key='g'", [cycle])).rows).toEqual([{ document_id: doc }]);
    await db.query("DELETE FROM training_microcycles WHERE id=$1", [nextCycle]);
    await db.query("DELETE FROM training_microcycles WHERE id=$1", [cycle]);
    expect((await db.query("SELECT * FROM training_session_documents")).rows).toEqual([]);
    expect((await db.query("SELECT id FROM training_plan_documents")).rows).toEqual(expect.arrayContaining([{ id: doc }, { id: secondDoc }]));
  } finally { await db.close(); }
}, 30000);
