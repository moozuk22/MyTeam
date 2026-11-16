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
