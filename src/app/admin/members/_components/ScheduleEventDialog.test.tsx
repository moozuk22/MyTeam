import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ScheduleEventDialog } from "./ScheduleEventDialog";

const matchChoices = ["Мач", "Двубой", "Състезание", "Участие", "Турнир"];
const matchPickerLabel = matchChoices.join(" / ");

it.each([
  { schedule2: true, step: "type", choices: ["Тренировка", matchPickerLabel, "Почивен ден"] },
  { schedule2: true, step: "type", withoutDate: true, choices: ["Тренировка", matchPickerLabel, "Почивен ден"] },
  { schedule2: true, step: "type", occupiedDate: true, choices: ["Тренировка", matchPickerLabel, "Почивен ден"] },
  { schedule2: false, step: "type", choices: ["Тренировка", matchPickerLabel] },
  { schedule2: true, step: "match-type", choices: matchChoices },
  { schedule2: false, step: "match-type", choices: matchChoices },
] as const)("offers the expected $step choices with Schedule 2 set to $schedule2", (test) => {
  const { schedule2, step, choices } = test;
  const withoutDate = "withoutDate" in test;
  const noop = () => {};
  const noopAsync = async () => {};
  const html = renderToStaticMarkup(
    <ScheduleEventDialog
      schedule2EventTarget={schedule2 ? { groupId: "custom-group", date: withoutDate ? undefined : "2026-11-12" } : null}
      schedule2EventGroup={schedule2 ? { id: "custom-group", name: "Група", coachGroupId: "coach-group", coachName: "Треньор" } : undefined}
      schedule2CanCreateTraining
      schedule2RestDayDates={schedule2 && !("occupiedDate" in test) ? ["2026-11-12"] : []}
      onSchedule2RestDay={schedule2 && !("occupiedDate" in test) ? noop : undefined}
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
      scheduleEventStep={step}
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

  const choicePattern = step === "type"
    ? /<button[^>]*class="amp-btn amp-schedule-event-type-btn[^"]*"[^>]*>(?:<span[^>]*><\/span>)?([^<]+)<\/button>/g
    : /<button[^>]*class="amp-btn amp-btn--primary"[^>]*>([^<]+)<\/button>/g;
  const renderedChoices = Array.from(html.matchAll(choicePattern), ([, label]) => label);
  expect(renderedChoices).toEqual(choices);
  if (step === "match-type") {
    expect(html.includes("amp-modal--schedule2-match-editor")).toBe(schedule2);
    expect(html.includes("amp-modal--match-editor")).toBe(!schedule2);
  }
  if (step === "type") {
    expect(html.includes("amp-schedule-event-type-icon")).toBe(!schedule2);
    expect(html.includes("amp-schedule-event-type-btn--match")).toBe(!schedule2);
  }
});
