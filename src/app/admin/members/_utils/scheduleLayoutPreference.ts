export type ScheduleLayout = "new" | "old";

export const SCHEDULE_LAYOUT_STORAGE_KEY = "admin-schedule-layout";

type LayoutStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): LayoutStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readScheduleLayout(storage: LayoutStorage | null = browserStorage()): ScheduleLayout {
  try {
    return storage?.getItem(SCHEDULE_LAYOUT_STORAGE_KEY) === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

export function saveScheduleLayout(layout: ScheduleLayout, storage: LayoutStorage | null = browserStorage()) {
  try {
    storage?.setItem(SCHEDULE_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // The switch still works for this visit.
  }
}
