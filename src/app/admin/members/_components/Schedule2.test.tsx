import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import Schedule2, { type Schedule2Session } from "./Schedule2";

it.each([false, true])("renders grouped events with details active: %s", (detailsActive) => {
  const today = "2026-11-15";
  const tomorrow = "2026-11-16";
  const groups = [
    { id: "first", name: "Loko", coachGroupId: "coach-1", coachName: "Треньор на 2026" },
    { id: "second", name: "Loko", coachGroupId: "coach-1", coachName: "Треньор на 2026" },
    { id: "empty", name: "Lemon", coachGroupId: null, coachName: null },
  ];
  const training: Schedule2Session = {
    id: "training-1",
    date: today,
    trainingTime: "18:00",
    scopeType: "trainingGroup",
    eventType: "training",
    label: "Loko",
    customGroupId: "first",
    teamGroups: [],
  };
  const match: Schedule2Session = {
    ...training,
    id: "match-1",
    date: tomorrow,
    trainingTime: "15:00",
    eventType: "match",
    label: "Мач · Академик",
    customGroupId: "second",
    coachGroupId: "coach-1",
  };
  const html = renderToStaticMarkup(
    <Schedule2
      dates={[today, tomorrow]}
      sessions={[training, match, { ...match, id: "match-2", customGroupId: null, label: "Мач · Без група" }]}
      loading={false}
      detailsActive={detailsActive}
      error=""
      today={today}
      week={0}
      lastWeek={1}
      canScheduleDate={() => true}
      onWeekChange={() => {}}
      customGroups={groups}
      onOpen={() => {}}
      onCreate={() => {}}
    />,
  );

  const rows = [...html.matchAll(/<tr><th scope="row">(.*?)<\/tr>/g)].map((result) => result[1]);
  expect(rows).toHaveLength(3);
  expect(rows[0]).toMatch(/^Loko<small[^>]*>Треньор на 2026<\/small>/);
  expect(rows[0]).toContain("18:00");
  expect(rows[0]).not.toContain("Академик");
  expect(rows[1].split("</td>")[0]).not.toContain("Академик");
  expect(rows[0]).not.toContain(">Тренировка<");
  const matchCell = rows[1].split("</td>")[1];
  expect(matchCell).toContain(">Академик</span>");
  expect(matchCell).toContain('aria-label="15:00, Мач · Академик"');
  for (const row of [rows[0], matchCell]) {
    const eventButton = row.match(/<button[^>]+data-match="(?:true|false)"[^>]*>/)?.[0];
    expect(eventButton).toBeDefined();
    expect(eventButton?.includes(' disabled=""')).toBe(detailsActive);
  }
  expect(rows[2]).toMatch(/^Lemon<\/th>/);
  expect(rows[2]).toContain("Ново събитие за Lemon");
  expect(html).not.toContain(">Мачове</th>");
  expect(html).not.toContain("Мач · Без група");
  expect(html).toContain("Мачовете без персонализирана група");
});
