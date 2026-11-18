import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BrowserDialogs } from "@/components/admin/BrowserDialogProvider";
import type { Member } from "../_types/members-page-types";
import { downloadMemberLinks } from "./member-exports";

const click = vi.fn();
const anchor = { href: "", download: "", style: { display: "" }, click };
const dialogs: BrowserDialogs = {
  alert: vi.fn(async () => true),
  confirm: vi.fn(async () => false),
  prompt: vi.fn(async () => "export"),
};
const member = { fullName: "Иван Петров", isActive: true, birthDate: "2010-01-01", cards: [{ isActive: true, cardCode: "card" }] } as Member;
const options = { isAdmin: true, members: [member], clubName: "Team", dialogs };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { location: { origin: "https://example.test" } });
  vi.stubGlobal("document", { createElement: vi.fn(() => anchor), body: { appendChild: vi.fn(), removeChild: vi.fn() } });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("waits for the filename dialog before starting the download", async () => {
  let finish!: (value: string) => void;
  vi.mocked(dialogs.prompt).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const result = downloadMemberLinks(options);
  expect(click).not.toHaveBeenCalled();
  finish("custom/name");
  await result;
  expect(anchor.download).toBe("custom-name.txt");
  expect(click).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:export");
});

it.each([null, "", "   "])("preserves the default filename after dismissal or empty input (%s)", async (value) => {
  vi.mocked(dialogs.prompt).mockResolvedValueOnce(value);
  await downloadMemberLinks(options);
  expect(anchor.download).toBe("team-member-links.txt");
  expect(click).toHaveBeenCalledTimes(1);
});

it("does not download after the dialog owner leaves the page", async () => {
  vi.mocked(dialogs.prompt).mockResolvedValueOnce(undefined);
  await downloadMemberLinks(options);
  expect(click).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it("shows the empty-result message without opening a filename dialog", async () => {
  await downloadMemberLinks({ ...options, members: [] });
  expect(dialogs.alert).toHaveBeenCalledWith("Няма активни състезатели с карта за export.");
  expect(dialogs.prompt).not.toHaveBeenCalled();
  expect(click).not.toHaveBeenCalled();
});
