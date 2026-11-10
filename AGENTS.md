# Repository Guidelines

## Project Structure & Module Organization
MyTeam is a Bulgarian-language sports club management app built with Next.js 16 App Router, React 19, TypeScript, Prisma, and PostgreSQL.
- `src/app/`: pages, layouts, and API route handlers; admin features under `admin/`, public member pages under `member/[cardCode]/`.
- `src/components/`: shared UI; `src/lib/`: business logic, authentication, integrations, and database access.
- `prisma/schema.prisma` and `prisma/migrations/`: database schema and versioned migrations.
- `public/`: static images, PWA icons, and service worker.
- `scripts/`: imports, maintenance utilities, and database verification scripts. `docs/`: feature documentation.
- Tests are colocated with source files and scripts.

## Build, Test, and Development Commands
- `npm ci`: install dependencies from the lockfile.
- `npm run dev`: generate Prisma Client and start local development.
- `npm run build`: generate Prisma Client and build for production.
- `npm start`: serve the production build.
- `npm run lint`: run ESLint with Next.js and TypeScript rules.
- `npm run typecheck`: check TypeScript without emitting files.
- `npm test`: run the Vitest suite; target a file with `npm test -- src/lib/irispay.test.ts`.
- `npx prisma migrate dev`: create/apply migrations against a development database.

## Coding Style & Naming Conventions
Use strict TypeScript and `@/` imports for modules under `src/`. Match surrounding indentation (existing files use two or four spaces), double quotes, and semicolons. Use PascalCase component filenames, camelCase functions, and Next.js filenames such as `page.tsx` and `route.ts`. Keep user-facing text in Bulgarian. Import the shared Prisma client from `@/lib/db`.

## Understand Before Changing
Inspect the complete affected workflow before editing: trace UI components, API routes, business logic, Prisma models, and tests. Identify dependencies and side effects, especially for payments, memberships, player management, and notifications. Reuse existing abstractions and conventions. Preserve unrelated behavior and avoid unnecessary refactoring.

## Performance & Database Efficiency
Avoid N+1 queries, excessive database calls, and unbounded parallel operations. Paginate or bound queries for potentially large datasets. Keep transactions short and avoid external network calls inside them where possible without weakening atomicity. Minimize unnecessary polling and client requests. Account for Prisma connection-pool capacity and background-job concurrency (see Background Jobs).

## API Compatibility
Inspect all relevant callers before modifying an endpoint. Preserve request/response contracts unless breaking changes are explicitly required; update affected clients and contract tests together when contracts change.

## UI/UX & Responsive Design
These requirements apply to every frontend change:

- **Preserve the design system:** inspect existing pages and shared components first. Reuse established components, colors, typography, spacing, border radii, and styling patterns across admin/member pages, dashboards, forms, and modals. Do not introduce a new design language or significantly change layouts without an explicit request.
- **Develop mobile first:** over 80% of users access MyTeam on phones. Build for mobile, then adapt to tablet and desktop; never sacrifice mobile usability for desktop. Avoid fixed widths, unnecessary horizontal scrolling, and large-screen dependencies. Make buttons, inputs, menus, tables, and dialogs usable on touchscreens.
- **Accessibility and usability:** preserve keyboard access, visible focus, semantic controls, readable contrast, and accessible labels. Provide clear loading, empty, success, and error states; apply the existing mobile and touch requirements when testing interactions.
- **Minimum checks for every UI change:** verify the affected interface at at least one small-phone width of 320–375 px, one large-phone width of 390–430 px, and a desktop width of 1440 px (CSS pixels). Mobile compatibility is mandatory regardless of change size.
- **Significant layout changes:** test the complete viewport matrix below for new pages, redesigned layouts, dashboards, complex forms, and major component changes. Pay special attention to 320–375 px widths:

  | Viewport | Device class |
  | --- | --- |
  | 320 × 568 | Very small phone |
  | 360 × 800 | Small Android phone |
  | 375 × 667 | Small iPhone |
  | 390 × 844 | Typical modern phone |
  | 430 × 932 | Large phone |
  | 768 × 1024 | Tablet |
  | 1440 × 900 | Desktop |

