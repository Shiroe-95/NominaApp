/**
 * Dynamic Planner — builds adaptive execution plans that evolve based on
 * intermediate agent results.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import type { AgentResult } from '../types';
import type { DynamicPlan, PlanAdaptation, PlanStep } from '../plan-serializer';
import type { UserIntent } from './intent-classifier';

// ── Types ───────────────────────────────────────────────────────────

export interface PlanContext {
  hasPayrollData: boolean;
  countryCode: string;
  /** Optional callback invoked when the plan is dynamically modified (Req 7.5) */
  onPlanUpdated?: (plan: DynamicPlan, adaptation: PlanAdaptation) => void;
}

// ── Plan building ───────────────────────────────────────────────────

/**
 * Builds an initial dynamic execution plan based on the classified intent.
 *
 * This replaces the static `buildPlan()` in master.ts with a plan that
 * carries version tracking and an adaptations log, enabling runtime
 * modifications via `evaluateAndAdapt`.
 */
export function buildDynamicPlan(intent: UserIntent, context: PlanContext): DynamicPlan {
  const steps = getStepsForIntent(intent);

  return {
    steps,
    version: 1,
    adaptations: [],
  };
}

/**
 * Maps a UserIntent to the initial set of plan steps.
 */
function getStepsForIntent(intent: UserIntent): PlanStep[] {
  switch (intent) {
    case 'audit':
      return [
        {
          agentName: 'auditor',
          description: 'Ejecutar validaciones matemáticas y normativas sobre los registros de nómina',
        },
        {
          agentName: 'anomaly-detector',
          inputFrom: 'auditor',
          description: 'Detectar anomalías estadísticas en los datos de nómina tras la auditoría',
        },
      ];

    case 'mapping':
      return [
        {
          agentName: 'mapper',
          description: 'Mapear columnas del archivo a campos estándar del sistema',
        },
      ];

    case 'consultation':
      return [
        {
          agentName: 'payroll-expert',
          description: 'Responder consulta del usuario sobre normativa laboral o cálculos de nómina',
        },
      ];

    case 'correction':
      return [
        {
          agentName: 'auditor',
          description: 'Identificar hallazgos que requieren corrección',
        },
        {
          agentName: 'corrector',
          inputFrom: 'auditor',
          description: 'Proponer correcciones numéricas para los hallazgos detectados',
        },
      ];

    case 'report':
      return [
        {
          agentName: 'auditor',
          description: 'Ejecutar validaciones para generar hallazgos',
        },
        {
          agentName: 'anomaly-detector',
          inputFrom: 'auditor',
          description: 'Detectar anomalías estadísticas en los datos de nómina tras la auditoría',
        },
        {
          agentName: 'writer',
          inputFrom: 'auditor',
          description: 'Generar reporte ejecutivo narrativo a partir de los hallazgos',
        },
      ];

    case 'full-analysis':
      return [
        {
          agentName: 'auditor',
          description: 'Ejecutar validaciones matemáticas y normativas completas',
        },
        {
          agentName: 'anomaly-detector',
          inputFrom: 'auditor',
          description: 'Detectar anomalías estadísticas en los datos de nómina tras la auditoría',
        },
        {
          agentName: 'writer',
          inputFrom: 'auditor',
          description: 'Generar reporte ejecutivo con hallazgos agrupados y priorizados',
        },
        {
          agentName: 'corrector',
          inputFrom: 'auditor',
          description: 'Proponer correcciones numéricas determinísticas',
        },
      ];

    case 'rule-update':
      return [
        {
          agentName: 'researcher',
          description: 'Investigar normativa laboral vigente y detectar cambios regulatorios',
        },
        {
          agentName: 'payroll-expert',
          inputFrom: 'researcher',
          description: 'Actualizar reglas normativas en la base de datos con los hallazgos de la investigación',
        },
      ];

    default:
      return [
        {
          agentName: 'payroll-expert',
          description: 'Responder consulta general del usuario',
        },
      ];
  }
}

// ── Plan adaptation ─────────────────────────────────────────────────

/**
 * Evaluates the result of a completed step and adapts the plan if needed.
 *
 * Adaptation rules (Req 7.1–7.5):
 * - Req 7.2: If auditor finds high-severity findings → add corrector
 * - Req 7.3: If corrector has non-deterministic (skipped) findings → add payroll-expert
 * - Req 7.4: If an agent fails → log error, plan continues (no abort)
 * - Req 7.5: When plan is modified → notify via onPlanUpdated callback
 *
 * Returns a new DynamicPlan (immutable update) with incremented version
 * if any adaptation was applied.
 */
