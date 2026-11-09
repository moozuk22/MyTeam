import { afterEach, expect, it, vi } from "vitest";
import { buildMemberReceiptHtml, printMemberReceipt } from "./member-receipt";

const receipt = { paidFor: "2026-11-01", paidAt: "2026-11-09T12:00:00Z" };
const member = { name: '<script>alert("x")</script>', clubName: "  A & B  " };
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("escapes member, club, and period text in the printable document", () => {
  const html = buildMemberReceiptHtml(
    receipt,
    member,
    () => "<November> '2026'",
  );
  expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  expect(html).toContain("A &amp; B");
  expect(html).toContain("&lt;November&gt; &#39;2026&#39;");
  expect(html).not.toContain(member.name);
  expect(html).toContain('lang="bg"');
});
it("uses the club fallback when its name is blank", () => {
  expect(
    buildMemberReceiptHtml(
      receipt,
      { name: "Иван", clubName: "  " },
      (value) => value,
    ),
  ).toContain('class="title">Клуб</h1>');
});
it.each([false, true])(
  "cleans up the receipt URL when the print window opens: %s",
  async (opened) => {
    vi.useFakeTimers();
    const open = vi.fn().mockReturnValue(opened ? {} : null);
    vi.stubGlobal("window", { open });
    vi.stubGlobal("document", {});
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:receipt");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    printMemberReceipt(receipt, member, (value) => value);
    expect(open).toHaveBeenCalledWith("blob:receipt", "_blank");
    expect(await (create.mock.calls[0][0] as Blob).text()).toContain(
      "&lt;script&gt;",
    );
    if (opened) {
      expect(revoke).not.toHaveBeenCalled();
      vi.advanceTimersByTime(60000);
    }
    expect(revoke).toHaveBeenCalledWith("blob:receipt");
  },
);