- **High-risk components:** changes involving modals, dropdowns, navigation, tables, or sticky/fixed elements also require the complete matrix and relevant interaction checks, even when the diff is small.
- **Prevent regressions:** check horizontal overflow, clipping, overlaps, and broken layouts, including modals, dropdowns, navigation, tables, forms, and fixed/sticky elements. Exercise long names, Bulgarian text, validation messages, and empty/loading/error states. Keep controls accessible with the mobile keyboard open, respect safe areas, provide appropriate touch targets, and preserve important functionality on mobile and desktop.
- **Verify behavior in a browser:** use viewport testing when available and exercise relevant interactions, not only screenshots or code inspection. Include screenshots for significant UI changes when practical. Report viewports/interactions actually tested; if browser testing is unavailable, explicitly state that visual/responsive verification was not performed. Never claim untested responsive behavior is verified.

A frontend task is not fully verified until its affected UI passes the mandatory small-phone, large-phone, and desktop checks, plus the complete matrix for significant layout or high-risk component changes. Report any missing checks as unverified.

### Loading States
Use the club calculator's loading experience as the design reference for new features. Inspect `src/app/admin/members/_components/FinanceSkeleton.tsx`, `FinanceSkeleton.module.css`, and their usage in `FinanceDashboard.tsx`, `FinanceAnalysis.tsx`, and `FinancePlayerSkeleton.tsx` before implementing loaders.

- **Match the content:** use skeleton placeholders shaped like the pending content: lines for text, larger lines for totals, circles for avatars, a ring for a chart, and rows, chips, or fields for lists and forms. Reuse `FinanceSkeleton`, `FinanceMetricSkeleton`, and `SkeletonLine` where appropriate; for other layouts, follow their styling without importing the calculator's business logic.
- **Keep the page structure visible:** preserve headings, cards, filters, and surrounding content; place skeletons only inside sections awaiting data. Load independent sections independently. For lazy-loaded components, use the same skeleton for the `Suspense` fallback and subsequent data fetch so the loading appearance stays consistent. Loading dialogs should retain their dialog shell and usable close control, as in `FinancePlayerSkeleton`.
- **Keep the visual style subtle:** follow the existing muted translucent green background, faint border, rounded shapes, and soft left-to-right shimmer (`1.8s ease-in-out infinite`). Match placeholder dimensions and spacing to the final content to minimize layout shifts. Adapt skeleton layouts for phones and contain wide table placeholders within their section. Disable shimmer under `prefers-reduced-motion: reduce`.
- **Show placeholders rather than invented content:** do not display fake amounts, zero totals, sample records, a generic spinner, or visible “Зареждане…” text in place of pending content. Keep loading distinct from a genuine empty result, a locked feature, and an error. Replace failed loading with a Bulgarian error and a retry action where appropriate.
- **Expose loading accessibly:** mark the skeleton container with `role="status"`, `aria-label="Зареждане"`, and `aria-busy="true"`; hide decorative placeholder shapes with `aria-hidden="true"`. Clear the busy state when loading completes.
- **Separate fetching from saving:** on filter or page changes, show the affected section's skeleton while its new data is pending; prevent obsolete responses from replacing current results (follow the calculator's `AbortController` cleanup). For saves, keep the form/content visible, disable duplicate or conflicting actions, and use Bulgarian action feedback such as “Записване…” or “Запазване на подредбата…”. Restore controls after success or failure and surface errors clearly.

## Testing Guidelines
Vitest runs in a Node environment configured in `vite.config.mts`; tests use `*.test.ts`, `*.test.tsx`, and `*.test.mjs`. No coverage threshold is configured. For bug fixes, first add a regression test demonstrating the failure. Run affected tests, lint, and type checking; report results and unverified behavior.

For stateful features, trace creation, updates, deletion, reversal, recreation, retries, and concurrent operations where relevant. Verify downstream effects and add regression tests for affected behavior, including the feature-specific safeguards below.

## Commit & Pull Request Guidelines
Read `PR_REVIEW.md` before creating or updating pull requests, including handling review feedback.

At the start of a new development task, inspect the working tree and current branch. Preserve all uncommitted work; never discard, reset, or overwrite user changes. Continue on an existing feature branch when appropriate. When creating a new task branch, first safely update local `master` from `origin/master` with a fast-forward pull, then branch from the updated `master`. If local changes or divergence prevent a safe operation, report the issue rather than forcing it.

For review corrections, stay on the existing PR branch; do not unnecessarily switch to `master` or create another branch. Do not automatically merge `master` into an existing feature branch. Make changes on or push directly to `master` only when explicitly requested.

