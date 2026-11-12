import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ScheduleEventDialog } from "./ScheduleEventDialog";

it("offers one training choice for a Schedule 2 custom group linked to a coach group", () => {
  const noop = () => {};
  const noopAsync = async () => {};
  const html = renderToStaticMarkup(
    <ScheduleEventDialog
      schedule2EventTarget={{ groupId: "custom-group", date: "2026-11-12" }}
      schedule2EventGroup={{ id: "custom-group", name: "Група", coachGroupId: "coach-group", coachName: "Треньор" }}
      schedule2CanCreateTraining
      openTrainingDaysEditor={noopAsync}
      matchEditorState={{
        matchEditorSaving: false,
        matchEventType: null,
        setMatchTeamGroups: noop,
        setMatchSelectedDates: noop,
        setMatchDetailsPerDay: noop,
        setMatchExistingIdByDate: noop,
        setMatchEventType: noop,
        matchSelectedDates: [],
        setMatchEditorError: noop,
        setMatchCalendarVisibleMonthIdx: noop,
        matchCalendarVisibleMonthIdx: 0,
        matchTeamGroups: [],
        matchDetailsPerDay: {},
        matchEditorError: "",
      }}
      trainingAttendanceState={{ trainingAttendanceView: "today" }}
      trainingGroups={{ isCustomTrainingGroupMode: true }}
      scheduleEventModalOpen
      setScheduleEventModalOpen={noop}
      setScheduleEventStep={noop}
      scheduleEventStep="type"
      openTrainingDaysEditorForCurrentScope={noopAsync}
      selectedTrainingGroup={null}
      selectedTeamGroup={null}
      selectedCustomGroup={null}
      matchCalendarMonthsTrimmed={[]}
      matchCalendarMonths={[]}
      matchCalendarDateSet={new Set()}
      matchCalendarMatchesByDate={new Map()}
      toggleMatchDate={noop}
      clubId="club"
      handleSaveMatch={noopAsync}
    />,
  );

  const choices = Array.from(html.matchAll(/<button[^>]*class="amp-btn amp-schedule-event-type-btn[^"]*"[^>]*><span[^>]*><\/span>([^<]+)<\/button>/g), ([, label]) => label);
  expect(choices).toEqual(["Тренировка", "Мач / Двубой / Състезание / Участие"]);
});
