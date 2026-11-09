# MyTeam

Bulgarian-language sports club management app built with Next.js, React,
TypeScript, Prisma, and PostgreSQL.

## Frontend modules

- `src/app/_components/` contains landing-page sections, media dialogs, and
  canvas components. Static content and football drawing helpers live in
  `src/app/_utils/`.
- `src/app/admin/members/_components/` contains attendance, reporting, member
  details, imports, and confirmation dialogs in separate modules. Training
  editor steps have separate components for dates, times, capacity, venues,
  and notes. Day details delegate match viewing/editing and limited-place
  registrations to separate components.
  `members-page-components.tsx` preserves existing exports for compatibility;
  prefer direct imports from component, `_types/`, and `_utils/` modules.
- `src/app/admin/members/_hooks/` owns feature state for member management,
  notifications, coach groups, birthdays, and training forms. `_actions/`
  contains client-side scheduling, attendance, match, field, note, and reminder operations
  with explicit inputs. The members page coordinates club selection,
  permissions, filters, shared refreshes, and dialog composition.
- `src/app/admin/training-plans/[planId]/_components/` contains tactical visuals
  and selected-item controls. Equipment definitions and drawing geometry live
  in `_utils/`; the page owns editor state, pointer interactions, and saving.

- `src/app/member/[cardCode]/_components/` contains member dialogs and shared icons.
  Display helpers and printable receipt generation live in `_utils/`, with
  shared shapes in `_types/`. The page retains payment operations, permissions,
  live updates, and shared state. Training day details separate session-based
  attendance, legacy attendance/registration, and match details.
- `src/app/admin/players/_components/` contains demo and coach notification
  panels, each owning its selection, sending state, and requests. The page
  retains club loading, filtering, navigation, and visit-notification settings.
- `src/app/admin/discounts/` separates partner and club editors into
  `_components/` and `_hooks/`, with shared types in `_types/`.
- `src/components/push/usePushSubscription.ts` owns subscription state and
  operations. `PushNotificationsPanel.tsx` renders status and controls;
  `IPhonePushGuide.tsx` renders installation instructions. Browser helpers and
  diagnostic reporting live under `src/lib/push/`.

Page stylesheets remain at their original locations to preserve the CSS cascade.
