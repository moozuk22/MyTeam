import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MemberNotificationsDialog } from "./MemberNotificationsDialog";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof MemberNotificationsDialog>;

function renderDialog(trainingGroups: Props["trainingGroups"], groupOptions: number[] = [], state: Partial<Props["memberNotifications"]> = {}) {
  return renderToStaticMarkup(
    <MemberNotificationsDialog
      memberNotifications={{
        notifyPanelOpen: true, notifyBusy: false, notifyCoachGroupFilter: "",
        notifyCustomGroups: trainingGroups.customTrainingGroups, notifyGroupsLoading: false,
        notifyGroupsError: "", retryNotifyGroups: vi.fn(),
        notifyGroupFilter: "all", notifySearchTerm: "", notifyVisibleMembers: [],
        notifySelectedIds: new Set(), notifyMessage: "", notifyImage: null,
        notifyError: "", notifySuccess: "", setNotifyPanelOpen: vi.fn(),
        setNotifyCoachGroupFilter: vi.fn(), setNotifySelectedIds: vi.fn(),
        setNotifyGroupFilter: vi.fn(), setNotifySearchTerm: vi.fn(),
        setNotifyMessage: vi.fn(), setNotifyImage: vi.fn(), handleSendNotify: vi.fn(),
        ...state,
      }}
      coachGroupManagement={{ loadCoachGroups: vi.fn(), coachGroups: [] }}
      trainingGroups={trainingGroups}
      coachMessageOpen={false} isAdmin={false} isCoach={true} clubId="club"
      setCoachMessageOpen={vi.fn()} sentHistoryOpen={false} setSentHistoryOpen={vi.fn()} coachGroupId="" groupOptions={groupOptions}
    />,
  );
}

describe("message group filter", () => {
  it("shows custom groups when players have no numeric team groups", () => {
    const html = renderDialog({
      isCustomTrainingGroupMode: true,
      customTrainingGroups: [{ id: "custom-a", name: "Начинаещи", playerIds: ["player-a"] }] as Props["trainingGroups"]["customTrainingGroups"],
      trainingScheduleGroups: [],
    });
    expect(html).toContain('value="custom-a"');
    expect(html).toContain("Начинаещи");
  });

  it("preserves numeric team group options", () => {
    const html = renderDialog({ isCustomTrainingGroupMode: false, customTrainingGroups: [], trainingScheduleGroups: [] }, [2015, 2016]);
    expect(html).toContain('value="2015"');
    expect(html).toContain('value="2016"');
  });
});

it("shows message groups from coach pages independently of the training editor groups", () => {
  const html = renderDialog({ isCustomTrainingGroupMode: true, customTrainingGroups: [], trainingScheduleGroups: [] }, [], {
    notifyCustomGroups: [
      { id: "custom-a", name: "Начинаещи", coachGroupId: "coach-a", playerIds: ["a"] },
      { id: "custom-b", name: "Напреднали", coachGroupId: "coach-b", playerIds: ["b"] },
    ],
  });
  expect(html).toContain('value="custom-a"');
  expect(html).toContain('value="custom-b"');
});
it("keeps the close control while group options are loading", () => {
  const html = renderDialog({ isCustomTrainingGroupMode: true, customTrainingGroups: [], trainingScheduleGroups: [] }, [], { notifyGroupsLoading: true });
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('aria-label="Зареждане"');
  expect(html).toContain('aria-label="Затвори"');
});
it("shows a retry action when group options fail to load", () => {
  const html = renderDialog({ isCustomTrainingGroupMode: true, customTrainingGroups: [], trainingScheduleGroups: [] }, [], { notifyGroupsError: "Неуспешно зареждане на групите." });
  expect(html).toContain('role="alert"');
  expect(html).toContain("Опитай отново");
  expect(html).not.toContain('aria-busy="true"');
});

it("offers the sent message history next to the coach message action", () => {
  const html = renderDialog({ isCustomTrainingGroupMode: false, customTrainingGroups: [], trainingScheduleGroups: [] });
  expect(html).toContain("История на съобщенията");
  expect(html).toContain("Изпрати до треньори");
});
