# Football exercise editor

Konva is the training plan editor at `/admin/training-plans/[planId]/konva`. Selecting a plan card opens a read-only review at `/admin/training-plans/[planId]` with its saved pitch, category, description, and last update. **Редактирай** opens the editor from either the card or the review. Opening a plan requires the club ID in the query string and server-side club access. Invalid drawings display an error.

**Ново упражнение** opens a blank drawing editor. Enter a name in the editor and choose **Запази** to create the plan and its drawing together. Plans from the original HTML/CSS editor remain in the list with **Копирай в новия редактор** to create an editable copy. Conversion preserves the original, object IDs and ordering. Legacy CSS dimensions are approximated against a fixed 1050 × 700 board. Unsupported geometry blocks conversion with an error.

Use **Търсене по заглавие** above the library filters to find exercises by title. The search ignores letter case and applies together with the author, category, coach, and sort filters. The list updates 300 ms after you stop typing. The `q` URL parameter keeps the search text, so a reload or a shared link shows the same results.

Open the sidebar’s **Детайли** tab to edit **Име на плана**, **Категория**, **Описание** and **Изисквания**, then choose **Запази**. **Изисквания** holds up to 700 characters. The review page shows it below the description. A copy of an exercise keeps its requirements. New plans open on **Детайли** and saved plans open on **Инструменти**. Local draft recovery includes unsaved changes to these fields.

Choose **Внеси изображение** to use a JPG, PNG, or WebP file up to 9 MB as the drawing background. The editor fits the image to the current board and activates **Свободна ръка** for **Линия**. The other drawing tools also work over the image. **Смени изображението** and **Премахни изображението** keep the markings, and **Отмени** can restore the previous background. Saving includes the background in the editor, review, and plan list previews. The database stores each JPEG once per club. Saved drawings contain a local image URL and a separate image reference. Image bytes do not change after creation. The editor keeps image bytes in its local history and drafts so that Undo can restore an image after the last saved reference is removed.

If a newer version exists, the editor opens a dialog. Save your changes as a separate plan, load the latest saved version after confirming, or dismiss the dialog to keep editing. **Запази** reopens the dialog while the conflict is unresolved.

Konva plan cards show a read-only preview of the saved pitch and drawing. Previews load as cards approach the visible part of the list. Only one preview request runs at a time, with up to 12 drawings per request. When a card leaves this area, the list removes its drawing data and canvas. Returning to the card loads its preview again. Filters and view changes clear the preview data.

The plan review supports zoom and an expanded view of the saved pitch. **Детайли** brings the description, information, and equipment cards into focus. **Пособия** shows the total and a breakdown by type for items visible on the saved pitch. The description and equipment shortcuts open the corresponding panel in the editor.

Admins and coaches open **Тренировъчен план** from the club or a coach group. This button opens the weekly microcycle. Opening it from a coach group carries that group through all pages and back navigation.

The weekly microcycle, the drawing library (**Библиотека с упражнения**), and the plan list (**План-конспекти**) are the three main pages. A bar below the page header links them: **Микроцикъл**, **Упражнения**, and **План-конспекти**. The bar marks the open page. On these three pages, **Назад** opens the club or group page. If the microcycle has unsaved changes, the bar and **Назад** ask for confirmation first.

Each back button opens a fixed parent page and does not use the browser history:

- The drawing review and the drawing editor open the library (**Към упражненията**).
- The plan editor opens the plan list (**Към план-конспектите**).
- Pages for the plan of a training open the microcycle (**Към тренировката**). The plan list for a training does not show the bar.

After a coach adds a plan to a training, the microcycle replaces the plan list in the browser history. New plans and copies record the group's name at creation and the signed-in account when available. Creation from the club's main page displays **Администратор**. Older plans without recorded attribution display **Няма записан автор** in the review.

Choose **Категория** in the editor. In Konva, **Запази** saves the category alongside the drawing, and local recovery preserves unsaved category changes. Every club starts with **Атака**, **Защита**, **Преход атака в защита**, **Преход защита в атака**, and **Статични положения**. Plans using a retired default keep that category as a club category. In the editor, **Нова категория** adds a category for the current club and selects it in the form. A plan can have one category or remain uncategorized. The list can filter by category, including **Без категория**, and copies retain their category. Plans without a category stay uncategorized.

