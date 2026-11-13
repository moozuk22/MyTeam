import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { expect, it, vi } from "vitest";
import { MembersOverview } from "./MembersOverview";

vi.mock("@/components/admin/AdminLogoutButton", () => ({ default: () => null }));
vi.mock("./ClubFinancePanel", () => ({ default: () => null }));
vi.mock("./ClubSubscriptionSummary", () => ({ default: () => null }));

const academyId = "7d453063-7ef4-4004-a59a-c20ae89f4cda";
const otherClubId = "12345678-1234-4123-8123-123456789abc";
const groupId = "3a085f26-7cdb-403e-8856-939ebc006b12";

it.each([
  { role: "coach", clubId: academyId, coachGroupId: groupId, visible: true },
  { role: "coach", clubId: otherClubId, coachGroupId: groupId, visible: false },
  { role: "coach", clubId: academyId, coachGroupId: "", visible: false },
  { role: "admin", clubId: otherClubId, coachGroupId: groupId, visible: true },
  { role: "admin", clubId: otherClubId, coachGroupId: "", visible: true },
  { role: "guest", clubId: academyId, coachGroupId: groupId, visible: false },
])("shows the back button for $role on $clubId / $coachGroupId: $visible", ({ role, clubId, coachGroupId, visible }) => {
  const searchParams = new URLSearchParams({ clubId });
  if (coachGroupId) searchParams.set("coachGroupId", coachGroupId);

  const props = {
    isAdmin: role === "admin",
    isCoach: role === "coach",
    clubId,
    coachGroupId,
    searchParams,
    clubName: "Футболна академия Стойчо Стоев",
    clubNotificationsController: {},
    memberManagement: {},
    trainingGroups: {},
    coachGroupManagement: { coachGroups: [] },
    memberBirthdays: {},
    matchEditorState: {},
    clubSettings: {},
    memberNotifications: {},
    membersGuide: {},
    coachGroupAssignments: {},
    selectedGroup: "all",
    members: [],
    filtered: [],
  } as unknown as ComponentProps<typeof MembersOverview>;

  const markup = renderToStaticMarkup(<MembersOverview {...props} />);
  expect(markup.includes('class="amp-back-btn amp-btn--compact"')).toBe(visible);
});
