import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SentMessageHistoryModal, { formatSentAt, recipientSummary, SentMessageCard, type SentMessageItem } from "./SentMessageHistoryModal";

const base: SentMessageItem = {
  id: "m1", audience: "players", body: "Тренировката е в 18:00.\nНосете вода.", imageUrl: null,
  sentAt: "2026-11-26T16:05:00.000Z", recipientCount: 14,
  clubs: [{ id: "c1", name: "ФК Левски" }], coachGroups: [{ id: "g1", name: "U12" }],
  recipients: [{ id: "p1", name: "Иван" }, { id: null, name: "Мария" }],
};

describe("sent message formatting", () => {
  it("shows the send time as dd.mm.yyyy HH:mm in Sofia time", () => {
    expect(formatSentAt("2026-11-26T16:05:00.000Z")).toBe("26.11.2026 18:05");
    expect(formatSentAt("2026-07-01T21:30:00.000Z")).toBe("02.07.2026 00:30");
  });

  it("summarises recipients with the number not shown", () => {
    expect(recipientSummary(base)).toBe("Иван, Мария +12");
    expect(recipientSummary({ ...base, recipientCount: 2 })).toBe("Иван, Мария");
  });
});

describe("SentMessageCard", () => {
  it("shows the club for admins and recipients for player messages", () => {
    const html = renderToStaticMarkup(<SentMessageCard message={base} view="admin" />);
    expect(html).toContain("До състезатели");
    expect(html).toContain("Клуб: </span>ФК Левски");
    expect(html).toContain("Получатели (14): </span>Иван, Мария +12");
    expect(html).toContain("26.11.2026 18:05");
  });

  it("shows the coach group for coaches", () => {
    const html = renderToStaticMarkup(<SentMessageCard message={base} view="coach" />);
    expect(html).toContain("Група: </span>U12");
    expect(html).not.toContain("ФК Левски");
  });

  it("labels coach messages and names deleted clubs", () => {
    const html = renderToStaticMarkup(<SentMessageCard message={{ ...base, audience: "coaches", clubs: [{ id: "c1", name: null }], coachGroups: [], recipients: [] }} view="admin" />);
    expect(html).toContain("До треньори");
    expect(html).toContain("Изтрит клуб");
    expect(html).not.toContain("Получатели");
  });
});

describe("SentMessageHistoryModal", () => {
  it.each(["admin", "coach"] as const)("renders an accessible loading state for %s", (view) => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const html = renderToStaticMarkup(<SentMessageHistoryModal view={view} onClose={vi.fn()} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("История на съобщенията");
    expect(html).toContain('aria-label="Затвори"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Зареждане…");
    vi.unstubAllGlobals();
  });
});
