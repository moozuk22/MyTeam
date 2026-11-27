# Member messages

Open **Съобщение** on the club page to select players and send a message.
In custom-group mode, the main club page lists custom groups from all coach pages.
A coach page lists only its own custom groups.
The group filter and coach filter select players together. Search also applies.
A change to either filter clears the selected players.

`GET /api/admin/clubs/[id]/message-groups` supplies group IDs, names, coach-group IDs,
and active player IDs for the message dialog. The optional `coachGroupId` parameter
limits the result to one coach page. Each database query uses the requested club ID.
The training editor continues to use its existing group endpoint and scope.

The dialog loads group options when it opens. Failed requests show a retry button.
Closing the dialog cancels the request. An obsolete response cannot replace current data.
The send endpoint and its request format are unchanged.

Opening the member's bell marks all their unread notification history as read,
including notifications older than seven days. The bell then reloads the saved
read status and count. A failed save keeps the unread state and offers a retry;
background responses cannot overwrite a newer bell refresh.

## Sent message history

The system records each message that an admin or a coach sends from these endpoints:
`/api/admin/members/notify`, `/api/admin/members/notify-coaches`,
`/api/admin/notifications/send-to-players`, and `/api/admin/notifications/send-to-coaches`.
`/api/admin/notifications/send` (templates and demo reminders) is not recorded.

The record is saved after delivery. A failed save is logged and does not stop the send.
Each record contains the sender user ID, the audience, the text, the image URL,
the club IDs, the coach group IDs, and the recipient count. Player recipients
keep a name snapshot. A deleted player stays in the history without the player link.
Messages sent before this feature have no sender, so the history starts at deployment.

`GET /api/admin/sent-messages` returns 20 messages of the session user per page.
Use `cursor` for the next page. Admins filter by `clubId`. Coaches filter by
`coachGroupId`. Both roles filter by `playerId`. A user with both roles gets the admin view.
`GET /api/admin/sent-messages/filters?q=` returns filter options from the user's own messages only.
The history belongs to the login account. Coaches who share one account see the same history.

### History dialog

In the **Изпрати съобщение** dialog, select **История на съобщенията** to open the history.
Admins filter by club and player. Coaches filter by coach group and player.
The player search narrows the player list. Select **Покажи още** to load the next 20 messages.
Each card shows the send time (`dd.mm.yyyy HH:mm`, Europe/Sofia), the audience, the text, the image,
the club or the coach group, and up to five recipient names with the remaining count.
The middleware lets coaches use `/api/admin/sent-messages` and `/api/admin/sent-messages/filters`.
