/**
 * Plan Serializer — serializes/deserializes DynamicPlan to/from JSON.
 *
 * Requirements: 13.1, 13.2, 13.3
 */

// ── Types ───────────────────────────────────────────────────────────

export interface PlanStep {
  agentName: string;
  inputFrom?: string;
  description: string;
}

export interface PlanAdaptation {
  trigger: string;
  action: 'add_step' | 'remove_step' | 'reorder';
  stepAdded?: PlanStep;
  reason: string;
}

export interface DynamicPlan {
  steps: PlanStep[];
  version: number;
  adaptations: PlanAdaptation[];
}

// ── Validation ──────────────────────────────────────────────────────

const VALID_ACTIONS = new Set<PlanAdaptation['action']>([
  'add_step',
  'remove_step',
  'reorder',
]);

function isValidStep(step: unknown): step is PlanStep {
  if (typeof step !== 'object' || step === null) return false;
  const s = step as Record<string, unknown>;
  if (typeof s.agentName !== 'string' || s.agentName.length === 0) return false;
  if (typeof s.description !== 'string') return false;
  if (s.inputFrom !== undefined && typeof s.inputFrom !== 'string') return false;
  return true;
}

function isValidAdaptation(adaptation: unknown): adaptation is PlanAdaptation {
  if (typeof adaptation !== 'object' || adaptation === null) return false;
  const a = adaptation as Record<string, unknown>;
  if (typeof a.trigger !== 'string') return false;
  if (typeof a.action !== 'string' || !VALID_ACTIONS.has(a.action as PlanAdaptation['action']))
    return false;
  if (typeof a.reason !== 'string') return false;
  if (a.stepAdded !== undefined && !isValidStep(a.stepAdded)) return false;
  return true;
}

function isValidDynamicPlan(obj: unknown): obj is DynamicPlan {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.version !== 'number' || !Number.isFinite(o.version)) return false;
  if (!Array.isArray(o.steps) || !o.steps.every(isValidStep)) return false;
  if (!Array.isArray(o.adaptations) || !o.adaptations.every(isValidAdaptation)) return false;
  return true;
}

// ── Serialization ───────────────────────────────────────────────────

/**
 * Serializes a DynamicPlan to a JSON string including all steps,
 * dependencies (inputFrom) and adaptations.
 *
 * Requirement 13.1
 */
export function serializePlan(plan: DynamicPlan): string {
  return JSON.stringify({
    steps: plan.steps.map((step) => {
      const s: Record<string, unknown> = {
        agentName: step.agentName,
        description: step.description,
      };
      if (step.inputFrom !== undefined) {
        s.inputFrom = step.inputFrom;
      }
      return s;
    }),
    version: plan.version,
    adaptations: plan.adaptations.map((a) => {
      const entry: Record<string, unknown> = {
        trigger: a.trigger,
        action: a.action,
        reason: a.reason,
      };
      if (a.stepAdded !== undefined) {
        const sa: Record<string, unknown> = {
          agentName: a.stepAdded.agentName,
          description: a.stepAdded.description,
        };
        if (a.stepAdded.inputFrom !== undefined) {
          sa.inputFrom = a.stepAdded.inputFrom;
        }
        entry.stepAdded = sa;
      }
      return entry;
    }),
  });
}

/**
 * Deserializes a JSON string back into a DynamicPlan, reconstructing
 * the complete plan with all steps, dependencies and adaptations.
 *
 * Requirement 13.2
 * Throws if the JSON is invalid or doesn't match the DynamicPlan shape.
 */
export function deserializePlan(json: string): DynamicPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON: unable to parse plan');
  }

  if (!isValidDynamicPlan(parsed)) {
    throw new Error('Invalid plan structure: missing or malformed fields');
  }

  return {
    steps: parsed.steps.map((step) => {
      const s: PlanStep = {
        agentName: step.agentName,
        description: step.description,
      };
      if (step.inputFrom !== undefined) {
        s.inputFrom = step.inputFrom;
      }
      return s;
    }),
    version: parsed.version,
    adaptations: parsed.adaptations.map((a) => {
      const entry: PlanAdaptation = {
        trigger: a.trigger,
        action: a.action,
        reason: a.reason,
      };
      if (a.stepAdded !== undefined) {
        const sa: PlanStep = {
          agentName: a.stepAdded.agentName,
          description: a.stepAdded.description,
        };
        if (a.stepAdded.inputFrom !== undefined) {
          sa.inputFrom = a.stepAdded.inputFrom;
        }
        entry.stepAdded = sa;
      }
      return entry;
    }),
  };
}
