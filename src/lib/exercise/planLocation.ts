export function trainingPlanSearch(clubId: string, coachGroupId?: string) {
  const params = new URLSearchParams({ clubId });
  if (coachGroupId) params.set("coachGroupId", coachGroupId);
  return params;
}
