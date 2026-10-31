# Manual club subscriptions

The platform admin opens **Абонаменти** from `/admin/players`. Club subscriptions are independent of player dues: `defaultPaymentAmount`, player fees, and player billing status keep their existing meaning. Subscription expiry does not restrict club access.

## Workflow

- Activate player billing through the existing club **Такси** screen. Choose a free trial (explicit end date or no end date) or a paid subscription (positive EUR monthly fee and first billable month).
- Existing active clubs receive unlimited trials during migration. Demo clubs remain ineligible. Repeat activation changes player billing settings without resetting a subscription.
- Trial end dates include the whole final day in Europe/Sofia. Expired trials do not accrue debt. Convert to paid manually and select the first billable month.
- Each billable calendar month is owed in full until paid; there is no proration. The outstanding total includes unpaid months through the current local month. Future fees are not yet outstanding.
- Select any unpaid months, including future months or months across years, and record payment date and optional note. The total is calculated from each month's applicable fee. Skipping a month leaves it outstanding; continuous paid-through coverage stops at the first gap.
- Change fees from an explicit effective month, no earlier than the month after the latest non-voided paid month (or the subscription start if nothing is paid). The default is the later of that minimum and next month. This guard also covers payments with gaps and is enforced in the form and API. A revision runs until the next existing revision. Unpaid months are recalculated; recorded payment amounts never change. The fee history shows scheduled revisions.
- Void mistaken payments from history. The record and its original amounts remain visible, and its months become payable again. Paid subscriptions cannot return to a trial in this version.

Initial activation, changes to trial duration, trial-to-paid conversion, recorded subscription payments, payment voids, and changes to an already-set fee each save a platform-admin message in the club’s **Известия за треньори** inbox, even if no devices have push enabled. Messages are stored as `myteam_message` in the main club scope and appear in the **Админ** filter; coach-group scopes do not receive them. Saving the message and changing the subscription happen in the same transaction. After commit, the app publishes the existing notification event and sends push only to active club-level device subscriptions (`coachGroupId = null`), opening `/admin/members?clubId=...`. A delivery failure is reported without losing the inbox message or subscription change. Payment messages include the recorded amount, payment date, and selected months; retrying the same payment does not duplicate the message. Repeat activation, unchanged trial/fee values, and expiry stay silent. No automatic push retries are included. Voiding a payment stores a correction message with the original payment date, amount, and reopened months. Repeating a void is silent.

## API and consistency

- `GET /api/admin/subscriptions`: all clubs, subscription configuration, fee schedule, payment history, and computed accounting summaries.
- `POST /api/admin/subscriptions/{clubId}`: `action` is `trial`, `start_paid`, `fee`, `payment`, or `void`; every mutation includes `expectedVersion`.
- `trial`: `trialEndDate` is `YYYY-MM-DD` or explicit `null`.
- `start_paid`: `firstBillingMonth` (`YYYY-MM`) and `amount` (EUR decimal string).
- `fee`: `effectiveMonth` and `amount`.
- `payment`: client UUID `paymentId`, distinct `months` (1–120), `expectedTotal`, `paidOn` (not in the future), and optional `note` (up to 1,000 characters).
- `void`: `paymentId`.

All endpoints require the platform `admin` role. Mutations lock the club row, check eligibility and version, and write audit records in the same transaction. Stale input and overlapping live payment months return 409. A matching payment UUID/content is an idempotent retry, even after that payment was voided. Money is calculated in integer cents and stored as decimals. Calendar inputs support years 2000–2199.

Activation accepts an optional `subscription` object: `{ mode: "trial", trialEndDate: null | "YYYY-MM-DD" }` or `{ mode: "paid", firstBillingMonth: "YYYY-MM", amount: "25.00" }`. Older callers omitting it get an unlimited trial on first activation. Club activation, subscription setup, and player billing updates commit atomically.

## Release and verification

Apply the additive migration `20261024120000_club_subscriptions` through the project's normal migration deployment (`npx prisma migrate deploy`), and regenerate Prisma Client before starting the updated app. Do not use `db push` instead: the migration contains a backfill and the partial unique index preventing duplicate live payment months. The implementation does not apply migrations to the configured database automatically.

Focused checks:

```sh
npm test -- src/lib/clubSubscriptionDomain.test.ts src/lib/clubSubscriptionMigration.test.ts src/lib/clubSubscriptions.test.ts
npm run typecheck
```

For an acceptance check, use an isolated database: activate a demo club with a limited trial, extend the trial, convert to paid, pay nonconsecutive months across years, verify a fee revision is rejected through the latest paid month and accepted from the following month, and void/re-record a payment. Confirm that unpaid gaps remain, paid amounts retain their snapshots, coach-only sessions are denied, and push recipients contain only the intended club's main admin devices.

## Reminder schedule and club visibility

`runClubSubscriptionReminders` checks active clubs in Europe/Sofia calendar dates. Limited trials receive reminders in the 7-day and 1-day windows and an expiry notice after the final inclusive day. A delayed run catches up only the current window. Unlimited trials are excluded; extending the end date starts a new cycle. Unpaid subscription months become overdue after their calendar month ends. Each overdue month is reminded once; newly discovered overdue months are grouped into one club message per run. Voiding a payment produces its own correction immediately and does not reset the overdue reminder ledger.

The `club_subscription_reminders` table deduplicates by club and period/stage. The job locks the same club row as subscription mutations, then rechecks current billing status, trial dates, and payments. Reminder ledger entries and the coach inbox message commit together. Push happens after commit, only for main club devices; a failed push does not remove or duplicate the saved inbox reminder. Errors for one club do not stop other clubs and return a failed job status for scheduler retry.