Write concise, imperative commit subjects describing the change, such as `Add image attachments to notifications` or `Fix attendance dashboard scope`. Follow the existing unprefixed style rather than adding Conventional Commit prefixes. Merge commits follow `Merge pull request #N from owner/branch`. Use descriptive kebab-case branch names, optionally under `feat/` or `fix/`. Never include `codex` in new branch names; examples: `configuration`, `fix/subscription-edit`.

Keep commits focused and review the final diff before committing. PRs should explain behavior changes, link relevant issues, list verification, and include screenshots for UI changes. Flag migrations and configuration changes.

## Configuration & Framework Notes
Keep credentials in untracked environment files. Before changing Next.js code, read relevant installed guides under `node_modules/next/dist/docs/` when available; heed deprecations and version-specific APIs.

## Production Deployment
Production runs on an Ubuntu VPS with Node.js 22 and PM2 process `my-team`, from `/var/www/MyTeam`. Nginx configuration `/etc/nginx/sites-enabled/my-team` routes `myteam7.com` and `www.myteam7.com` to `127.0.0.1:3000`, with Certbot-managed HTTPS and a 100 MB request-body limit.

PM2 runs `npm start` in fork mode with file watching disabled. Inspect it with `pm2 describe my-team` and read recent logs with `pm2 logs my-team --lines 100 --nostream`. Log files are `/root/.pm2/logs/my-team-out.log` and `/root/.pm2/logs/my-team-error.log`.

`.github/workflows/deploy.yml` deploys `master` through `/root/deploy-my-team.sh`. The script loads `.env`, resets the server checkout to `origin/master`, installs dependencies, generates Prisma Client, applies migrations using `DIRECT_URL`, builds, and restarts/saves PM2. Keep production migrations compatible with this sequence. Other apps share the VPS; target only `my-team` when managing its process.

## Database and Media Environments

### PostgreSQL
- Development uses Neon-hosted PostgreSQL; production uses PostgreSQL hosted locally on the Ubuntu VPS. These databases are separate.
- Verify the resolved database host and database name before migrations or data-changing scripts, including any `DATABASE_URL`/`DIRECT_URL` override; do not expose credentials when checking.
- Use Prisma for database access and migrations. Production migrations are applied by the deployment workflow using `DIRECT_URL`.
- Never run destructive database operations, resets, or seed scripts against production without explicit authorization.
- Validate schema changes and migrations against development before deployment.