In the training plans list, **Моите** shows plans created by the signed-in account. **Клуб** shows all plans for the selected club, including older plans without a recorded creator. Both buttons work with the category filter. Under **Клуб**, **Филтър по треньор** lists coach groups with attributed plans in the selected club.

The scope buttons and coach options show totals for the selected club across all categories and pages.
The list supports grid and list views and can sort by most or least recently updated. The selected order applies to every page of results.

From the training plans list, **Управление на категориите** adds, renames, and deletes club categories. Shared defaults are available to every club. Renaming preserves plan assignments, and deleting moves affected plans to **Без категория**.

Choose **Празно поле** to open the whole blank field immediately. For **Футболно игрище**, click the quadrants directly on the full-pitch preview and choose **Приложи**. Reopen the preview with **Избери части от игрището**. All four parts start selected. The editor crops to the selected parts and leaves gaps when they do not form a rectangle. If any objects are outside the selected parts, the editor asks for confirmation before removing them. Cancel to return to the preview or use **Отмени** after confirming to restore the objects and the previous pitch. **Избери всички**, **Изчисти игрището** and the equipment counts apply to the visible parts. Existing half-pitch plans keep their original view until you choose a different pitch type.

The tool buttons in **Топки и врати** and **Пособия** show how many objects of each type are on the pitch.

**Завърти игрището на 90°** turns the pitch clockwise. Arrows and zones turn with the markings. Players, equipment, and text move with the pitch and keep their individual orientation on screen. Rotation works on blank and cropped pitches and is saved with the plan. Use **Отмени** to restore the previous orientation.

For equipment, players, arrows, lines and zones, the tool stays active between placements. While it is active, you can place items or start drawings directly over existing items. Choose **Избор**, tap the active tool again, or press Esc to return to selection mode. In selection mode, click or drag existing items directly and use their handles to resize, rotate or reshape them.

Selecting an object opens a toolbar on the pitch to change its color, duplicate it, delete it, or move it one layer forward or back. For players and text objects, the pencil button edits the number or text. To select objects with the keyboard, focus the pitch and use Page Up or Page Down. Color updates as the picker moves, and one undo restores the color before that adjustment. The toolbar moves below the object when there is insufficient room above it.

Choose **Множествен избор** to select several placed objects. Tap an object or anywhere inside its selection outline to deselect it, or choose **Избери всички** to select the whole pitch. When selection outlines overlap, the smaller box takes priority. Drag from an empty area to select objects that overlap the box. Tap an empty area to clear the selection while staying in this mode. Drag any selected object or its selection outline to move the selection together. The toolbar follows the first selected object and moves below it when space above is limited. With nothing selected, the controls float in the top-right corner of the pitch. The shared controls change the color, duplicate or delete the selection, and move it to the front or back. Each action can be undone in one step. With the pitch focused, use Page Up or Page Down to find an object and Space to add or remove it from the selection.

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

**Линия** and **Прекъсната линия** start without arrowheads. Turn on **Връх на стрелка** before drawing, or select an existing line and use the arrow button in its toolbar. Each line saves its own setting.

The **Движения** button opens the movement tools. **Дрибъл**, **Бягане**, **Пас**, and **Удар** use **Право** as the default drawing mode. Use the drawing mode buttons to change the mode for the active tool.

The team tools contain **Треньор** and **Състезател**. New coaches use black for all teams. Saved figures keep their colors.

While drawing a freehand movement, the preview shows the stroke. After release, its arrowhead points along the short, straight finish at the tip. The dribbling wave fades into the centerline under the arrowhead.

The pitch toolbar provides shortcuts for selection and drawing. On desktop, the full tool panel sits beside the pitch, and **Цял екран** expands the editor when the browser supports it. On narrower screens, **Инструменти** opens a bottom sheet with drawing categories and options. **Избор** and **Избери всички** are above the pitch. The **Игрище** button shows pitch setup and collapses the drawing tools. On desktop, this button is available in **Линии и полета**. **Детайли** contains the plan fields. Mobile pitch actions below the canvas include rotation, clearing, history, and zoom. Use **Премести изгледа** to scroll around a zoomed pitch.

## Data and rendering

