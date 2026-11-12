import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ScheduleEventDialog } from "./ScheduleEventDialog";

it.each([
  { schedule2: true, choices: ["Тренировка", "Мач / Двубой / Състезание / Участие", "Почивен ден"] },
  { schedule2: false, choices: ["Тренировка", "Мач / Двубой / Състезание / Участие"] },
])("offers the expected event choices with Schedule 2 set to $schedule2", ({ schedule2, choices }) => {
  const noop = () => {};
  const noopAsync = async () => {};
  const html = renderToStaticMarkup(
    <ScheduleEventDialog
      schedule2EventTarget={schedule2 ? { groupId: "custom-group", date: "2026-11-12" } : null}
      schedule2EventGroup={schedule2 ? { id: "custom-group", name: "Група", coachGroupId: "coach-group", coachName: "Треньор" } : undefined}
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

  const renderedChoices = Array.from(html.matchAll(/<button[^>]*class="amp-btn amp-schedule-event-type-btn[^"]*"[^>]*><span[^>]*><\/span>([^<]+)<\/button>/g), ([, label]) => label);
  expect(renderedChoices).toEqual(choices);
});
