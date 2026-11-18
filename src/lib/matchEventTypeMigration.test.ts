import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

it("defaults existing events to match and restricts stored event types", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE club_matches (id INTEGER PRIMARY KEY); INSERT INTO club_matches VALUES (1);");
    await db.exec(await readFile(new URL("../../prisma/migrations/20261019130000_match_event_type/migration.sql", import.meta.url), "utf8"));
    expect((await db.query("SELECT event_type FROM club_matches")).rows).toEqual([{ event_type: "match" }]);
    await db.exec("INSERT INTO club_matches (id, event_type) VALUES (2, 'duel'), (3, 'competition'), (4, 'participation');");
    await expect(db.exec("INSERT INTO club_matches (id, event_type) VALUES (5, 'tournament')")).rejects.toThrow();
    const existing = (await db.query("SELECT * FROM club_matches ORDER BY id")).rows;
    await db.exec(await readFile(new URL("../../prisma/migrations/20261118120000_add_tournament_event_type/migration.sql", import.meta.url), "utf8"));
    expect((await db.query("SELECT * FROM club_matches ORDER BY id")).rows).toEqual(existing);
    await db.exec("INSERT INTO club_matches (id, event_type) VALUES (5, 'tournament'); INSERT INTO club_matches (id) VALUES (6);");
    expect((await db.query("SELECT event_type FROM club_matches WHERE id >= 5 ORDER BY id")).rows).toEqual([
      { event_type: "tournament" },
      { event_type: "match" },
    ]);
    await expect(db.exec("UPDATE club_matches SET event_type = 'unknown'")).rejects.toThrow();
    await expect(db.exec("UPDATE club_matches SET event_type = NULL")).rejects.toThrow();
  } finally { await db.close(); }
}, 30000);
