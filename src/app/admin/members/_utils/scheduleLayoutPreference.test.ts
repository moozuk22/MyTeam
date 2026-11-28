import { describe, expect, it } from "vitest";
import { SCHEDULE_LAYOUT_STORAGE_KEY, readScheduleLayout, saveScheduleLayout } from "./scheduleLayoutPreference";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("schedule layout preference", () => {
  it("defaults to the new layout", () => {
    expect(readScheduleLayout(memoryStorage())).toBe("new");
    expect(readScheduleLayout(null)).toBe("new");
  });

  it("remembers the saved layout", () => {
    const storage = memoryStorage();
    saveScheduleLayout("old", storage);
    expect(storage.getItem(SCHEDULE_LAYOUT_STORAGE_KEY)).toBe("old");
    expect(readScheduleLayout(storage)).toBe("old");
    saveScheduleLayout("new", storage);
    expect(readScheduleLayout(storage)).toBe("new");
  });

  it("falls back to the new layout when storage fails", () => {
    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(readScheduleLayout(broken)).toBe("new");
    expect(() => saveScheduleLayout("old", broken)).not.toThrow();
  });
});
