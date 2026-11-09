export const SPEED_LINES = [8, 16, 24, 33, 42, 54, 65, 76, 85, 93];

export const MONTH_NAMES_BG = [
  "Яну",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Юни",
  "Юли",
  "Авг",
  "Сеп",
  "Окт",
  "Ное",
  "Дек",
];

export const MONTH_NAMES_BG_FULL = [
  "Януари",
  "Февруари",
  "Март",
  "Април",
  "Май",
  "Юни",
  "Юли",
  "Август",
  "Септември",
  "Октомври",
  "Ноември",
  "Декември",
];

export const TRAINING_WEEKDAY_LABELS_BG: Record<number, string> = {
  1: "Понеделник",
  2: "Вторник",
  3: "Сряда",
  4: "Четвъртък",
  5: "Петък",
  6: "Събота",
  7: "Неделя",
};

export const TRAINING_WEEKDAY_SHORT_BG = Array.from({ length: 7 }, (_, index) =>
  new Intl.DateTimeFormat("bg-BG", { weekday: "short" })
    .format(new Date(Date.UTC(2024, 0, 1 + index)))
    .replace(".", ""),
);

export const TRAINING_FIELD_TYPES = new Set([
  "football",
  "basketball",
  "tennis",
  "volleyball",
  "boxing",
  "karate",
  "swimming",
]);

export function normalizeTrainingFieldType(
  raw: unknown,
  fallbackSport?: string | null,
): string {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (TRAINING_FIELD_TYPES.has(value)) return value;

  const sport = String(fallbackSport ?? "")
    .trim()
    .toLowerCase();
  if (/basket|баскетбол/.test(sport)) return "basketball";
  if (/tenis|тенис/.test(sport)) return "tennis";
  if (/voley|волей/.test(sport)) return "volleyball";
  if (/box|бокс/.test(sport)) return "boxing";
  if (/karat|karate|карате|taekwon|таекуондо|judo|джудо/.test(sport))
    return "karate";
  if (/swim|плув|басейн/.test(sport)) return "swimming";
  return "football";
}

export const STATUS_MAP = {
  paid: { label: "ТАКСА: ПЛАТЕНА", cls: "green glow" },
  warning: { label: "ПРЕДСТОЯЩО ПЛАЩАНЕ", cls: "yellow glow-yellow" },
  overdue: { label: "ТАКСА: ДЪЛЖИМА", cls: "red glow-red" },
} as const;

export function parseYearMonth(dateStr: string): {
  year: number;
  month: number;
} {
  const d = new Date(dateStr);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

export function cmpYM(
  a: { year: number; month: number },
  b: { year: number; month: number },
) {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

export function addMonths(ym: { year: number; month: number }, n: number) {
  const d = new Date(ym.year, ym.month + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function toISOMonth(ym: { year: number; month: number }) {
  const mm = String(ym.month + 1).padStart(2, "0");
  return `${ym.year}-${mm}-01T00:00:00.000Z`;
}

export function buildTrainingCalendarMonth(year: number, month: number) {
  const displayMonth = month + 1;
  const daysInMonth = new Date(Date.UTC(year, displayMonth, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const leadingEmptyDays = (firstWeekday + 6) % 7;
  const cells: Array<string | null> = Array.from(
    { length: leadingEmptyDays },
    () => null,
  );

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(
      `${year}-${String(displayMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return {
    key: `${year}-${displayMonth}`,
    label: `${MONTH_NAMES_BG_FULL[month] ?? ""} ${year}`,
    cells,
  };
}

export function formatIsoDateForBgDisplay(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatMonthYearInBgUtc(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const text = parsed.toLocaleDateString("bg-BG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatTrainingDuration(minutes?: number): string {
  if (!Number.isInteger(minutes) || !minutes || minutes < 1) {
    return "";
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
