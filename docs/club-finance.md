# Club finances

The club main page exposes a compact **Финанси** widget with the all-time balance, total outstanding fees, and a **Виж финансите** link to `/admin/clubs/:id/finance`. That dedicated page contains the full calculator. The widget and page are available to signed-in administrators for any club and coaches for their remembered club, subject to the calculator entitlement described below. Group views and player pages omit it. The API independently requires an administrator or coach session. For coaches, the requested club must match the `admin_last_club_id` browser cookie. Opening a club’s members page updates that cookie before calculator requests start. With no remembered club, open a club’s members link first. Administrators can view all clubs; calculator entitlement still controls reporting and recording. This is browser navigation scope, not a permanent account-to-club assignment.

Revenue, expenses, and the expense list default to the current Europe/Sofia calendar month. The month field supports past months; **От началото** includes all recorded entries. Balance remains all-time and outstanding fees remain current, independently of this selection. The desktop dashboard has revenue, expense and balance summary cards, transaction filters/table in the main column, and an entry-form/debt sidebar. The debt panel supplies the fourth metric on desktop. Five expenses are previewed initially, with an expansion control and existing API pagination preserved. Three-dot row controls expose editing and deletion. Mobile stacks all four metrics, opens the expense form from the prominent add button, and presents transactions as cards without horizontal scrolling. Category management opens in a modal, while the transaction and debt panels stay open; debt rows include the unpaid period or renewal reason. The finance page refreshes on filter changes or saved mutations rather than polling. Automatic player-fee revenue is limited to enabled calculator periods and cannot predate `Club.financeStartedAt`, populated at migration time for existing clubs and creation time for new clubs. Expenses may be dated manually. Summary totals and category subtotals follow the period; entry-list type/category filters only narrow the list. Each currency has separate totals. New manual entries are EUR. Outstanding player fees are current and independent of the period filter.

Outstanding dues include only active players whose saved status is `warning` or `overdue`. Players marked `paid` or `paused` (пауза) are excluded from the list, player count, total and incomplete-fee warnings, regardless of older payment gaps. Calendar billing adds unpaid, non-waived months from each eligible player's billing start. The current month is included only once the club's scheduled status-update day and time (`overdueDay`, `overdueHour`, `overdueMinute`, default 1st at 10:00 Europe/Sofia) has been reached; before that, only older months are counted. Saved `paid` and `paused` statuses remain excluded even after the scheduled time. The cutoff follows the configured schedule, not confirmation that the background job completed. Prices follow current personal/group/club fee resolution, matching the existing fee rules for new payments of old months. Non-calendar workflows count one current renewal fee for an eligible player using their saved status rather than recalculating it from payment windows or training credits. Conflicting fees produce a visible incomplete-total warning. Outstanding fees are calculated independently of the club platform billing status, including demo clubs when players have due unpaid periods.

## Storage and payment capture

Migration `20261029160000_club_finance` adds categories, entries, and the start timestamp. Category names are per club and rename in place, including the stable automatic membership-revenue category. Categories can be created for expenses or revenue. Migration `20261029190000_manual_club_revenue` permits positive manual revenue and marks the original membership category so automatic payment recording keeps using it after renaming or adding other revenue categories.

An AFTER INSERT trigger on `payment_logs` records the exact amount, currency, receipt date, club and player name in the same transaction. This covers all single and bulk payment writers, including confirmed online payments. Failed/pending checkouts do not write payment logs. A unique payment reference prevents duplicate capture. New payment logs require a known amount; old logs are not backfilled or repriced.

Explicit payment deletion while the player exists voids the matching revenue entry. Reports exclude voided entries but preserve their original snapshots. Cascading deletion of a player preserves revenue. Moving a player cannot reassign historical revenue. The finance API permits creating, editing, and deleting manual revenue and expenses. Entries linked to player payments remain protected from these mutations.

## API

`GET /api/admin/clubs/:id/finance`: `month=YYYY-MM|all`, `page` (20 entries), optional `kind=revenue|expense` and `category` UUID. Returns decimal-string currency totals, categories, category subtotals, entries, current outstanding total/player breakdown, and an incomplete flag.

`POST` at the same URL accepts `action`:
- `createExpense` / `updateExpense`: categoryId, amount, date (YYYY-MM-DD), optional description; updates require id.
- `deleteExpense`: id.
- `createRevenue` / `updateRevenue`: categoryId, amount, date, optional description; updates require id.
- `deleteRevenue`: id (manual entries only).
- `createCategory`: name and kind (`expense` or `revenue`).
- `reorderCategories`: kind and the ordered ids of all categories of that kind in this club.
- `setCategoryActive`: id and boolean isActive.
- `renameCategory`: id and name.

All mutations validate ownership. Expense dates are interpreted at Sofia midnight; amounts must be positive with at most two decimal places. Empty descriptions are null. Manual revenue uses the same validation. Automatic player-payment entries remain protected.

