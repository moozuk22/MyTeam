import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("tracks both removal choices, retries and reactivation; archives payments without changing revenue", async () => {
 const db = new PGlite();
 const club = "00000000-0000-4000-8000-000000000001";
 const player = "00000000-0000-4000-8000-000000000002";
 try {
  await db.exec(`CREATE TABLE clubs(id uuid PRIMARY KEY,payment_workflow text DEFAULT 'calendar_month');
   CREATE TABLE players(id uuid PRIMARY KEY,club_id uuid REFERENCES clubs(id) ON DELETE CASCADE, full_name text,team_group int,is_active boolean DEFAULT true,first_billing_month timestamptz,created_at timestamptz DEFAULT now());
   CREATE TABLE payment_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),player_id uuid REFERENCES players(id) ON DELETE CASCADE, paid_for timestamptz,paid_at timestamptz DEFAULT now(),amount numeric,currency text DEFAULT 'EUR');
   CREATE TABLE payment_waivers(player_id uuid REFERENCES players(id) ON DELETE CASCADE,waived_for timestamptz);
   CREATE TABLE "_PlayerCoachGroups"("A" uuid,"B" uuid REFERENCES players(id) ON DELETE CASCADE);
   CREATE TABLE club_custom_training_group_players(group_id uuid,player_id uuid REFERENCES players(id) ON DELETE CASCADE);
   INSERT INTO clubs(id) VALUES ('${club}');
   INSERT INTO players(id,club_id,full_name,first_billing_month) VALUES ('${player}','${club}','Дълго име на състезател','2026-01-01');`);
  for (const migration of ["20261029160000_club_finance", "20261029190000_manual_club_revenue", "20261116230000_player_report_history", "20261117010000_report_billing_start_corrections"]) {
   await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"));
  }
  await db.exec(`INSERT INTO payment_logs(player_id,paid_for,amount) VALUES ('${player}','2026-03-01',30),('${player}','2026-04-01',40);
   UPDATE players SET is_active=false,report_include_removal_month=false WHERE id='${player}';`);
  const current = (await db.query<{month_key:string}>(`SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia','YYYY-MM') AS month_key`)).rows[0].month_key;
  const activity = async () => (await db.query<{report_activity: Array<{from:string;until:string|null}>}>(`SELECT report_activity FROM players WHERE id='${player}'`)).rows[0].report_activity;
  expect((await activity())[0]).toMatchObject({from:"2026-01",until:current});
  await db.exec(`UPDATE players SET is_active=false,report_include_removal_month=true WHERE id='${player}'`);
  expect((await activity())[0].until).toBe(current);
  await db.exec(`UPDATE players SET is_active=true WHERE id='${player}'; UPDATE players SET is_active=true WHERE id='${player}';`);
  expect(await activity()).toHaveLength(2);
  expect((await activity())[1]).toEqual({from:current,until:null});
  await db.exec(`UPDATE players SET is_active=false,report_include_removal_month=true WHERE id='${player}'`);
  const next = (await db.query<{month_key:string}>(`SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Sofia')+interval '1 month','YYYY-MM') AS month_key`)).rows[0].month_key;
  expect((await activity())[1].until).toBe(next);
  await db.exec(`UPDATE players SET is_active=true WHERE id='${player}'; UPDATE players SET is_active=false,report_include_removal_month=false WHERE id='${player}';`);
  expect((await activity()).every(period => period.until !== null && period.until <= current)).toBe(true);
  await db.exec(`INSERT INTO "_PlayerCoachGroups" VALUES ('${club}','${player}'); INSERT INTO club_custom_training_group_players VALUES ('${club}','${player}'); DELETE FROM players WHERE id='${player}';`);
  const archive = (await db.query<{report: Record<string,unknown>;coach_group_ids:string[]}>(`SELECT * FROM player_report_archives`)).rows[0];
  expect(archive.report).toMatchObject({fullName:"Дълго име на състезател",isDeleted:true,isActive:false,paymentLogs:[{amount:"30",paidFor:expect.stringContaining("2026-03-01")},{amount:"40",paidFor:expect.stringContaining("2026-04-01")}]});
  expect(archive.coach_group_ids).toEqual([club]);
  expect((await db.query(`SELECT * FROM payment_logs`)).rows).toHaveLength(0);
  expect((await db.query(`SELECT sum(amount)::text total FROM club_finance_entries WHERE voided_at IS NULL`)).rows).toEqual([{total:"70.00"}]);
  await db.exec(`DELETE FROM clubs WHERE id='${club}'`);
  expect((await db.query(`SELECT * FROM player_report_archives`)).rows).toHaveLength(0);
 } finally { await db.close(); }
}, 20000);

it("does not invent past activity for legacy inactive players and retains their paid months after restore", async () => {
 const db = new PGlite();
 try {
  await db.exec(`CREATE TABLE clubs(id uuid PRIMARY KEY,payment_workflow text); CREATE TABLE players(id uuid PRIMARY KEY,club_id uuid,full_name text,team_group int,is_active boolean,first_billing_month timestamptz,created_at timestamptz DEFAULT now());
   CREATE TABLE payment_logs(id uuid,player_id uuid,paid_for timestamptz,paid_at timestamptz,amount numeric,currency text);
   CREATE TABLE payment_waivers(player_id uuid,waived_for timestamptz); CREATE TABLE "_PlayerCoachGroups"("A" uuid,"B" uuid); CREATE TABLE club_custom_training_group_players(group_id uuid,player_id uuid);
   INSERT INTO players(id,is_active) VALUES ('00000000-0000-4000-8000-000000000002',false);
   INSERT INTO payment_logs(player_id,paid_for) VALUES ('00000000-0000-4000-8000-000000000002','2026-03-01');`);
  await db.exec(readFileSync("prisma/migrations/20261116230000_player_report_history/migration.sql", "utf8"));
  await db.exec(readFileSync("prisma/migrations/20261117010000_report_billing_start_corrections/migration.sql", "utf8"));
  expect((await db.query(`SELECT report_activity FROM players`)).rows).toEqual([{report_activity:null}]);
  await db.exec(`UPDATE players SET is_active=true`);
  const periods = (await db.query<{report_activity:unknown[]}>(`SELECT report_activity FROM players`)).rows[0].report_activity;
  expect(periods[0]).toEqual({from:"2026-03",until:"2026-04"});
  expect(periods).toHaveLength(2);
 } finally { await db.close(); }
}, 20000);
