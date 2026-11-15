import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import TrainingPlansClient from "./page.client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

const club = { id: "club-id", name: "Тестов клуб" };
const coach = { id: "coach-id", name: "Треньор Иванов" };
const props = {
  clubs: [club],
  defaultClubId: club.id,
  initialPlans: [],
  initialCategories: [],
  scope: "club" as const,
  coachFilter: "",
};

it("renders usable filter labels when the server payload predates plan counts", () => {
  const html = renderToStaticMarkup(<TrainingPlansClient {...props} coaches={[coach]} />);

  expect(html).toContain(">Моите</span></button>");
  expect(html).toContain(">Клуб</span></button>");
  expect(html).toContain(">Всички треньори</option>");
  expect(html).toContain(">Треньор Иванов</option>");
});

it("renders available plan counts, including zero for the signed-in user", () => {
  const html = renderToStaticMarkup(
    <TrainingPlansClient
      {...props}
      scopeCounts={{ mine: 0, club: 54 }}
      coaches={[{ ...coach, _count: { trainingPlans: 52 } }]}
    />,
  );

  expect(html).toContain('>Моите<span class="tp-scope-count"> (0)</span></span></button>');
  expect(html).toContain('>Клуб<span class="tp-scope-count"> (54)</span></span></button>');
  expect(html).toContain(">Всички треньори (54)</option>");
  expect(html).toContain(">Треньор Иванов (52)</option>");
});

it("renders plan timestamps in Sofia time even when the server uses UTC", () => {
  vi.stubEnv("TZ", "UTC");
  try {
    const timestamp = "2026-11-15T13:38:00.000Z";
    const html = renderToStaticMarkup(
      <TrainingPlansClient
        {...props}
        coaches={[]}
        initialPlans={[{
          id: "plan-id",
          title: "Тестов план",
          description: null,
          categoryId: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        }]}
      />,
    );

    expect(html).toContain("Обновен: 15.11.2026 г., 15:38");
  } finally {
    vi.unstubAllEnvs();
  }
});