## Release and validation

Run `prisma migrate deploy` through the normal release process before starting the new app, then regenerate Prisma Client. A successful build does not apply migrations; apply this migration separately to every target database. Rollout should coordinate the application and schema; do not run old/new schema versions interchangeably after launch.

Vitest tests cover reporting boundaries, debt eligibility/fees, access control, expense/category validation, and isolated PostgreSQL-compatible migration/payment capture/undo/history behavior. Full browser verification and a live provider checkout require a working browser host and a migrated non-production database.

## UI verification (2026-10-29)

Compared rendered Chromium captures against `Dark-Mode Club Finance Dashboard.png` after successive styling passes. Inspected the authenticated local Next page with read-only real club data. Separate browser-only response fixtures exercised populated/empty states, report and category filters, pagination, expense creation/editing/deletion, and category creation/renaming without adding financial test records to the connected database. Desktop 1440px and mobile 390px/320px checks reported no horizontal page overflow or runtime exceptions. Captures are saved under `/tmp/finance-approved-desktop.png`, `/tmp/finance-approved-mobile.png`, and `/tmp/finance-mobile-form.png`.

The shared entry form switches with **Добави разход** / **Добави приход**, uses categories matching the entry kind, and changes its heading, save action, and red/green styling. All/expense/revenue tabs filter the transaction list independently of the entry form. Manual revenue contributes to revenue and all-time balance; it does not alter player payment status or debt.

## Category management

Categories are ordered independently per club and kind, persisted with `sort_order`. The modal supports pointer dragging, edge scrolling, arrow controls, priority numbering, renaming and creation. Dropping shows a saving indicator until the refreshed order arrives. Category filters combine kind with active/hidden status.

`is_active` defaults to true. Hiding requires confirmation and excludes the category from new manual entry options; it preserves records, reporting filters and automatic membership-payment capture. Existing entries can retain their category when edited. Eye buttons restore visibility with confirmation. Active rows are green and hidden rows red. Both dialogs support Escape and backdrop clicks, except while saving.

Recent pointer-drag, auto-scroll, visibility styling and backdrop-click refinements have automated checks but still need interactive browser verification. Earlier browser checks do not establish their final behavior.

## Calculator access and recording periods

Calculator billing is documented in `club-subscriptions.md`. Club users see a visible locked Finance card without totals when access is inactive. Direct report and analysis requests, and all writes, are independently protected. Platform admins can view historical reports while inactive; this does not enable recording or editing. The UI checks entitlement on focus, every minute, and at known coverage boundaries, and discards financial results when access is lost or cannot be checked.

The automatic payment trigger records revenue only when calculator coverage is active now **and** covers the payment receipt timestamp. Player billing and payments themselves remain available while the calculator is locked. Recording follows receipt time, not the membership months paid for. Calendar coverage uses Sofia midnight and exclusive ends, including DST changes.

Buying coverage backfills existing known-amount player payments inside the newly enabled periods, no earlier than the original finance launch timestamp. The backfill and live trigger lock the same club row; unique payment references prevent duplicate capture, including after repeated purchases or a payment correction. Payment logs snapshot the original club even while capture is off, so moving a player cannot transfer uncaptured historical revenue into the new club. Payments whose player/payment logs have been deleted cannot be reconstructed later.

An enabled January, disabled February, enabled March retains January revenue/expenses and adds March revenue; February stays empty unless it is explicitly purchased later. Trial and contract grants begin at activation rather than the month's start. Manual entries use calendar dates and require that their date intersects an enabled period. Creation and date changes into inactive periods are rejected both by the service and a database trigger. Existing historical entries can retain their dates when corrected. Voiding calculator payments keeps all previously recorded financial history; player-payment deletion continues to void its matching automatic entry.

The report lists enabled periods and explains excluded gaps. Balances also retain pre-release records and records preserved after a calculator-payment void; neither subscription expiry nor reactivation deletes or resets the ledger.

## Concurrent payment undo and backfill

Apply `20261101003000_finance_backfill_payment_lock` through Prisma Migrate. Backfill holds a key-share lock on each source payment until its transaction commits. If undo deletes first, backfill waits and skips the deleted payment. If backfill locks first, undo waits and then voids the captured revenue. This also applies after a player moves clubs because capture uses the payment’s original club snapshot. Cascading player deletion continues to preserve captured revenue; deleted source payments cannot be recovered by later purchases.

Run `FINANCE_TEST_DATABASE_URL='<disposable PostgreSQL connection URL>' npm run test:finance-concurrency` with `psql` available. The script creates and removes an isolated schema and exercises both transaction orderings for purchase/restoration, with and without player movement, plus cascading player deletion. It does not read the application's `DATABASE_URL`.
