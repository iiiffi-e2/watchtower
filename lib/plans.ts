import type { Plan } from "@prisma/client";

const PLAN_LIMITS: Record<Plan, number> = {
  FREE: 3,
  PRO: 25,
  AGENCY: 100,
};

export function isPlanEnforced() {
  return process.env.FEATURE_ENFORCE_PLAN === "true";
}

export function canCreateMonitor(plan: Plan, currentCount: number) {
  if (!isPlanEnforced()) {
    return true;
  }
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;
  return currentCount < limit;
}

export function getPlanLimit(plan: Plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;
}
