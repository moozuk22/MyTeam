import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

// Use a disposable PostgreSQL database, never the application's DATABASE_URL.
const database = process.env.FINANCE_TEST_DATABASE_URL;
assert.ok(database, 'Set FINANCE_TEST_DATABASE_URL to a disposable PostgreSQL database. Requires psql.');
const schema = `finance_race_${randomUUID().replaceAll('-', '')}`;
const env = { ...process.env, PGDATABASE: database, PGOPTIONS: `-c search_path=${schema},public -c statement_timeout=15000` };
function sql(query) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', ['-X', '-qAt', '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', query], { env });
    let output = '', error = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { error += data; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
  });
}
function session(name) {
  const child = spawn('psql', ['-X', '-qAt', '-d', database, '-v', 'ON_ERROR_STOP=1'], { env: { ...env, PGAPPNAME: name } });
  let output = '', error = '', pending;
  child.stdout.on('data', data => {
    output += data;
    if (pending && output.includes(pending.marker)) {
      const { resolve, marker } = pending;
      pending = undefined;
      const result = output.slice(0, output.indexOf(marker)).trim();
      output = '';
      resolve(result);
    }
  });
  child.stderr.on('data', data => { error += data; });
  child.on('error', e => pending?.reject(e));
  child.on('exit', code => pending?.reject(new Error(error || `psql exited: ${code}`)));
  return {
    run(query) {
      assert.ok(!pending, 'Wait for the previous session command.');
      return new Promise((resolve, reject) => {
        const marker = `done_${randomUUID()}`;
        pending = { resolve, reject, marker };
        child.stdin.write(`${query}\n\\echo ${marker}\n`);
      });
    },
    close() { child.kill(); },
  };
}
async function waitUntilBlockedOrDone(name, isDone) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (isDone()) return false;
    const blocked = await sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event_type='Lock'`);
    if (blocked === '1') return true;
    await delay(10);
  }
  throw new Error(`Timed out waiting for ${name}`);
}
const club = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const player = '00000000-0000-0000-0000-000000000003';
const payment = '00000000-0000-0000-0000-000000000004';
const purchase = '00000000-0000-0000-0000-000000000005';
const undoSQL = `DELETE FROM payment_logs WHERE id='${payment}';
 UPDATE players SET status=CASE WHEN EXISTS(SELECT 1 FROM payment_logs WHERE player_id='${player}') THEN 'paid' ELSE 'overdue' END WHERE id='${player}';`;

try {
  await sql(`CREATE SCHEMA ${schema};
    CREATE TABLE clubs(id uuid PRIMARY KEY);
    CREATE TABLE players(id uuid PRIMARY KEY, club_id uuid REFERENCES clubs(id) ON DELETE CASCADE, full_name text, status text);
    CREATE TABLE payment_logs(id uuid PRIMARY KEY, player_id uuid REFERENCES players(id) ON DELETE CASCADE,
      paid_at timestamptz DEFAULT CURRENT_TIMESTAMP, amount numeric, currency text DEFAULT 'EUR');
    CREATE TABLE club_subscriptions(club_id uuid PRIMARY KEY, mode text, trial_end_date text);`);
  // Apply the complete finance/calculator migration sequence.
  for (const migration of [
    '20261029160000_club_finance',
    '20261029190000_manual_club_revenue',
    '20261029210000_finance_category_order',
    '20261029223000_finance_category_active',
    '20261030010000_shared_finance_categories',
    '20261030120000_finance_category_color',
    '20261030130000_default_finance_category_colors',
    '20261030140000_correct_finance_palette_backfill',
    '20261031120000_calculator_subscriptions',
    '20261031140000_independent_calculator_prices',
    '20261101003000_finance_backfill_payment_lock',
  ]) {
    await sql(readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
  }
  for (const restoring of [false, true]) for (const moved of [false, true]) for (const undoFirst of [true, false]) {
    await sql(`TRUNCATE clubs CASCADE;
      INSERT INTO clubs(id) VALUES('${club}'),('${other}');
      UPDATE clubs SET finance_started_at='2020-01-01';
      INSERT INTO players VALUES('${player}','${club}','Player','paid');
      INSERT INTO payment_logs(id,player_id,paid_at,amount) VALUES('${payment}','${player}','2026-01-10 Europe/Sofia',10);
      ${moved ? `UPDATE players SET club_id='${other}' WHERE id='${player}';` : ''}
      INSERT INTO club_calculator_subscriptions(club_id) VALUES('${club}');
      INSERT INTO club_calculator_payments(id,club_id,billing_mode,paid_on,total,request,created_by,voided_at)
        VALUES('${purchase}','${club}','monthly','2026-01-10',10,'{}','admin',${restoring ? 'clock_timestamp()' : 'NULL'});
      INSERT INTO club_calculator_grants(club_id,kind,starts_at,ends_at,payment_id,revoked_at)
        VALUES('${club}','paid','2026-01-01 Europe/Sofia','2026-02-01 Europe/Sofia','${purchase}',${restoring ? 'clock_timestamp()' : 'NULL'});`);
    const undoName = `${schema}_undo`, fillName = `${schema}_fill`;
    const undo = session(undoName), fill = session(fillName);
    const backfillSQL = `${restoring ? `UPDATE club_calculator_payments SET voided_at=NULL WHERE id='${purchase}'; UPDATE club_calculator_grants SET revoked_at=NULL WHERE payment_id='${purchase}';` : ''}
      SELECT backfill_calculator_revenue('${club}','${purchase}');`;
    try {
      if (undoFirst) {
        await undo.run(`BEGIN; ${undoSQL}`);
        let done = false;
        const filling = fill.run(`BEGIN; ${backfillSQL} COMMIT;`).finally(() => { done = true; });
        // The old function completes here, inserting revenue from the uncommitted deletion.
        await waitUntilBlockedOrDone(fillName, () => done);
        await undo.run('COMMIT;');
        await filling;
      } else {
        await fill.run(`BEGIN; ${backfillSQL}`);
        let done = false;
        const deleting = undo.run(`BEGIN; ${undoSQL}`).finally(() => { done = true; });
        const blocked = await waitUntilBlockedOrDone(undoName, () => done);
        await fill.run('COMMIT;');
        await deleting;
        await undo.run('COMMIT;');
        assert.ok(blocked, 'Undo must wait for the backfill payment-row lock.');
      }
      const context = `${restoring ? 'restore' : 'purchase'}, moved=${moved}, undoFirst=${undoFirst}`;
      assert.equal(await sql(`SELECT count(*) FROM payment_logs WHERE id='${payment}'`), '0', context);
      assert.equal(await sql(`SELECT status FROM players WHERE id='${player}'`), 'overdue', context);
      assert.equal(await sql(`SELECT count(*) FROM club_finance_entries WHERE payment_reference='${payment}' AND voided_at IS NULL`), '0', `Deleted payment must not contribute active revenue: ${context}`);
      console.log(`Passed: ${context}`);
    } finally { undo.close(); fill.close(); }
  }
  // Cascading player deletion still preserves already-recorded revenue.
  await sql(`DELETE FROM players; DELETE FROM club_finance_entries;
    INSERT INTO players VALUES('${player}','${club}','Player','paid');
    INSERT INTO payment_logs(id,player_id,paid_at,amount) VALUES('${payment}','${player}','2026-01-10 Europe/Sofia',10);
    SELECT backfill_calculator_revenue('${club}','${purchase}');
    DELETE FROM players WHERE id='${player}';`);
  assert.equal(await sql(`SELECT count(*) FROM club_finance_entries WHERE payment_reference='${payment}' AND voided_at IS NULL`), '1');
  console.log('Passed: cascading player deletion preserves captured revenue.');
} finally {
  await sql(`DROP SCHEMA IF EXISTS ${schema} CASCADE;`);
}
