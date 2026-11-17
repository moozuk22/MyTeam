import { calculatorHasAccess, type CalculatorGrant } from "./calculatorSubscriptionDomain";

export type TrainingPlanAccess = {
  enabled: boolean;
  canSave: boolean;
  canPrint: boolean;
};

export function trainingPlanAccess(
  grants: CalculatorGrant[],
  roles: readonly string[],
  at = new Date(),
): TrainingPlanAccess {
  const enabled = calculatorHasAccess(grants, at);
  const allowed = roles.includes("admin") || enabled;
  return { enabled, canSave: allowed, canPrint: allowed };
}