The existing `TrainingPlan.layout` JSON column stores both drawing versions independently of the plan category. Version 2 stores `sport`, `surface` and an ordered `objects` array. Array order determines stacking. Objects carry semantic kinds (`player`, `equipment`, `movement`, `zone`, `text`), stable IDs, logical coordinates, dimensions, rotation and appearance. Players store team, role and label. Movements store action, path type and local control points. Text objects may store an explicit font size. Older text uses its saved box height to determine the original font size. This is application data, independent of Konva node serialization.

Version 2 can store one optional background with its board coordinates and quarter-turn rotation. The browser converts it to a bounded JPEG before saving. The same layout field stores the image for saves, copies, and draft recovery.

The football registry owns toolbar labels, equipment choices, surfaces and movement styles. Football is the only registered sport. Selection, transformations, history, geometry, recovery and saves are shared editor operations. Future sports can add definitions and rendering; future 3D previews can consume semantic data without interpreting canvas pixels. Neither additional sports nor 3D rendering is implemented here.

The client-only canvas scales a 1050 × 700 board uniformly. Surface, objects and transient controls normally use three layers. Active dragging/transformation temporarily moves the object to the controls layer, restoring its original stacking order afterward. During live color adjustments, the selected object renders on its own temporary layer, with surrounding objects retaining their stacking order. Drawing and color previews update at most once per animation frame. Completed gestures create one history entry; cancelled gestures restore the original object. History retains 100 entries. Exercises are limited to 200 objects and 300 persisted points per freehand path; rendering also bounds sampled dribbling geometry.

## Saving and recovery

The existing club training-plan endpoints accept both layout versions. Creation additionally accepts `editorVersion: 2`, or `sourcePlanId` with `editorVersion: 2` for a server-side converted copy. Summaries include `layoutVersion`. Listing uses 50-record cursor pages (`cursor`, `nextCursor`) and extracts only the JSON version in PostgreSQL rather than fetching full drawings.

Every version-2 PUT, including metadata edits, requires `expectedUpdatedAt` from the last loaded/saved record. An atomic conditional update inside a short transaction returns HTTP 409 if that revision is stale. Existing version-1 save requests remain compatible. A plan cannot change format through PUT.

The editor keeps editing enabled while a save is pending. Only the submitted snapshot becomes saved; later edits remain dirty. Conflicts preserve current work and offer reloading the server drawing or saving a new copy. Reloading requires confirmation in an editor dialog before replacing the current work. Saving a copy keeps the current editor open and provides a link to the copy. Applying a pitch selection that removes objects also requires confirmation.

Recovery drafts are debounced in browser storage and scoped by user, club and exercise, with their base revision stored in the draft. Reopening offers restore/discard. Stale drafts require saving a copy or reloading the server. Storage failure does not block editing or explicit saves. Matching saved drafts are cleared after successful saves. Editor navigation with unsaved work opens a confirmation dialog and writes the draft before leaving. Refreshing or closing the tab uses the browser's warning.

Pages and all affected endpoints follow the existing admin/coach club policy: scoped coaches stay within their default club; admins and unscoped sessions retain their existing club-wide access. Mutations check trusted origin. In development, a matching request origin is also accepted when `APP_BASE_URL` points to production; production continues to require the configured public origin. Server-side validation rejects malformed layouts, duplicate IDs, unsupported object data, non-finite values and degenerate geometry.

## Verification boundaries

Automated model/history/conversion tests, API authorization/concurrency contract tests, and in-memory PostgreSQL pagination tests are colocated under `src/lib/exercise`. API contract tests mock authentication and Prisma writes. A separate development-database check used Prisma to create a temporary source/copy, verify JSON round-tripping and stale-revision rejection, then roll back the entire transaction. No temporary records were committed.

Browser checks use actual editor/list components in a temporary local preview with mocked save endpoints. They cover the seven repository viewport sizes, touch placement/resizing/curve handles, keyboard controls, modal behavior, cancellation, recovery, storage/offline failures and edits during saves. Reduced-height viewport checks approximate keyboard space; a real mobile keyboard and lower-powered physical phone still require manual testing.

Image export, grouping, fullscreen, animation and 3D are separate follow-up work.

### Results (10 November 2026)

