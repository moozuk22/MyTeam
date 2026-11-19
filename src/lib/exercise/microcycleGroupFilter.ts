/** Client-safe search and coach grouping for the microcycle group cards. */
export type FilterGroup = { key: string; name: string; coach?: { id: string; name: string } | null };
export type CoachSection<T extends FilterGroup> = { id: string; name: string; groups: T[]; matchesCoach: boolean };
export const NO_COACH_ID = "none";
const collator = new Intl.Collator("bg", { numeric: true, sensitivity: "base" });
const normalize = (value: string) => value.trim().toLocaleLowerCase("bg-BG").replace(/\s+/g, " ");
export const matchesQuery = (value: string, query: string) => normalize(value).includes(normalize(query));

/** Groups whose name contains the query, in natural Bulgarian order. */
export function filterGroups<T extends FilterGroup>(groups: T[], query: string) {
  return groups.filter(g => matchesQuery(g.name, query)).sort((a, b) => collator.compare(a.name, b.name));
}

/**
 * Coach sections in natural order, with „Без треньор“ last.
 * A coach whose name matches the query keeps all groups; other coaches keep only matching groups and drop out when none match.
 */
export function coachSections<T extends FilterGroup>(groups: T[], query: string): CoachSection<T>[] {
  const sections = new Map<string, CoachSection<T>>();
  for (const group of groups) {
    const id = group.coach?.id ?? NO_COACH_ID;
    const section = sections.get(id) ?? { id, name: group.coach?.name ?? "Без треньор", groups: [], matchesCoach: false };
    section.groups.push(group);
    sections.set(id, section);
  }
  return [...sections.values()]
    .map(s => {
      const matchesCoach = s.id !== NO_COACH_ID && query.trim() !== "" && matchesQuery(s.name, query);
      return { ...s, matchesCoach, groups: matchesCoach ? filterGroups(s.groups, "") : filterGroups(s.groups, query) };
    })
    .filter(s => s.groups.length > 0)
    .sort((a, b) => a.id === NO_COACH_ID ? 1 : b.id === NO_COACH_ID ? -1 : collator.compare(a.name, b.name));
}