export function evaluateAndAdapt(
  plan: DynamicPlan,
  stepResult: AgentResult,
  stepIndex: number,
  context?: PlanContext,
): DynamicPlan {
  const adaptations: PlanAdaptation[] = [];

  // Req 7.4: If the agent failed, record it but don't modify the plan
  if (!stepResult.success) {
    // The pipeline continues — the caller handles skipping failed steps.
    // No plan modification needed; the error is already in the result.
    return plan;
  }

  const data = stepResult.data as Record<string, unknown> | undefined;

  // Req 7.2: Auditor with high-severity findings → add corrector
  if (stepResult.agentName === 'auditor' && data) {
    const adaptation = checkHighSeverityFindings(plan, data);
    if (adaptation) {
      adaptations.push(adaptation);
    }
    // Req 11.1: After auditor completes, add anomaly-detector if not already in plan
    const anomalyAdaptation = checkAnomalyDetectorNeeded(plan);
    if (anomalyAdaptation) {
      adaptations.push(anomalyAdaptation);
    }
  }

  // Req 7.3: Corrector with non-deterministic findings → add payroll-expert
  if (stepResult.agentName === 'corrector' && data) {
    const adaptation = checkNonDeterministicFindings(plan, data);
    if (adaptation) {
      adaptations.push(adaptation);
    }
  }

  // If no adaptations needed, return the plan unchanged
  if (adaptations.length === 0) {
    return plan;
  }

  // Build the adapted plan with new steps and incremented version
  let newSteps = [...plan.steps];
  for (const adaptation of adaptations) {
    if (adaptation.action === 'add_step' && adaptation.stepAdded) {
      newSteps.push(adaptation.stepAdded);
    }
  }

  const newPlan: DynamicPlan = {
    steps: newSteps,
    version: plan.version + 1,
    adaptations: [...plan.adaptations, ...adaptations],
  };

  // Req 7.5: Notify about plan changes
  if (context?.onPlanUpdated) {
    for (const adaptation of adaptations) {
      context.onPlanUpdated(newPlan, adaptation);
    }
  }

  return newPlan;
}

// ── Adaptation checks ───────────────────────────────────────────────

/**
 * Req 7.2: When auditor detects high-severity findings, add corrector
 * to the plan if not already included.
 */
function checkHighSeverityFindings(
  plan: DynamicPlan,
  data: Record<string, unknown>,
): PlanAdaptation | null {
  const hasHighSeverity = detectHighSeverityFindings(data);
  if (!hasHighSeverity) return null;

  // Check if corrector is already in the plan
  const hasCorrectorStep = plan.steps.some((s) => s.agentName === 'corrector');
  if (hasCorrectorStep) return null;

  const correctorStep: PlanStep = {
    agentName: 'corrector',
    inputFrom: 'auditor',
    description: 'Proponer correcciones para hallazgos de alta severidad detectados',
  };

  return {
    trigger: 'auditor-high-severity-findings',
    action: 'add_step',
    stepAdded: correctorStep,
    reason: 'Se detectaron hallazgos de severidad alta; se agrega corrector automáticamente',
  };
}

/**
 * Req 7.3: When corrector finds non-deterministic (skipped) findings,
 * add payroll-expert to the plan if not already included.
 */
function checkNonDeterministicFindings(
  plan: DynamicPlan,
  data: Record<string, unknown>,
): PlanAdaptation | null {
  const skipped = data['skipped'];
  const hasSkipped = typeof skipped === 'number' && skipped > 0;
  if (!hasSkipped) return null;

  // Check if payroll-expert is already in the plan
  const hasExpertStep = plan.steps.some((s) => s.agentName === 'payroll-expert');
  if (hasExpertStep) return null;

  const expertStep: PlanStep = {
    agentName: 'payroll-expert',
    inputFrom: 'corrector',
    description: 'Proporcionar guía experta para hallazgos no determinísticos omitidos por el corrector',
  };

  return {
    trigger: 'corrector-non-deterministic-findings',
    action: 'add_step',
    stepAdded: expertStep,
    reason: 'El corrector omitió hallazgos no determinísticos; se agrega experto en nómina para guía',
  };
}

/**
 * Req 11.1: After auditor completes, ensure anomaly-detector is in the plan.
 * If not already present, add it as a dynamic step after auditor.
 */
function checkAnomalyDetectorNeeded(plan: DynamicPlan): PlanAdaptation | null {
  const hasAnomalyStep = plan.steps.some((s) => s.agentName === 'anomaly-detector');
  if (hasAnomalyStep) return null;

  const anomalyStep: PlanStep = {
    agentName: 'anomaly-detector',
    inputFrom: 'auditor',
    description: 'Detectar anomalías estadísticas en los datos de nómina tras la auditoría',
  };

  return {
    trigger: 'auditor-complete-add-anomaly-detector',
    action: 'add_step',
    stepAdded: anomalyStep,
    reason: 'Se agrega detección de anomalías automáticamente después de la auditoría',
  };
}

/**
 * Checks whether auditor data contains high-severity findings.
 *
 * Supports two common shapes:
 * 1. `{ summary: { bySeverity: { alta: N } } }` — structured summary
 * 2. `{ findings: [{ severity: 'alta' }] }` — raw findings array
 */
function detectHighSeverityFindings(data: Record<string, unknown>): boolean {
  // Shape 1: summary.bySeverity.alta
  const summary = data['summary'] as Record<string, unknown> | undefined;
  if (summary) {
    const bySeverity = summary['bySeverity'] as Record<string, number> | undefined;
    if (bySeverity && typeof bySeverity['alta'] === 'number' && bySeverity['alta'] > 0) {
      return true;
    }
  }

  // Shape 2: findings array with severity field
  const findings = data['findings'] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(findings)) {
    return findings.some(
      (f) => typeof f === 'object' && f !== null && f['severity'] === 'alta',
    );
  }

  return false;
}
