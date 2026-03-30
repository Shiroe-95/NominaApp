/**
 * Plan limits enforcement for NominaSmart subscription tiers.
 *
 * Defines the limits for each plan (Básico, Profesional, Empresarial)
 * and provides a function to check if an operation exceeds the plan limits.
 *
 * Requirements: 15.3, 15.4, 15.5, 15.7
 *
 * @module lib/plans/plan-limits
 */

// ── Plan definitions ────────────────────────────────────────────────

export type PlanTier = 'basic' | 'professional' | 'enterprise';

export interface PlanLimits {
  maxEmployees: number;
  maxUploadsPerMonth: number;
  maxProviders: number;
  maxCountries: number;
  allowedAgents: string[];
  label: string;
}

export const PLAN_DEFINITIONS: Record<PlanTier, PlanLimits> = {
  basic: {
    maxEmployees: 50,
    maxUploadsPerMonth: 5,
    maxProviders: 1,
    maxCountries: 1,
    allowedAgents: ['auditor', 'mapper'],
    label: 'Básico',
  },
  professional: {
    maxEmployees: 500,
    maxUploadsPerMonth: Infinity,
    maxProviders: 3,
    maxCountries: 3,
    allowedAgents: ['auditor', 'mapper', 'corrector', 'writer', 'payroll-expert', 'master', 'researcher'],
    label: 'Profesional',
  },
  enterprise: {
    maxEmployees: Infinity,
    maxUploadsPerMonth: Infinity,
    maxProviders: Infinity,
    maxCountries: Infinity,
    allowedAgents: ['auditor', 'mapper', 'corrector', 'writer', 'payroll-expert', 'master', 'researcher'],
    label: 'Empresarial',
  },
};

// ── Limit check types ───────────────────────────────────────────────

export type LimitDimension = 'employees' | 'uploads' | 'providers' | 'countries' | 'agents';

export interface LimitCheckResult {
  allowed: boolean;
  message?: string;
  limit?: number;
  current?: number;
}

// ── Check functions ─────────────────────────────────────────────────

/**
 * Checks if an operation is within the plan limits for a given dimension.
 *
 * @param plan - The user's current plan tier.
 * @param dimension - The dimension to check (employees, uploads, etc.).
 * @param currentCount - The current count for the dimension.
 * @param agentName - The agent name (only used for 'agents' dimension).
 * @returns A LimitCheckResult indicating if the operation is allowed.
 */
export function checkPlanLimit(
  plan: PlanTier,
  dimension: LimitDimension,
  currentCount: number = 0,
  agentName?: string,
): LimitCheckResult {
  const limits = PLAN_DEFINITIONS[plan];
  if (!limits) {
    return { allowed: false, message: `Plan desconocido: ${plan}` };
  }

  switch (dimension) {
    case 'employees': {
      const allowed = currentCount < limits.maxEmployees;
      return {
        allowed,
        limit: limits.maxEmployees,
        current: currentCount,
        message: allowed
          ? undefined
          : `El plan ${limits.label} permite hasta ${limits.maxEmployees} empleados. Actualmente tienes ${currentCount}. Actualiza tu plan para continuar.`,
      };
    }

    case 'uploads': {
      if (limits.maxUploadsPerMonth === Infinity) {
        return { allowed: true, limit: Infinity, current: currentCount };
      }
      const allowed = currentCount < limits.maxUploadsPerMonth;
      return {
        allowed,
        limit: limits.maxUploadsPerMonth,
        current: currentCount,
        message: allowed
          ? undefined
          : `El plan ${limits.label} permite hasta ${limits.maxUploadsPerMonth} cargas por mes. Ya has realizado ${currentCount}. Actualiza tu plan para continuar.`,
      };
    }

    case 'providers': {
      if (limits.maxProviders === Infinity) {
        return { allowed: true, limit: Infinity, current: currentCount };
      }
      const allowed = currentCount < limits.maxProviders;
      return {
        allowed,
        limit: limits.maxProviders,
        current: currentCount,
        message: allowed
          ? undefined
          : `El plan ${limits.label} permite hasta ${limits.maxProviders} proveedor(es) de IA. Actualiza tu plan para agregar más.`,
      };
    }

    case 'countries': {
      if (limits.maxCountries === Infinity) {
        return { allowed: true, limit: Infinity, current: currentCount };
      }
      const allowed = currentCount < limits.maxCountries;
      return {
        allowed,
        limit: limits.maxCountries,
        current: currentCount,
        message: allowed
          ? undefined
          : `El plan ${limits.label} permite hasta ${limits.maxCountries} país(es). Actualiza tu plan para agregar más.`,
      };
    }

    case 'agents': {
      if (!agentName) {
        return { allowed: true };
      }
      const allowed = limits.allowedAgents.includes(agentName);
      return {
        allowed,
        message: allowed
          ? undefined
          : `El agente "${agentName}" no está disponible en el plan ${limits.label}. Actualiza tu plan para acceder a todos los agentes.`,
      };
    }

    default:
      return { allowed: true };
  }
}

/**
 * Returns the plan tier for a given plan name string.
 * Defaults to 'basic' if unrecognized.
 */
export function resolvePlanTier(planName?: string | null): PlanTier {
  if (!planName) return 'basic';
  const normalized = planName.toLowerCase().trim();
  if (normalized === 'professional' || normalized === 'profesional' || normalized === 'pro') {
    return 'professional';
  }
  if (normalized === 'enterprise' || normalized === 'empresarial') {
    return 'enterprise';
  }
  return 'basic';
}
