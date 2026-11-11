# Training scope audit

`scripts/report-training-scope.mjs` lists existing training-session records created
in a timestamp range. It helps investigate the regression introduced by
`3be02e87` (merged in `c733a92a`) that sent new trainings to the coach-group
editor even when a custom/training group was selected.

Use the actual successful production deployment time as the starting timestamp,
not the commit time. Use the deployment of the routing fix as `--until` once it
is known. Both timestamps require seconds and an explicit timezone. The interval
includes `--since` and excludes `--until`; without `--until`, the script captures
the audit start time as a fixed upper bound.

## Run

The script uses `DATABASE_URL` from the process environment or `.env` in the
current directory. Existing environment variables take precedence. It prints the
resolved database hostname and database name to stderr without credentials.
Verify this target before interpreting the report. Production uses the VPS
database; a report run against local development's Neon database does not audit
production.

From the repository root, replace the timestamp placeholder with the actual
deployment timestamp (for example, ISO format `2026-11-07T21:35:00+02:00`; this
example is **not** a verified deployment time):

```bash
umask 077
node scripts/report-training-scope.mjs --since '<deployment-timestamp>' > training-scope-report.txt
```

Optional arguments:

- `--until '<fix-deployment-timestamp>'` bounds the creation interval.
- `--club-id '<club-uuid>'` limits the report to one club; otherwise all clubs
  are included.
- `--format json` exports the full audit details as JSON instead of the default
  readable text.
- `--help` prints usage without connecting to a database.

Keep exported reports outside version control. No automatic execution is added
to deployments or cron. Running this documentation's commands against production
requires authorization for that operational task.

## Interpretation and limitations

The default text report groups trainings under club name and coach-group name,
then lists each training’s date, time, cancellation status and ID. Custom-group
trainings show their own group name beneath the associated coach group. Sessions
without a coach-group association appear under “Без треньорска група”. The report
does not infer a missing custom-group assignment.

With `--format json`, every matching session is listed, including cancelled sessions, with its ID,
club, creation/update timestamps, training date/time, persisted group scope/name,
roster count, recorded-attendance count, credit-charge count, absence/reason count,
roster-lock flag, note-presence flag, recurrence ID, and matching reservation
events/counts. Date-level reservation events may cover several same-day sessions.

`coachGroupReviewCandidate` marks coach-group sessions for investigation. Some
are legitimate; the flag does not establish that a training was created through
the buggy editor. The selected custom group was not persisted by that editor,
so this report cannot reconstruct the intended assignment or authorize deletion.
Activity counts are review aids, not a complete financial/history audit.

The audit queries `createdAt`, not the scheduled training date. Sessions generated
automatically or imported during the interval are also included. Deleted records
are absent. Current group names and activity may differ from their creation-time
values. Queries are batched in pages of 200; each page has a separate repeatable
read snapshot and PostgreSQL-enforced read-only transaction.

The script performs no updates, deletions, provider calls, or notifications. It
omits player identities, card/session tokens, note contents, and credentials.
It does not move sessions, recreate rosters, or repair production data.
