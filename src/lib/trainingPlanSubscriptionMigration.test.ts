import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("adds independent subscriptions with payment and grant constraints", async () => {
  const db = new PGlite();
  const club = "11111111-1111-4111-8111-111111111111";
  const payment = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`CREATE TABLE clubs(id uuid PRIMARY KEY); INSERT INTO clubs VALUES('${club}');
      CREATE TABLE club_calculator_subscriptions(club_id uuid PRIMARY KEY, version int);
      INSERT INTO club_calculator_subscriptions VALUES('${club}',7);`);
    await db.exec(readFileSync("prisma/migrations/20261117140000_training_plan_subscriptions/migration.sql", "utf8"));
    expect((await db.query("SELECT count(*)::int n FROM club_training_plan_subscriptions")).rows).toEqual([{ n: 0 }]);
    expect((await db.query("SELECT version FROM club_calculator_subscriptions")).rows).toEqual([{ version: 7 }]);
    await db.exec(`INSERT INTO club_training_plan_subscriptions(club_id) VALUES('${club}');
      INSERT INTO club_training_plan_payments(id,club_id,billing_mode,paid_on,total,request,created_by)
      VALUES('${payment}','${club}','yearly','2026-11-17',100,'{}','admin');
      INSERT INTO club_training_plan_grants(club_id,kind,starts_at,ends_at,payment_id,amount)
      VALUES('${club}','paid','2026-11-01','2027-11-01','${payment}',100);
      INSERT INTO club_training_plan_grants(club_id,kind,starts_at) VALUES('${club}','free',CURRENT_TIMESTAMP);`);
    await expect(db.exec(`INSERT INTO club_training_plan_grants(club_id,kind,starts_at) VALUES('${club}','paid',CURRENT_TIMESTAMP)`)).rejects.toThrow();
    await expect(db.exec(`UPDATE club_training_plan_payments SET total=-1 WHERE id='${payment}'`)).rejects.toThrow();
    await expect(db.exec(`UPDATE club_training_plan_subscriptions SET billing_mode='weekly'`)).rejects.toThrow();
    await db.exec(`UPDATE club_training_plan_payments SET voided_at=CURRENT_TIMESTAMP WHERE id='${payment}';
      UPDATE club_training_plan_grants SET revoked_at=CURRENT_TIMESTAMP WHERE payment_id='${payment}';`);
    expect((await db.query("SELECT count(*)::int n FROM club_training_plan_grants WHERE revoked_at IS NULL")).rows).toEqual([{ n: 1 }]);
    await db.exec(`UPDATE club_training_plan_payments SET voided_at=NULL WHERE id='${payment}';
      UPDATE club_training_plan_grants SET revoked_at=NULL WHERE payment_id='${payment}';`);
    expect((await db.query("SELECT count(*)::int n FROM club_training_plan_payments")).rows).toEqual([{ n: 1 }]);
    await db.exec(`DELETE FROM clubs WHERE id='${club}'`);
    expect((await db.query("SELECT count(*)::int n FROM club_training_plan_grants")).rows).toEqual([{ n: 0 }]);
  } finally { await db.close(); }
}, 30000);
