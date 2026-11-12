# Football exercise editor

The original HTML/CSS editor remains at `/admin/training-plans/[planId]`. The separate Konva editor is at `/admin/training-plans/[planId]/konva`. Both require the club ID in the query string and enforce club access on the server. Opening the wrong editor redirects to the compatible route. Invalid content displays an error; it is never replaced by an empty drawing.

Use **Нов план — Konva** to create a version-2 exercise or **Копирай в Konva** to convert a legacy exercise into a new record. Conversion preserves the original, object IDs and ordering. Legacy CSS dimensions are approximated against a fixed 1050 × 700 board. Unsupported geometry blocks conversion with an error instead of dropping objects. The original editor and its drawing code remain available.

For equipment, players, arrows, lines and zones, **Брой обекти за поставяне** defaults to one and counts down after each successful placement or completed drawing. While one of these tools is active, you can place items or start drawings directly over existing items. Once the requested number is reached, the editor returns to selection mode with no object selected. Choose **Откажи поставянето**, tap the active tool again, or press Esc to cancel early and reset the count to one. In selection mode, click or drag existing items directly and use their handles to resize, rotate or reshape them.

Selecting an object opens a toolbar on the pitch to change its color, duplicate it, delete it, or move it one layer forward or back. For players and text objects, the pencil button edits the number or text. To select objects with the keyboard, focus the pitch and use Page Up or Page Down. Color updates as the picker moves, and one undo restores the color before that adjustment. The toolbar moves below the object when there is insufficient room above it.

Choose **Множествен избор** to select several placed objects. Tap an object again to deselect it, or choose **Избери всички** to select the whole pitch. The shared controls change the color, duplicate or delete the selection, and move it to the front or back. Each action can be undone in one step. With the pitch focused, use Page Up or Page Down to find an object and Space to add or remove it from the selection.

Choose **Текст** and tap the pitch to place one label and open its editor. The multiline field accepts up to 40 characters. Use **Разшири текстовото поле** to switch to a larger field while editing. Set **Размер на шрифта** before confirming. Resize the box to change how many lines the text occupies. The font size stays fixed, and the handles stop at sizes that would cut off the text.

Use **Добави отбор** to choose a default color and add another team to the exercise. Each team offers a coach, goalkeeper and player tool. Placed players receive the lowest available number for their team. The exercise stores added teams' default colors in order in `customTeamColors`, including teams with no figures on the pitch. Earlier exercises with `thirdTeamColor` retain that team's color and number.

Select a custom team and choose **Изтрий отбор** to remove the team and its figures. **Отмени** restores them in one step. Deleted teams reserve a slot in `customTeamColors` so the other teams keep their numbers.

The Konva football uses [“Ball” by Icuk Yulianti from Noun Project](https://thenounproject.com/icon/ball-5681732/) under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The editor serves the PNG locally and draws it over the selected ball color. The app displays the attribution at `/terms#credits`.

The six placeable Konva goals use [“Football goal” by Mark Caron from Noun Project](https://thenounproject.com/icon/football-goal-2451562/) under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The editor serves the PNG locally and tints it with each goal’s selected color. The attribution is at `/terms#credits`.

The editor uses local copies of [“Flag” by NAPISAH](https://thenounproject.com/icon/flag-6452452/) and [“Hula Hoop” by omeneko](https://thenounproject.com/icon/hula-hoop-3437627/) from Noun Project under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). They use the object color and are credited at `/terms#credits`.

In Konva, **Стена** uses the full [“Barrier” icon by Magnific from Flaticon](https://www.flaticon.com/free-icon/barrier_1540543), and **Манекен** displays a crop of one figure from the same local PNG. The attribution is at `/terms#credits`.

**Шапка** uses a local PNG of [“Sport” by ICs Icons from Flaticon](https://www.flaticon.com/free-icon/sport_17228453). The editor tints the icon with the selected object color, including for existing marker variants. The attribution is at `/terms#credits`.

**Конус**, **Стълба**, and **Препятствие** use local PNGs of [“Cone” by Smashicons](https://www.flaticon.com/free-icon/cone_1505455), [“Stairs” by Magnific](https://www.flaticon.com/free-icon/stairs_4212592), and [“Hurdle” by Rudy_wae](https://www.flaticon.com/free-icon/hurdle_11798797) from Flaticon. Each obstacle shows only the top hurdle. The credits are at `/terms#credits`.

**Изчисти игрището** removes every object and arrow while keeping the current pitch surface. **Отмени** restores the entire drawing in one step.

Use **Начин на рисуване** to draw **Бягане**, **Дрибъл**, **Пас** or **Удар** as a straight line, a curve with a handle, or a freehand stroke. Drag the yellow handle on the curve to reshape it. Existing long passes and converted freehand movements retain their saved geometry.

Selecting **Дрибъл** defaults to **Свободна ръка**. Selecting **Бягане**, **Пас** or **Удар** defaults to **Право**. The drawing mode buttons can override these defaults for the active tool.

While drawing a freehand movement, the preview shows the stroke. After release, its arrowhead points along the short, straight finish at the tip. The dribbling wave fades into the centerline under the arrowhead.

On desktop, drawing tools sit in a scrollable side panel. The pitch scales to fit the available viewport height and keeps its aspect ratio. On narrower screens, the pitch sits below the tools.

## Data and rendering

The existing `TrainingPlan.layout` JSON column stores both versions; no schema migration or bulk conversion is required. Version 2 stores `sport`, `surface` and an ordered `objects` array. Array order determines stacking. Objects carry semantic kinds (`player`, `equipment`, `movement`, `zone`, `text`), stable IDs, logical coordinates, dimensions, rotation and appearance. Players store team, role and label. Movements store action, path type and local control points. Text objects may store an explicit font size. Older text uses its saved box height to determine the original font size. This is application data, independent of Konva node serialization.

The football registry owns toolbar labels, equipment choices, surfaces and movement styles. Football is the only registered sport. Selection, transformations, history, geometry, recovery and saves are shared editor operations. Future sports can add definitions and rendering; future 3D previews can consume semantic data without interpreting canvas pixels. Neither additional sports nor 3D rendering is implemented here.

The client-only canvas scales a 1050 × 700 board uniformly. Surface, objects and transient controls normally use three layers. Active dragging/transformation temporarily moves the object to the controls layer, restoring its original stacking order afterward. During live color adjustments, the selected object renders on its own temporary layer, with surrounding objects retaining their stacking order. Drawing and color previews update at most once per animation frame. Completed gestures create one history entry; cancelled gestures restore the original object. History retains 100 entries. Exercises are limited to 200 objects and 300 persisted points per freehand path; rendering also bounds sampled dribbling geometry.

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
