/**
 * Multi-country rule engine abstraction.
 *
 * Loads payroll validation rules dynamically from the `country_year_rules`
 * table via `/api/rules`. Falls back to hardcoded Colombian constants when
 * the DB is unavailable.
 */

// ── Interfaces ──────────────────────────────────────────────────────

export interface ValidationFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  norm: string;
  rowIndex?: number;
  field?: string;
  expected?: unknown;
  actual?: unknown;
}

export interface ValidationResult {
  findings: ValidationFinding[];
  criticalFindings: number;
  totalFindings: number;
}

export interface CountryRuleEngine {
  countryCode: string;
  year: number;
  /** Human-readable label, e.g. "UGPP Colombia 2025" */
  label: string;
  /** Required input fields for this country/year */
  requiredFields: string[];
  /** Required calculated fields */
  requiredCalculations: string[];
  /** Textual rule descriptions (norms, rates, thresholds) */
  checks: string[];
  /** Run validation against payroll data */
  validate(data: {
    rows: unknown[][];
    headers: string[];
    relations: unknown[];
  }): ValidationResult;
}

// ── DB rule shape ───────────────────────────────────────────────────

export interface CountryYearRuleRow {
  country_code: string;
  rule_year: number;
  label: string;
  required_fields: string[];
  required_calculations: string[];
  checks: string[];
}

// ── Hardcoded fallback constants (Colombia) ─────────────────────────

const CO_CONSTANTS: Record<number, { smmlv: number; ibcMaxSmmlv: number }> = {
  2025: { smmlv: 1_423_500, ibcMaxSmmlv: 25 },
  2026: { smmlv: 1_750_905, ibcMaxSmmlv: 25 },
};

export function getHardcodedConstants(
  countryCode: string,
  year: number,
): { smmlv: number; ibcMaxSmmlv: number } | null {
  if (countryCode === 'CO' && CO_CONSTANTS[year]) return CO_CONSTANTS[year];
  return null;
}

// ── Dynamic loader ──────────────────────────────────────────────────

/**
 * Load rules from the database for a given country/year.
 * Returns `null` when the DB is unavailable or no rules exist.
 *
 * @param baseUrl - Absolute origin, e.g. `http://localhost:3000`.
 *                  When omitted the function uses a relative URL which
 *                  only works in browser/edge contexts.
 */
export async function loadRulesForCountry(
  countryCode: string,
  year: number,
  baseUrl?: string,
): Promise<CountryYearRuleRow | null> {
  try {
    const url = baseUrl
      ? `${baseUrl}/api/rules?countryCode=${encodeURIComponent(countryCode)}`
      : `/api/rules?countryCode=${encodeURIComponent(countryCode)}`;

    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;

    const json = (await res.json()) as { rules?: CountryYearRuleRow[] };
    const match = json.rules?.find(
      (r) => r.country_code === countryCode && r.rule_year === year,
    );
    return match ?? null;
  } catch {
    // DB unavailable – caller should fall back to hardcoded rules
    return null;
  }
}
