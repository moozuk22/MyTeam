# Football exercise editor

The original HTML/CSS editor remains at `/admin/training-plans/[planId]`. The separate Konva editor is at `/admin/training-plans/[planId]/konva`. Both require the club ID in the query string and enforce club access on the server. Opening the wrong editor redirects to the compatible route. Invalid content displays an error; it is never replaced by an empty drawing.

Use **Нов план — Konva** to create a version-2 exercise or **Копирай в Konva** to convert a legacy exercise into a new record. Conversion preserves the original, object IDs and ordering. Legacy CSS dimensions are approximated against a fixed 1050 × 700 board. Unsupported geometry blocks conversion with an error instead of dropping objects. The original editor and its drawing code remain available.

Existing objects and arrows can be selected and dragged directly, even while a placement/drawing tool is active. Tapping empty pitch continues using that active tool. The explicit Select tool remains available for manipulating objects without placing new ones. Resize/rotation and path handles work without changing tools.

## Data and rendering

The existing `TrainingPlan.layout` JSON column stores both versions; no schema migration or bulk conversion is required. Version 2 stores `sport`, `surface` and an ordered `objects` array. Array order determines stacking. Objects carry semantic kinds (`player`, `equipment`, `movement`, `zone`, `text`), stable IDs, logical coordinates, dimensions, rotation and appearance. Players store team, role and label. Movements store action, path type and local control points. This is application data, independent of Konva node serialization.

The football registry owns toolbar labels, equipment choices, surfaces and movement styles. Football is the only registered sport. Selection, transformations, history, geometry, recovery and saves are shared editor operations. Future sports can add definitions and rendering; future 3D previews can consume semantic data without interpreting canvas pixels. Neither additional sports nor 3D rendering is implemented here.

The client-only canvas scales a 1050 × 700 board uniformly. Surface, objects and transient controls use three layers. Active dragging/transformation temporarily moves the object to the controls layer, restoring its original stacking order afterward. Drawing previews update at most once per animation frame. Completed gestures create one history entry; cancelled gestures restore the original object. History retains 100 entries. Exercises are limited to 200 objects and 300 persisted points per freehand path; rendering also bounds sampled dribbling geometry.

## Saving and recovery

The existing club training-plan endpoints accept both layout versions. Creation additionally accepts `editorVersion: 2`, or `sourcePlanId` with `editorVersion: 2` for a server-side converted copy. Summaries include `layoutVersion`. Listing uses 50-record cursor pages (`cursor`, `nextCursor`) and extracts only the JSON version in PostgreSQL rather than fetching full drawings.

Every version-2 PUT, including metadata edits, requires `expectedUpdatedAt` from the last loaded/saved record. An atomic conditional update inside a short transaction returns HTTP 409 if that revision is stale. Existing version-1 save requests remain compatible. A plan cannot change format through PUT.

The editor keeps editing enabled while a save is pending. Only the submitted snapshot becomes saved; later edits remain dirty. Conflicts preserve current work and offer reloading the server drawing or saving a new copy. Saving a copy keeps the current editor open and provides a link to the copy.

Recovery drafts are debounced in browser storage and scoped by user, club and exercise, with their base revision stored in the draft. Reopening offers restore/discard. Stale drafts require saving a copy or reloading the server. Storage failure does not block editing or explicit saves. Matching saved drafts are cleared after successful saves; leaving with unsaved work displays a warning.

Pages and all affected endpoints follow the existing admin/coach club policy: scoped coaches stay within their default club; admins and unscoped sessions retain their existing club-wide access. Mutations check trusted origin. In development, a matching request origin is also accepted when `APP_BASE_URL` points to production; production continues to require the configured public origin. Server-side validation rejects malformed layouts, duplicate IDs, unsupported object data, non-finite values and degenerate geometry.

## Verification boundaries

Automated model/history/conversion tests, API authorization/concurrency contract tests, and in-memory PostgreSQL pagination tests are colocated under `src/lib/exercise`. API contract tests mock authentication and Prisma writes. A separate development-database check used Prisma to create a temporary source/copy, verify JSON round-tripping and stale-revision rejection, then roll back the entire transaction. No temporary records were committed.

Browser checks use actual editor/list components in a temporary local preview with mocked save endpoints. They cover the seven repository viewport sizes, touch placement/resizing/curve handles, keyboard controls, modal behavior, cancellation, recovery, storage/offline failures and edits during saves. Reduced-height viewport checks approximate keyboard space; a real mobile keyboard and lower-powered physical phone still require manual testing.

The legacy editor remains available. Making Konva the default, deleting the old editor, image export, grouping, fullscreen, animation and 3D are separate follow-up work.

### Results (10 November 2026)

- 28 targeted tests passed (model/conversion/history, API contracts, PostgreSQL summaries/pagination and existing legacy geometry).
- Production build (`npm run build`), type checking and ESLint for affected files passed. Repository-wide ESLint reports three pre-existing `no-require-imports` errors in `scripts/generate-pwa-icons.cjs`, plus existing warnings.
- Actual component browser checks passed at 320×568, 360×800, 375×667, 390×844, 430×932, 768×1024 and 1440×900. Both editor and list dialogs were checked for horizontal overflow and interactions. Additional CDP touch checks covered resize/curve handles at 320, 430 and 1440 pixels; cancellation, offline/storage failure, drafts, stale saves and edits during saving also passed.
- Chromium stress measurements used a 390×844 viewport on this desktop, with 30 or 200 objects (all but one were 300-point paths). Median frame gaps were approximately 16.7 ms in both cases. At 200 objects, moving the active object to its own layer reduced observed long tasks from 45 to 4; remaining gesture-boundary stalls reached approximately 100 ms. These are development-preview measurements, not a physical-phone performance certification.
- A live browser → Next.js → database save flow, a real mobile keyboard, physical lower-powered phones and the full unrelated test suite were not tested. Legacy removal/default switching remains separate work.

Direct manipulation was additionally checked at all seven viewport sizes: mouse dragging of existing equipment and arrows with placement tools active, touch dragging with the running tool active, and subsequent placement on empty pitch. Resize/curve handles and cancelled drags were also rechecked without first using Select at 320, 430 and 1440 pixels. Affected-file ESLint and type checking passed; the production build was not repeated for this interaction-only change.