- 28 targeted tests passed (model/conversion/history, API contracts, PostgreSQL summaries/pagination and existing legacy geometry).
- Production build (`npm run build`), type checking and ESLint for affected files passed. Repository-wide ESLint reports three pre-existing `no-require-imports` errors in `scripts/generate-pwa-icons.cjs`, plus existing warnings.
- Actual component browser checks passed at 320×568, 360×800, 375×667, 390×844, 430×932, 768×1024 and 1440×900. Both editor and list dialogs were checked for horizontal overflow and interactions. Additional CDP touch checks covered resize/curve handles at 320, 430 and 1440 pixels; cancellation, offline/storage failure, drafts, stale saves and edits during saving also passed.
- Chromium stress measurements used a 390×844 viewport on this desktop, with 30 or 200 objects (all but one were 300-point paths). Median frame gaps were approximately 16.7 ms in both cases. At 200 objects, moving the active object to its own layer reduced observed long tasks from 45 to 4; remaining gesture-boundary stalls reached approximately 100 ms. These are development-preview measurements, not a physical-phone performance certification.
- A live browser → Next.js → database save flow, a real mobile keyboard, physical lower-powered phones and the full unrelated test suite were not tested.

Direct manipulation was additionally checked at all seven viewport sizes: mouse dragging of existing equipment and arrows with placement tools active, touch dragging with the running tool active, and subsequent placement on empty pitch. Resize/curve handles and cancelled drags were also rechecked without first using Select at 320, 430 and 1440 pixels. Affected-file ESLint and type checking passed; the production build was not repeated for this interaction-only change.

## План-конспект

Open **План-конспекти** from the drawing library. Documents are private to the signed-in account within the selected club. Open **Нов план-конспект** to edit the session details and the five exercise sections directly on the plan. Select the session day in **Ден** from a list of the days from **Понеделник** to **Неделя**. A plan saved with a typed day shows that text as the selected option until you select a day from the list. Use **Подредба на долния ред** directly above the lower row to give two neighboring sections a shared diagram area. Splitting the sections again keeps their individual fields and drawings.

Browser Back and Forward use a custom dialog for navigation within the app. The dialog opens if the document has unsaved changes or a save is in progress. **Отказ** keeps the editor and its changes. **Потвърди** continues the requested navigation. **Към план-конспектите** uses the same warning. Reloading or closing the tab uses the browser warning. The history guard keeps the existing history entries and Next.js state.

Use **Добави упражнение** to select a saved Konva drawing. The selection area opens with **Мои** active each time. **Мои** shows drawings from the signed-in account in this club. **Клубни** shows all drawings in this club. Use **Търсене по заглавие** to find titles in the active filter. Search ignores letter case and applies before pagination. The search text stays when you change the filter. Closing the selection area clears the filter and search text. Saving the document captures a copy of that drawing. Subsequent library edits and deletions leave the document’s copy available. Use **Смени упражнението** to attach a newer version. When you pick an exercise that has requirements, the section’s **Изисквания** field gets that text. If the field already holds different text, a dialog asks before it replaces the text. You can edit the field after it is filled. Removing the exercise keeps the text. The document keeps its drawing data and references the shared image. It does not copy the image bytes. Deleting or changing the source drawing keeps the image while a saved document uses it. When the last drawing or document reference is removed, the same transaction deletes the unused image. An image that only documents use is available only to the author of those documents.

Choose **Преглед за печат** to check the A4 landscape layout, then **Към редакцията** to return to the editable plan. A taller pitch view turns 90° clockwise on this sheet. Players, equipment, and text keep their individual orientation while the background, arrows, and zones rotate with the pitch. The drawing editor and library keep their saved orientation. **Печат** opens the browser print dialog for one A4 landscape sheet or **Save as PDF**. The preview reduces the sheet’s scale if the entered content would otherwise exceed the page. The heading and **Изисквания** block of every section gets the height of the tallest one, so all drawings start at the same level. All drawings on the sheet have the same size. Their height is the smallest space that a section has below its text.

Use **Изтегли PDF** to download one A4 landscape page without the browser print dialog. The PDF includes the current text, drawings, and color mode. The app checks current print access before it creates the file. Controls stay disabled while the file is prepared. If the download does not start, use **Отвори PDF** to open the prepared file. On a phone, select Print in the PDF viewer or printer app. The phone must have access to a compatible printer. The PDF is created in the browser. Document content is not sent to an external PDF service. Text is stored as an image in this PDF.

