import { expect, it, vi } from "vitest";
import MemberTrainingSessions from "./MemberTrainingSessions";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useState: (initial: unknown) => [initial, vi.fn()] }));

it("sends a scope target for an unstored session in a mixed day", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  vi.stubGlobal("fetch", fetchMock);
  try {
    const onUpdated = vi.fn().mockResolvedValue(undefined);
    const tree = MemberTrainingSessions({ date: "2026-11-06", cardCode: "CARD", sessions: [{ id: "stored", optedOut: false }, { scopeKey: "custom_group:second", optedOut: true }], onUpdated });
    const buttons: ReactElement<{ children?: unknown; onClick?: () => void; disabled?: boolean }>[] = [];
    function walk(value: unknown) {
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (!value || typeof value !== "object" || !("props" in value)) return;
      const element = value as ReactElement<{ children?: unknown; onClick?: () => void; disabled?: boolean }>;
      if (element.type === "button" && element.props.children === "Присъствам" && !element.props.disabled) buttons.push(element);
      walk(element.props.children);
    }
    walk(tree);
    expect(buttons).toHaveLength(1);
    buttons[0].props.onClick!();
    await vi.waitFor(() => expect(onUpdated).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ trainingDate: "2026-11-06", trainingScopeKey: "custom_group:second" });
  } finally { vi.unstubAllGlobals(); }
});

it("shows the custom-group name for a single training", () => {
  const html = renderToStaticMarkup(<MemberTrainingSessions sessions={[{ id: "one", groupName: "Група 1", trainingTime: "18:00", trainingDurationMinutes: 90 }]} cardCode="CARD" onUpdated={async () => {}} />);
  expect(html).toContain("<h3>Група 1</h3>");
  expect(html).toContain("18:00");
  expect(html).toContain("90 мин.");
});

it("shows the sport and highlights the reserved part of a stored training's field", () => {
  const html = renderToStaticMarkup(
    <MemberTrainingSessions
      sessions={[{
        id: "stored",
        trainingFieldName: "Волейболна зала",
        trainingFieldType: "volleyball",
        trainingFieldPieces: ["Сектор А", "Сектор Б"],
        trainingFieldPieceNames: ["Сектор Б"],
      }]}
      cardCode="CARD"
      onUpdated={async () => {}}
    />,
  );

  expect(html).toContain("Волейболна зала");
  expect(html).toContain("member-training-field-pitch--volleyball");
  expect(html).toContain('class="member-training-field-piece"><span>Сектор А</span>');
  expect(html).toContain('class="member-training-field-piece member-training-field-piece--selected"><span>Сектор Б</span>');
});

it("shows the whole pitch for a field without sections and skips sessions without a field", () => {
  const html = renderToStaticMarkup(
    <MemberTrainingSessions
      sessions={[{ id: "with-field", trainingFieldName: "Футболно игрище" }, { id: "no-field" }]}
      cardCode="CARD"
      onUpdated={async () => {}}
    />,
  );

  expect(html.match(/member-training-field-visual/g)).toHaveLength(1);
  expect(html).toContain("member-training-field-pitch--football");
  expect(html).toContain('class="member-training-field-piece member-training-field-piece--selected"><span>Цял терен</span>');
});
