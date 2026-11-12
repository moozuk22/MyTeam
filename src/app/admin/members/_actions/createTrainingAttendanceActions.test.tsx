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
    trainingDaysForm: {
      setTrainingDaysEditorOpen: vi.fn(),
      setTrainingDaysEditorError: vi.fn(),
      setTrainingDaysEditorLoading: vi.fn(),
      trainingDaysEditorRequest: { current: null },
    },
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

function schedule2Requests() {
  const input = options();
  input.trainingAttendanceState.schedule2Open = true;
  input.trainingAttendanceState.trainingAttendanceOpen = true;
  const pending = new Map<string, (response: Response) => void>();
  vi.stubGlobal("fetch", vi.fn((path: string) => {
    const url = new URL(path, "https://example.invalid");
    const key = url.searchParams.get("customTrainingGroupId") ??
      url.searchParams.get("scopeKey") ?? url.pathname.split("/").at(-1)!;
    return new Promise<Response>((resolve) => pending.set(key, resolve));
  }));

  return {
    input,
    respond(key: string, body: unknown, status = 200) {
      const resolve = pending.get(key);
      if (!resolve) throw new Error(`Missing request for ${key}`);
      resolve(Response.json(body, { status }));
    },
  };
}

const detailDate = "2026-11-10";

it("does not delete any training when the selected Schedule 2 session disappears", async () => {
  const input = options();
  Object.assign(input.trainingAttendanceState, {
    schedule2Open: true,
    trainingAttendanceOpen: true,
    trainingAttendanceDate: detailDate,
    trainingDayDetailsTab: `${detailDate}-custom-removed`,
    trainingWeekSessions: [],
  });
  const fetch = vi.fn().mockResolvedValue(Response.json({ error: "Unexpected deletion" }, { status: 400 }));
  vi.stubGlobal("fetch", fetch);

  await createTrainingAttendanceActions(input).handleDeleteTrainingDay();

  expect(fetch).not.toHaveBeenCalled();
  expect(input.trainingAttendanceState.setTrainingAttendanceError).toHaveBeenCalledWith("Тренировката вече не е в графика.");
});

it("dismisses Schedule 2 details during loading and ignores the late response", async () => {
  const { input, respond } = schedule2Requests();
  const actions = createTrainingAttendanceActions(input);
  const opening = actions.openTrainingDayDetails(detailDate, `${detailDate}-custom-first`);

  actions.dismissSchedule2Details();
  respond("first", { trainingDate: detailDate });
  respond("custom_group:first", []);
  await opening;

  expect(input.trainingAttendanceState.setTrainingDayDetailsOpening).toHaveBeenLastCalledWith(false);
  expect(input.trainingAttendanceState.setTrainingDayDetailsOpen).not.toHaveBeenCalledWith(true);
});

it.each([200, 500])("keeps the latest Schedule 2 details after a stale %i response", async (status) => {
  const { input, respond } = schedule2Requests();
  const state = input.trainingAttendanceState;
  const first = createTrainingAttendanceActions(input).openTrainingDayDetails(detailDate, `${detailDate}-custom-first`);
  respond("custom_group:first", [{ id: "first-event" }]);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/limited-training-events\/first-event$/),
    { cache: "no-store" },
  ));

  // A render between clicks creates a new action factory with the same state refs.
  const secondTab = `${detailDate}-custom-second`;
  const second = createTrainingAttendanceActions(input).openTrainingDayDetails(detailDate, secondTab);
  respond("second", {
    trainingDate: detailDate,
    trainingSessionId: "second-session",
    players: [{ id: "second-player", fullName: "Играч" }],
    trainingTime: "18:00",
    trainingField: { id: "second-field", name: "Терен" },
    note: "Описание",
  });
  respond("custom_group:second", [{ id: "second-event" }]);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/limited-training-events\/second-event$/),
    { cache: "no-store" },
  ));
  respond("second-event", { event: { id: "second-event" }, registrations: [], spotsRemaining: 3 });
  await second;

  respond("first", { trainingDate: detailDate, trainingSessionId: "first-session" }, status);
  respond("first-event", { event: { id: "first-event" }, registrations: [], spotsRemaining: 1 }, status);
  await first;

  expect(state.setTrainingDayDetailsTab).toHaveBeenLastCalledWith(secondTab);
  expect(state.setTrainingAttendanceSessionId).toHaveBeenLastCalledWith("second-session");
  expect(state.setTrainingAttendancePlayers).toHaveBeenLastCalledWith([expect.objectContaining({ id: "second-player" })]);
  expect(state.setTrainingAttendanceStats).toHaveBeenLastCalledWith({ total: 1, attending: 1, optedOut: 0 });
  expect(state.setTrainingDayTime).toHaveBeenLastCalledWith("18:00");
  expect(state.setTrainingDayField).toHaveBeenLastCalledWith(expect.objectContaining({ id: "second-field" }));
  expect(input.setTrainingNote).toHaveBeenLastCalledWith("Описание");
  expect(state.setLimitedEvent).toHaveBeenLastCalledWith(expect.objectContaining({ id: "second-event" }));
  expect(state.setTrainingAttendanceError).toHaveBeenLastCalledWith("");
  expect(state.setTrainingDayDetailsOpen).toHaveBeenCalledTimes(1);
});

it("ignores pending Schedule 2 details when the planner is closed", async () => {
  const { input, respond } = schedule2Requests();
  const state = input.trainingAttendanceState;
  const actions = createTrainingAttendanceActions(input);
  const pending = actions.openTrainingDayDetails(detailDate, `${detailDate}-custom-first`);
  actions.closeTrainingAttendance();
  respond("first", { trainingDate: detailDate, trainingSessionId: "first-session" });
  respond("custom_group:first", []);
  await pending;

  expect(state.setTrainingDayDetailsOpen).toHaveBeenLastCalledWith(false);
  expect(state.setTrainingDayDetailsOpening).toHaveBeenLastCalledWith(false);
  expect(state.setTrainingAttendanceLoading).toHaveBeenLastCalledWith(false);
  expect(state.setLimitedEventLoading).toHaveBeenLastCalledWith(false);
  expect(vi.mocked(state.setTrainingAttendanceSessionId).mock.calls).toEqual([[null]]);
});

it("loads registrations for the newly selected Schedule 2 training tab", async () => {
  const input = options();
  input.trainingAttendanceState.schedule2Open = true;
  input.trainingAttendanceState.trainingAttendanceOpen = true;
  vi.stubGlobal("fetch", vi.fn((path: string) => {
    const url = new URL(path, "https://example.invalid");
    if (url.pathname.endsWith("/training-attendance")) {
      return Promise.resolve(Response.json({ trainingDate: detailDate, players: [] }));
    }
    if (url.searchParams.get("scopeKey") === "custom_group:second") {
      return Promise.resolve(Response.json([{ id: "second-event" }]));
    }
    return Promise.resolve(Response.json({ event: { id: "second-event" }, registrations: [], spotsRemaining: 2 }));
  }));

  await createTrainingAttendanceActions(input).loadDayDetailsSessionAttendance({
    id: `${detailDate}-custom-second`, date: detailDate, scopeType: "trainingGroup",
    trainingTime: "18:00", teamGroups: [], label: "Втора група",
  }, detailDate);

  expect(input.trainingAttendanceState.setLimitedEvent).toHaveBeenNthCalledWith(1, null);
  expect(input.trainingAttendanceState.setLimitedEvent).toHaveBeenLastCalledWith(
    expect.objectContaining({ id: "second-event" }),
  );
});
