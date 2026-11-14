import { afterEach, expect, it, vi } from "vitest";
import { createExerciseObjectId } from "./objectId";

afterEach(() => vi.unstubAllGlobals());

it("generates a version 4 UUID when randomUUID is unavailable over HTTP", () => {
  vi.stubGlobal("crypto", {
    getRandomValues: (bytes: Uint8Array) => bytes.fill(0xff),
  });

  expect(createExerciseObjectId()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
});