Enable **Черно-бял печат** in the print preview for a white built-in pitch with dark markings and player labels that include the team number. Imported backgrounds are lightened and rendered in grayscale.

## Subscription access

Drawing saves and training document saves and printing require an active training plans subscription. Accounts with the `admin` role can save and print without a subscription. Other accounts can open saved content, draw, and edit forms without active access. Browser draft recovery remains available. A message states that training plans are not activated. Save and Print remain available as controls. If access is inactive, these actions show a subscription error and do not save or print.

Each drawing and document save handler explicitly requires save access. The check does not depend on the URL text. The print button checks current access before it opens the browser print dialog. The app hides the document from direct browser print output unless the print action has passed this check. Print preview remains available without a subscription. These controls cannot prevent screenshots or extraction of content already visible in the browser.


### Shared image migration

The `20261119160000_shared_training_images` migration adds the image table and image references. Apply it through the normal deployment workflow. Existing embedded JPEG backgrounds remain readable. New saves convert embedded backgrounds to shared image references. Saves, copies, deletion, and backfill use one transaction lock per club to protect shared references. The editor page and its reload API read the drawing and image in one repeatable-read transaction. A concurrent image replacement or deletion does not change that read snapshot.

Convert existing drawings and document copies only after the updated app is running. The backfill uses one record per transaction. It keeps document revisions and update times. It also converts document copies whose source drawing was deleted. The command can run again after completion or failure.

1. Run `npm run backfill:training-images` to display the resolved host and database name. This command does not change records.
2. Check that this is the intended database.
3. Run `npm run backfill:training-images -- --apply --expected-host HOST --expected-database NAME` with the displayed host and database name.

A non-Neon target also requires `--allow-production`. Obtain explicit authorization before running the command against production. Do not put a database URL or password in the command. The schema migration does not run the backfill automatically.

Run `npm run test:training-images:db` to check the complete save and deletion flows against the configured Neon development database. This check creates a temporary schema and removes it when the check completes. It does not change the public schema or existing club data. The default test suite checks the migration constraints with PGlite and does not connect to an external database.

## Weekly training microcycles

**Тренировъчен план** opens the weekly cycle page. The page starts with the current Monday–Sunday week in `Europe/Sofia`. Use the week controls to select another week. Group cards show whether a saved cycle exists. Links open the drawing library and **План-конспекти**.

Entry from the club page permits creation, changes, and deletion. Entry with `coachGroupId` shows that group's custom training groups in a read-only view. Save and print access use the existing training plan subscription checks. Each group has one cycle per week. Several groups can use the same cycle. Existing private documents retain their access rules.

Choose a group to open its cycle. Use **Добави тренировка** to add a row. Enter text in the warm-up field and the four main-part fields. Each field changes its height to fit its text. On screens 640 px or wider, all fields of a training have the height of the tallest field. Use **Запази** to save changes. Concurrent changes produce an error instead of replacing the saved revision.

The `20261119200000_training_microcycles` migration creates a separate table. Apply and verify this migration in development before deployment. No production migration has been run during this change.

### One microcycle for several groups

Use **Използвай и за други групи** to select more groups for the same week. The dialog shows the coach of each group and marks a group that already has a microcycle. After **Запази**, all selected groups use one microcycle. If a selected group already has a microcycle in this week, a confirmation dialog opens first. The save replaces that microcycle for the group and removes the plan links of that group. The plans stay in the library. A microcycle that no group uses is deleted. The group card shows **Общ микроцикъл с N групи**, and the editor shows the other groups.

When you change the text of a shared microcycle, select where the change applies:

- **Само за <group>** (the default) makes a copy for the open group. The other groups keep the old text. The copy keeps the training IDs, so the plan links of the group stay.
- **Всички групи (N)** changes the microcycle for every group that uses it.

If you only add groups and do not change the text, the save makes no copy. **Изтрий** in a shared microcycle removes it only from the open group. The other groups keep it. The microcycle is deleted when no group uses it.

