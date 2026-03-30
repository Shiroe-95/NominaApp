/**
 * Pipeline state types for the payroll upload flow.
 *
 * Tracks the 4-step pipeline: (1) Upload + sheet selection,
 * (2) Mapping with Gyoru, (3) Normative verification, (4) Correction + export.
 *
 * @module pipeline-state
 * @see Requirements 3.1, 3.14
 */

import type { ParsedFile } from '@/components/ui/UploadZone';
import type { MappingResult } from '@/components/ui/MappingAI';
import type { MatrixInput, ValidationReport } from '@/lib/payroll/ruleValidation';
import type { AiValidationReport } from '@/app/api/ai/validation/route';
import type { CorrectionEntry } from '@/components/ui/PayrollEditor';

/** Supported pipeline step numbers. */
export type PipelineStep = 1 | 2 | 3 | 4;

/** Normative rule set for a specific country and year. */
export interface RuleSet {
  /** Descriptive label, e.g. "Normativa Colombia 2026 - Ley 1393" */
  label: string;
  /** Structural fields required for certification */
  requiredFields: string[];
  /** Numeric calculations required for certification */
  requiredCalculations: string[];
  /** Normative checks to display to the user */
  checks: string[];
}

/** Company associated with a payroll upload. */
export interface Company {
  id: string;
  name: string;
  nit: string;
  industry?: string;
}

/** Row from the rules API. */
export interface RuleApiRow {
  country_code: string;
  rule_year: number;
  label: string;
  required_fields: string[];
  required_calculations: string[];
  checks: string[];
}

/** Certification result after evaluating required fields and calculations. */
export interface CertificationResult {
  /** Whether all required fields and calculations are mapped */
  ready: boolean;
  /** Missing required structural fields */
  missingFields: string[];
  /** Missing required calculations */
  missingCalculations: string[];
  /** Coverage percentage (0-100) */
  coverage: number;
}

/** Summary of a recently saved payroll. */
export interface RecentPayroll {
  id: string;
  company_name: string | null;
  country_code: string;
  period_year: number;
  period_month: number;
  rule_label: string | null;
  certification_ready: boolean;
  created_at: string;
}

/** Step result summary for progress display. */
export interface StepResult {
  title: string;
  result: string;
  completed: boolean;
}

/**
 * Complete pipeline state for the upload flow.
 * Tracks all data across the 4 steps.
 */
export interface PipelineState {
  /** Current active step (1-4) */
  step: PipelineStep;
  /** Uploaded and parsed files */
  files: ParsedFile[];
  /** Merged headers from selected sheets */
  headers: string[];
  /** File statistics */
  fileStats: { name: string; rows: number };
  /** Selected country code */
  country: string;
  /** Period year */
  year: number;
  /** Period month */
  month: number;
  /** Selected company ID */
  companyId: string;
  /** Active normative rules by year */
  rulesByYear: Record<number, RuleSet>;
  /** Current active rule */
  activeRule: RuleSet;
  /** Mapping result from Gyoru */
  mappings: MappingResult;
  /** Certification evaluation result */
  certificationResult: CertificationResult;
  /** Parsed data matrices for step 4 */
  parsedMatrices: MatrixInput[] | null;
  /** Math validation report */
  mathValidation: ValidationReport | null;
  /** AI validation report */
  aiValidation: AiValidationReport | null;
  /** Applied corrections */
  corrections: CorrectionEntry[];
}

/** Default empty mapping result. */
export const EMPTY_MAPPING: MappingResult = {
  mappedTargets: [],
  createdTargets: [],
  mappingDetails: [],
};

/** Default empty rule set. */
export const EMPTY_RULE: RuleSet = {
  label: 'Sin regla',
  requiredFields: [],
  requiredCalculations: [],
  checks: [],
};
