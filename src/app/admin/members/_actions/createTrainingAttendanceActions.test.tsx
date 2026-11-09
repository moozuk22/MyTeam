import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { useTrainingAttendanceState } from "../_hooks/useTrainingAttendanceState";
import { createTrainingAttendanceActions } from "./createTrainingAttendanceActions";

type Options = Parameters<typeof createTrainingAttendanceActions>[0];

function options(): Options {
  let captured: ReturnType<typeof useTrainingAttendanceState> | undefined;
  function CaptureState() {
    // Capture initial hook values for these action tests; this harness is only server-rendered.
    // eslint-disable-next-line react-hooks/globals
    captured = useTrainingAttendanceState();
    return null;
  }
  renderToStaticMarkup(<CaptureState />);
  if (!captured) throw new Error("Attendance state was not initialized");
  const state = Object.fromEntries(
    Object.entries(captured).map(([key, value]) => [key, key.startsWith("set") ? vi.fn() : value]),
  ) as typeof captured;

  return {
    trainingAttendanceState: state,
    trainingGroups: {
      selectedTrainingGroupId: "custom-1",
      isCustomTrainingGroupMode: true,
      customTrainingGroups: [],
      trainingScheduleGroups: [],
      loadCustomTrainingGroups: vi.fn().mockResolvedValue([]),
      loadTrainingScheduleGroups: vi.fn().mockResolvedValue([]),
      setSelectedTrainingGroupId: vi.fn(),
    },
    trainingDaysForm: { setTrainingDaysEditorOpen: vi.fn(), setTrainingDaysEditorError: vi.fn() },
    matchEditorState: { setMatchCalendarVisibleMonthIdx: vi.fn(), setMatchEditTarget: vi.fn() },
    clubId: "club /1",
    trainingGroupScope: "2014",
    coachGroupId: "",
    currentCoachGroupName: "",
    setTrainingNote: vi.fn(),
    setTrainingNotesByDate: vi.fn(),
    setTrainingNoteTargetDates: vi.fn(),
    setPostTeamGroupSavePromptOpen: vi.fn(),
    setTrainingBulkNoteOpen: vi.fn(),
    setSchedulerCalendarVisibleMonthIdx: vi.fn(),
    fetchClubMatches: vi.fn().mockResolvedValue(undefined),
    standaloneTeamGroups: [2014],
    setTrainingGroupScope: vi.fn(),
    resolvedTrainingGroupScope: "2014",
    openTrainingDaysEditor: vi.fn().mockResolvedValue(undefined),
    trainingUpcomingByDate: new Map(),
  };
}

afterEach(() => vi.unstubAllGlobals());

it("keeps custom-group attendance requests scoped to the club, group, date, and month", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(async () => Response.json({ trainingDate: "2026-11-10", players: [] }));
  vi.stubGlobal("fetch", fetch);
  const input = options();
  await createTrainingAttendanceActions(input).fetchTrainingAttendance(
    "2026-11-10",
    undefined,
    "custom-1",
    "trainingGroups",
    "2026-11",
  );

  const url = new URL(fetch.mock.calls[0][0], "https://example.invalid");
  expect(url.pathname).toBe("/api/admin/clubs/club%20%2F1/training-attendance");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    date: "2026-11-10",
    month: "2026-11",
    customTrainingGroupId: "custom-1",
  });
  expect(vi.mocked(input.trainingAttendanceState.setTrainingAttendanceLoading).mock.calls).toEqual([
    [true],
    [false],
  ]);
});

it("retains coach scope and an explicit session when loading individual attendance", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(async () => Response.json({ trainingDate: "2026-11-10", players: [] }));
  vi.stubGlobal("fetch", fetch);
  const input = options();
  input.coachGroupId = "coach-1";
  await createTrainingAttendanceActions(input).fetchTrainingAttendance(
    "2026-11-10",
    "2014",
    undefined,
    "teamGroup",
    "2026-11",
    "session-1",
  );

  const url = new URL(fetch.mock.calls[0][0], "https://example.invalid");
  expect(url.searchParams.get("coachGroupId")).toBe("coach-1");
  expect(url.searchParams.get("trainingSessionId")).toBe("session-1");
  expect(url.searchParams.get("teamGroup")).toBe("2014");
});

it("clears loading and reports a failed attendance request", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ error: "Няма достъп." }, { status: 403 })),
  );
  const input = options();
  await createTrainingAttendanceActions(input).fetchTrainingAttendance("2026-11-10");
  expect(input.trainingAttendanceState.setTrainingAttendanceError).toHaveBeenCalledWith("Няма достъп.");
  expect(input.trainingAttendanceState.setTrainingAttendanceLoading).toHaveBeenLastCalledWith(false);
  expect(input.trainingAttendanceState.setTrainingAttendancePlayers).toHaveBeenCalledWith([]);
});