The `training_microcycles` table holds the content and the revision. The `training_microcycle_groups` table holds one row for each group and week (`club_id`, `group_key`, `week`). Each plan link in `training_session_documents` refers to a group of its microcycle. When the group moves to a copy, PostgreSQL moves its links too (`ON UPDATE CASCADE`). When the group stops using the microcycle, PostgreSQL deletes its links. The `20261123120000_shared_training_microcycles` migration moves each existing microcycle to its group. It deletes links of a group that does not use the microcycle, because no page can open these links. A coach view does not show the other groups of a shared microcycle.

### Use a past microcycle

Use **Използвай предишен микроцикъл** to open the microcycles of earlier weeks, the newest first. In each week, the microcycles of the open group come first and show **Тази група**. Search by group name. The list shows 20 items. Use **Покажи още** to show more. Select a microcycle to put its content in the editor. If the editor has content, a confirmation dialog opens first. The trainings get new IDs, so the plan links stay with the past week. **Сезон** and **Полусезон** stay from the current week. Select **Запази** to save the content. `GET …/training-plans/microcycles/history?week=&groupKey=&q=&offset=` gives the list, and `GET …/history?cycleId=` gives the content of one microcycle. A coach view cannot use this endpoint.

### Plan-documents for individual training sessions

Open a saved cycle from the coach group link. Select **Добави план-конспект** below the training number. The editor shows the instructions for that row in **Указания от методиста**. The card shows the microcycle and the training number, and one tile for each part of the training. An empty part shows **Няма указания**. Select the card title to close or open the card. Use the refresh button (**Обнови указанията**) to read changes from the methodist. When the instructions change, the card shows a message. The editor also checks for changes when the tab regains focus. The reference panel cannot change the exercises in the document.

Choose an existing plan to open its read-only A4 preview. The list shows only the plans of the coach. The preview shows the group, season, **Микроцикъл**, and **Тренировка №** of the training, as the editor does. **Използвай този план-конспект** links the plan to the training and does not change the plan content. **Редактирай** opens the plan in the editor without a link (`link=1`). In this editor, the main button shows **Използвай този план-конспект** while the plan has no changes. This button only links the plan to the training. After a change, the button shows **Запази и използвай**. This button opens the save dialog, and both save choices link the plan to the training. The dialog also shows the microcycle and training number that will use the plan. **Към списъка** returns to the list without a link. A plan can have links from several trainings. Linking keeps the saved plan fields. Each training shows its own **Микроцикъл** and **Тренировка №**. After editing a plan, choose whether to update the shared plan or save a new plan for the current training. Saving a new plan changes only the current link.

When a training has a plan, **Отвори план-конспекта** opens a dialog with the plan card. **Преглед** opens the linked plan. **Избери друг** opens the plan list with `replace=<plan ID>`. Use the list to link another plan, edit and save another plan, or create a new plan. In the same transaction, the server replaces the link only while the training still uses the plan in `replace`. If the training has a different plan, the server rejects the save and keeps the current link. The replaced plan stays in the author's library.

**Премахни от тренировката** removes the link between the plan and the training. A confirmation dialog opens first. The plan stays in the author's library. `DELETE /api/admin/clubs/<club ID>/training-plans/microcycles/session` receives the training and `documentId`. The server removes the link only while the training still uses this plan and the plan has the coach group as its author. Otherwise, it returns 409 and keeps the link. When the training has no plan, the server returns 204.

**Печат** and **Изтегли PDF** in the cycle first check print access. When at least one training has a plan of the coach, a dialog opens. In this dialog, select **Седмичен микроцикъл**, one or more training plans, or **Избери всички**. A training without a plan, or with a plan of another author, cannot be selected. The week and each plan start on a separate A4 landscape page. A plan that needs two pages keeps its two pages. Each printed plan shows the **Микроцикъл** and **Тренировка №** of its training. **Изтегли PDF** puts all selected pages in one file, `microcycle-<week>.pdf`. When no training has a plan, the buttons print the week as before, without the dialog.

#### Choosing the training in the editor

When the editor has a `coachGroupId`, **Микроцикъл** and **Тренировка №** are text fields with suggestions. `GET …/training-plans/microcycles/options?coachGroupId=` gives the microcycles of the coach's custom groups from the last 53 weeks and later, to a maximum of 200. The response contains only the microcycle numbers, the weeks, and the training row IDs. It does not contain the training text. The training suggestions show after the coach enters a microcycle. In the library, the editor finds the group from the group name in the plan. A coach with one group uses that group. A coach with more groups selects the group in **Група**.