### Cloudinary
MyTeam uses Cloudinary for image uploads, transformations, and deletion. The SDK is configured in `src/lib/cloudinary.ts` using `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.

**Development and production currently share Cloudinary cloud `dhph2rney`.** Media is a shared external resource even though the databases are separate.

- Never delete, overwrite, or bulk-modify assets without understanding their references and obtaining appropriate authorization.
- Never assume development assets are isolated from production; avoid destructive testing against shared resources.
- Prefer mocked Cloudinary operations in automated tests.
- Inspect existing asset cleanup and image replacement logic before modifying it.
- Do not hardcode or log API credentials.

## Authentication and Club Isolation
`src/lib/adminAuth.ts` provides HS256 JWT creation/verification and scrypt password hashing/checking. Admin sessions use the `admin_session` cookie with `admin`/`coach` roles and optional `defaultClubId`; `src/middleware.ts` gates admin routes. Member APIs resolve active cards by `cardCode` rather than admin sessions.

Enforce authorization in server handlers, not only middleware or UI. Validate requested club access and scope related player, group, payment, and category lookups/writes to that club. Preserve feature-specific checks: `canReadClubCalculator` in `clubCalculatorAccess.ts`, `calculatorAccess` in `calculatorSubscriptions.ts`, and `authorizeFacebookClub` in `facebook/authorization.ts`. Do not mistake a client-supplied club ID or remembered-club cookie for a universal ownership check. Test cross-club rejection when changing access paths.

## Financial and Payment Integrity
- `irispay.ts` implements provider requests; `irispayFinalize.ts` verifies provider status (`WAITING`, `FAILED`, `CONFIRMED`) rather than trusting webhook claims. The webhook checks its configured secret. Preserve saved payment quotes and reusable-link deactivation behavior.
- Confirmation claims an unlinked `IrisPayment` inside a serializable transaction, finalizes through `memberPayment.ts`, and links its `PaymentLog`. Already-finalized calls must not duplicate settlement or payment notifications. Keep exact Decimal allocation across quoted periods and workflow-specific membership/credit checks.
- Preserve `clubFinance.ts` payment references and club scoping. Subscription payments use client-generated idempotency IDs; live club/month allocations have a partial unique index. `clubSubscriptions.ts` and `calculatorSubscriptions.ts` use club row locks and version checks. Keep payment records, allocations/grants, void/reversal state, totals, credits, and audit changes consistent within their transaction boundaries.
- Require regression tests for sensitive changes, including duplicate callbacks/requests, concurrent writes, and reversal/recreation paths where affected. Inspect schema constraints and migration SQL, not just Prisma types.

### IRISPay API Documentation
Before modifying IRISPay functionality, read the relevant sections of `docs/integrations/irispay/PayByLink_QR_v.3.5.7.sanitized.md` alongside `src/lib/irispay.ts`, `src/lib/irispayFinalize.ts`, and related payment modules. Verify endpoints, request/response formats, statuses, and error handling against the reference. Preserve transaction safety, idempotency, payment verification, and financial-integrity safeguards. Never initiate real payments or use production credentials in automated tests; mock provider interactions. Report documentation/implementation discrepancies rather than silently changing payment behavior.

## External Integrations
Reuse `uploadImage.ts`, `uploadMessageImage.ts`, and `cloudinaryImagePath.ts` for upload/URL behavior. Web Push uses `push/service.ts`, `push/adminService.ts`, and VAPID configuration; Facebook connection/publishing helpers live in `facebook/`; `googleAuth.ts` obtains service-account tokens for read-only Drive/Sheets access. Mock external integrations in automated tests; do not send real payments, pushes, posts, or media mutations as test side effects.

## Background Jobs
Production uses Linux cron on the Ubuntu VPS to invoke Next.js job API routes through HTTP requests authenticated with `CRON_SECRET`. Current invocation schedules use the VPS timezone:

| Job | Frequency |
| --- | --- |
| Monthly membership payment reminders | Every 5 minutes |
| Monthly overdue payment reminders | Every 5 minutes |
| Daily birthday notifications | Daily at 06:00 |
| Club subscription reminders | Every hour |
| Daily coach birthday checks | Every hour |
| Weekly coach birthday checks | Every hour |
| PostgreSQL backups (VPS cron task) | Every hour |

Invocation does not imply processing: preserve each job's business eligibility checks and `Europe/Sofia` business-timezone behavior, independently of the cron timezone.

There is no in-process scheduler. Development and other deployments need an external scheduler calling the authenticated routes when automatic jobs are required; automated tests invoke job functions with mocked dependencies. Do not introduce a second scheduling mechanism without evaluating duplicate-execution risks and obtaining authorization.

Preserve job idempotency, database locking, and persisted deduplication: overdue rollover uses monthly `CronJobRun` claims with completion/failure and stale-lock handling; subscription reminders lock club rows and save reminder keys before push delivery; birthday notifications use deterministic IDs. Inspect notification-history guards, retries, and failure handling before changing jobs. Test repeat and concurrent invocation where affected. Never manually execute production jobs, change VPS cron schedules, or enable alternative schedulers without explicit authorization.

Cron jobs can overlap; consider Prisma connection-pool capacity and transaction duration when changing database activity. Intermittent reminder-job `P2024` timeouts were observed, but their cause is unconfirmed; concurrent cron execution is not an established root cause.

## Error Handling and Security
Use existing validators and domain errors (for example `FinanceError`, `SubscriptionError`, and `memberPaymentErrorResponse`) with JSON `{ error }` responses and appropriate status codes. Keep Bulgarian user-facing errors and safe diagnostic context. Never expose secrets, session/card tokens, provider payloads, or sensitive personal/payment data in logs or responses. Validate user-controlled IDs, amounts, dates, payloads, and file inputs server-side. Preserve `hasTrustedOrigin` checks from `requestOrigin.ts`, role/access checks, and webhook/cron secrets; do not weaken them for convenience.

## Definition of Done
Verify requirements and acceptance criteria, add meaningful regression coverage, and run relevant tests, lint, and type checking; build when appropriate. Inspect the final diff for correctness, unrelated changes, and secrets. Report exactly which checks passed, failed, or were not run, plus unverified behavior. Follow `PR_REVIEW.md` for PR creation and the manual review cycle.

## Documentation Maintenance
Update existing documentation when architecture, business behavior, configuration, deployment, or integrations change. Avoid unnecessary documentation files; keep `AGENTS.md` concise and focused on actionable instructions for coding agents.

## Production Boundaries
Without explicit authorization, do not manually deploy, restart production services, change production environment variables, alter VPS infrastructure, or directly modify production data. Documenting operational commands does not authorize executing them.
