import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("adds nullable attachment columns while preserving existing player messages", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE player_notifications (id TEXT PRIMARY KEY, body TEXT); INSERT INTO player_notifications VALUES ('old', 'Text only');`);
    await db.exec(readFileSync("prisma/migrations/20261107010000_player_notification_images/migration.sql", "utf8"));
    expect((await db.query("SELECT * FROM player_notifications")).rows).toEqual([{ id: "old", body: "Text only", image_url: null, image_public_id: null }]);
    await db.query("INSERT INTO player_notifications (id, body, image_url, image_public_id) VALUES ($1, $2, $3, $4)", ["new", "Photo", "https://example.com/photo.webp", "messages/photo"]);
    expect((await db.query("SELECT image_url FROM player_notifications WHERE id = 'new'")).rows).toEqual([{ image_url: "https://example.com/photo.webp" }]);
  } finally { await db.close(); }
});