The coach can type a number that is not a suggestion. A microcycle number that the group does not have, or a training number that the microcycle does not have, shows a warning below the field. **Запази** shows the warning again in a dialog. The coach can save after the dialog. If two weeks have the same microcycle number, the editor uses the week that the coach picked, then the training that opened the editor, then the latest week.

The plan moves to another training only after the coach changes these fields. When the fields identify another training, **Указания от методиста** shows the instructions of that training, and the editor copies its group and season into the plan. The training that opened the editor keeps its current plan, and `replace` does not apply. When the fields identify no training, the save keeps the training that opened the editor. In the library, the plan then has no link. After the save, the editor opens the week of the linked training.

If the coach changes only **Микроцикъл**, **Тренировка №**, or both, the save does not make a copy and does not change the plan content. The editor sends `POST …/documents` with `linkDocumentId` and `target`. This adds a link from the chosen training to the same plan. The editor ignores the group and season fields in this comparison, because they come from the training. If the coach also changes other content, **Запази** shows the usual dialog. **Запази върху съществуващия** changes the shared plan and adds the link. **Запази като нов план-конспект** makes a copy that has only the new link.

If the chosen training has another plan, the server returns `409` with `replaceDocumentId`. The editor then asks **Тренировката има план-конспект** and gives **Замени**. When the coach confirms, the editor sends the same request again with `replaceDocumentId`. The server replaces the link only while the training still uses that plan. The replaced plan stays in the library. The server sends `replaceDocumentId` only when the coach can see that plan. If the coach cancels, the changes stay in the editor.

#### Training numbers come from the links

A linked plan does not store **Микроцикъл** and **Тренировка №**. The `training_session_documents` table is the list of the trainings that use a plan. When the server saves a plan that has a link, or saves a plan for a training, it sets `content.session.microcycle` and `content.session.sessionNumber` to empty text. A plan without links keeps the text that the author typed. `automaticNumber` is no longer necessary. The server accepts it and ignores it.

The plan list and `GET …/documents/<id>` return `usages`. Each item has the cycle, group key, row ID, week, group name, microcycle number, and training number. The training number is the position of the row in the microcycle, so it stays correct when the methodist adds, removes, or moves rows. One query reads the usages of all plans on a list page, with a limit of 500 rows. Save responses also return `usages`.

When the editor opens a plan from a training, it shows the numbers of that training. In the library, a plan with one training shows the numbers of that training. A plan with more trainings shows empty fields and the list **Използва се в**. The plan cards show at most two trainings and the number of the other trainings.

The first save of a new plan creates the document and its link in one transaction. A retry uses the same document ID. If another draft has claimed the row, the coach can keep editing or save a separate document in the library. The editor keeps the draft in tab storage when storage is available. Save and cancel return to the original row.

All coaches sign in with one shared account, so the `coachGroupId` identifies the coach. When a page has a `coachGroupId`, the coach group (`coach-group:<id>`) is the author of each plan that the coach makes, also in the library. Without a `coachGroupId`, the signed-in account is the author, for example, an admin. With a `coachGroupId`, the coach can see and change only the plans of that coach group. The plans of the shared account or of an admin are plans of another author. The server checks the club and the custom training group's coach group before it creates a link. A coach cannot see, use, or change a plan of another author, for example, a plan of another coach group or of an admin. The plan list, `GET …/documents/<id>`, links, and copies accept only the plans of the author. When a training already has a plan of another author, the microcycle shows **Има план-конспект от друг автор** and gives no action for it. The existing login and standalone document rules still apply. Drawing selection uses the existing club drawing library.

The `20261120100000_training_session_documents` migration gives each saved row a permanent UUID. It preserves the instruction text and the order of the rows. It increments each cycle revision. Reload any open cycle editor before saving. The link key contains the cycle ID, group key, and row ID. Removing the row or cycle removes its link. The document stays in the author's library.

The `20261121100000_reuse_training_documents` migration permits several links to one document. It preserves existing documents and links. Apply it before enabling plan reuse.

Schedule the original row migration and server switch together. An older running server cannot display migrated rows. Earlier servers expect arrays of text cells in the database. To recover after rollout, keep a server that reads version 2, or restore the application and its matching database backup together. Restoring a backup requires reconciliation of subsequent saves.