`GET` or `POST /api/cron/club-subscription-reminders` accepts the existing `CRON_SECRET` via Bearer authorization or `x-cron-secret`. Vercel runs this route daily at 07:00 UTC through `vercel.json`; configure `CRON_SECRET` on the deployment. Non-Vercel hosts with `LOCAL_SCHEDULER=true` check on startup and hourly. External schedulers can call the same authenticated route. Apply migration `20261024160000_club_subscription_reminders` and regenerate Prisma Client before enabling this job.

The main members page (without `coachGroupId`) shows a club-facing subscription summary: trial end date, or monthly fee, paid month snapshots, outstanding months/amount and uninterrupted coverage. It refreshes every minute while visible and on focus/tab return. Its authenticated API at `/api/admin/clubs/{id}/subscription` follows the existing shared club coach session access model and omits payment notes, audit details, and account IDs. It does not change player dues.

The platform admin's **История и такси** displays audit records for initial setup, trial changes, paid conversion, fee revisions, payments and voids, including before/after values, account ID, and Europe/Sofia timestamp. Current password-only accounts have no personal name field; shared credentials identify an account rather than a person. Audit history is available for trials as well as paid subscriptions.

### Clubs with contracts

Select **С договор** during billing activation, or use **Задай „С договор“** on an existing subscription. Contract billing is managed outside the app. The club sees **С договор**, with no subscription amounts, unpaid months, payment controls, or subscription notifications/reminders. Existing financial records remain in the administrator history. Subscription billing mutations are blocked by the API for contract clubs. Player dues and unrelated notifications are unaffected. Changing to a contract is audited and sends no club message. Returning a contract club to in-app billing is not offered.

Requires migration `20261024180000_club_subscription_contract` before using the new status.

## Finance calculator subscriptions

The calculator has separate billing at `/admin/subscriptions`. Choose monthly, yearly or one-time billing and enter a single shared EUR price for that option, then choose a billing mode per club. Other options can remain unconfigured. An individual effective-dated price overrides only that club and billing mode; a null revision restores shared pricing. The initial shared price for each billing option can begin in a past month to allow historical purchases. Later shared revisions and later individual revisions require a future month. Recorded payment amounts never change. Unused months do not accrue debt.

**Маркирай като платено** offers MyTeam or calculator billing; the calculator section also has a dedicated payment button. Monthly payments select distinct calendar months, yearly payments cover twelve consecutive months, and one-time payments grant permanent coverage from a selected month. Payment receipts, notes, period/amount snapshots, audit history and voids are separate from MyTeam. All dates use Europe/Sofia. Calculator payments use UUID idempotency keys, expected totals, subscription versions and club-row locks. A retry of a voided payment never reopens its grant.

Free calculator trials must be enabled explicitly. They begin at activation and follow the regular club trial, including unlimited trials. Trial changes update coverage atomically; an extension after expiry begins a new grant at the time of the extension, leaving the intervening gap empty. Converting the regular subscription ends trial calculator coverage. Contract clubs use a revocable **Включи по договор** grant instead of calculator payments. Disabling free access preserves elapsed coverage. Voiding a payment revokes its coverage, but never deletes existing financial entries.

APIs:

- `GET /api/admin/subscriptions/calculator-prices`: shared price history and `revision`.
- `POST` there: `expectedRevision` (null initially), `effectiveMonth`, `billingMode` (`monthly|yearly|lifetime`), and `amount` (a positive EUR decimal string). Only the selected option is changed.
- `GET /api/admin/subscriptions/{clubId}/calculator`: calculator configuration, grants, payment and audit history.
- `POST` there: `expectedVersion` (0 before first configuration), plus `action`: `configure` (`billingMode`: `monthly|yearly|lifetime`), `price` (`billingMode`, `effectiveMonth`, `amount`: decimal string or null), `grant` (`enabled`: boolean), `payment` (`paymentId`, `months`, `paidOn`, `note`, `expectedTotal`), `void` (`paymentId`), or `restore` (`paymentId`). Yearly and lifetime payments require exactly one starting month.
- `GET /api/admin/clubs/{id}/calculator-access`: authenticated club-safe access, applicable current price, mode and enabled periods. Only platform administrators and coach sessions assigned to the requested club may access calculator details. Unscoped coaches, sessions scoped to another club and coach-group requests are denied. The MyTeam subscription-summary endpoint preserves its existing access rules but omits calculator details for unscoped coaches.

Payments, cancellations, restorations and free-access changes store a coach-inbox message atomically and deliver push after commit using the existing main-club notification mechanism. Billing-mode and price changes are audited without notifying the club. Shared price revisions retain their actor/timestamp in the price history. There are no scheduled calculator reminders or online calculator checkout.

Deploy additive migration `20261031120000_calculator_subscriptions` and regenerate Prisma Client before starting the new application. Do not use `db push`: trigger changes, original-payment club snapshots and backfill functions are required. Existing clubs start locked, shared prices start unset, and all pre-release financial entries remain intact. The migration does not enable any club or backfill historical payments by itself. Coordinate schema and application deployment because the new trigger stops capture for clubs without coverage immediately.


Migration `20261031140000_independent_calculator_prices` makes shared prices independent per billing option. It preserves existing monthly/yearly/one-time schedules while allowing unconfigured options. Apply it through Prisma Migrate and regenerate Prisma Client before starting the updated app.

A calculator payment can be restored from its history after cancellation. Restore clears the void/revocation flags on the original receipt and its grants, preserves its original price, payment date and coverage, and backfills only those periods. Cancellation and restoration remain separate audit events. Restoration checks versions and rejects overlap with other active paid coverage. New purchases overlapping a cancelled receipt are directed to restoration to avoid duplicate payment records. Future billing statistics should count non-voided payment receipts, not audit events; a restored receipt counts once.
