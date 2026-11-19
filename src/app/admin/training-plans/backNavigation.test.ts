import { describe, expect, it, vi } from "vitest";
import { navigateBack } from "./backNavigation";

describe("training plan back navigation", () => {
  it("returns to the previous page instead of the fixed parent", () => {
    const router = { back: vi.fn(), push: vi.fn() };
    navigateBack(router, "/admin/members?clubId=club", 3);
    expect(router.back).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });
  it("uses the context fallback when the page has no history", () => {
    const router = { back: vi.fn(), push: vi.fn() };
    navigateBack(router, "/admin/training-plans?clubId=club&coachGroupId=group", 1);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/admin/training-plans?clubId=club&coachGroupId=group");
  });
});
