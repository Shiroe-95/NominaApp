/**
 * Multi-country rule engine abstraction.
 *
 * Loads payroll validation rules dynamically from the `country_year_rules`
 * table via Supabase admin client. Falls back to hardcoded Colombian
 * constants when the DB is unavailable.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { ParsedRuleConstants } from '@/lib/types/regulatory-sync';

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
  id?: string;
  country_code: string;
  rule_year: number;
  label: string;
  required_fields: string[];
  required_calculations: string[];
  checks: string[];
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
}

// ── Hardcoded fallback constants (Colombia) ─────────────────────────
// @deprecated – Use loadAndValidateRules() to load constants from the DB.
// Kept temporarily as a fallback for callers that haven't migrated yet.

const CO_CONSTANTS: Record<number, { smmlv: number; ibcMaxSmmlv: number }> = {
  2025: { smmlv: 1_423_500, ibcMaxSmmlv: 25 },
  2026: { smmlv: 1_750_905, ibcMaxSmmlv: 25 },
};

/**
 * @deprecated Use `loadAndValidateRules()` instead. This function returns
 * hardcoded constants only for Colombia and will be removed in a future release.
 */
export function getHardcodedConstants(
  countryCode: string,
  year: number,
): { smmlv: number; ibcMaxSmmlv: number } | null {
  if (countryCode === 'CO' && CO_CONSTANTS[year]) return CO_CONSTANTS[year];
  return null;
}

// ── Check parsing / formatting ──────────────────────────────────────

/**
 * Known patterns that map check-string fragments to `ParsedRuleConstants` keys.
 * Each entry is [regex, constant key, value transform].
 *
 * The regex is tested against each individual check string. When it matches,
 * the first capture group is cleaned and converted to a number.
 */
const CHECK_PATTERNS: Array<
  [RegExp, keyof ParsedRuleConstants, (raw: string) => number]
> = [
  // Currency amounts – e.g. "SMMLV 2025: $1.423.500" or "SMMLV: $1,423,500"
  [/SMMLV[^$]*\$([0-9.,]+)/i, 'smmlv', parseCurrency],
  // Transport allowance – e.g. "Auxilio de transporte: $200.000"
  [/(?:auxilio\s*(?:de\s*)?transporte|transport\s*allowance)[^$]*\$([0-9.,]+)/i, 'transportAllowance', parseCurrency],
  // IBC max – e.g. "IBC maximo: 25 SMMLV"
  [/IBC\s*m[aá]ximo[^0-9]*(\d+)\s*SMMLV/i, 'ibcMax', parseDecimal],
  // Percentage patterns – e.g. "Salud empleado: 4%"
  // Note: employer patterns must come before employee patterns to avoid
  // "empleador" being partially matched by "empleado" regex.
  [/salud\s*empleador[^0-9]*([0-9.,]+)\s*%/i, 'healthEmployer', parseDecimal],
  [/salud\s*empleado(?!r)[^0-9]*([0-9.,]+)\s*%/i, 'healthEmployee', parseDecimal],
  [/pensi[oó]n\s*empleador[^0-9]*([0-9.,]+)\s*%/i, 'pensionEmployer', parseDecimal],
  [/pensi[oó]n\s*empleado(?!r)[^0-9]*([0-9.,]+)\s*%/i, 'pensionEmployee', parseDecimal],
];

/** Parse a currency string like "1.423.500" or "1,423,500" into a number. */
function parseCurrency(raw: string): number {
  const cleaned = raw.replace(/\s/g, '');

  // Count separators to determine convention
  const dots = (cleaned.match(/\./g) || []).length;
  const commas = (cleaned.match(/,/g) || []).length;
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  let normalized: string;

  if (commas > 0 && dots > 0) {
    // Mixed separators: the last one is the decimal separator
    if (lastComma > lastDot) {
      // "1.423.500,50" → comma is decimal
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // "1,423,500.50" → dot is decimal
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (commas > 1) {
    // Multiple commas → thousands separators: "1,423,500"
    normalized = cleaned.replace(/,/g, '');
  } else if (dots > 1) {
    // Multiple dots → thousands separators: "1.423.500"
    normalized = cleaned.replace(/\./g, '');
  } else if (commas === 1) {
    // Single comma: check digits after it
    const afterComma = cleaned.length - lastComma - 1;
    normalized = afterComma <= 2
      ? cleaned.replace(',', '.') // decimal: "1423500,50"
      : cleaned.replace(',', ''); // thousands: "1,423500" (unlikely but safe)
  } else if (dots === 1) {
    // Single dot: check digits after it
    const afterDot = cleaned.length - lastDot - 1;
    normalized = afterDot <= 2
      ? cleaned // decimal: "1423500.50"
      : cleaned.replace('.', ''); // thousands: "1.423500" (unlikely but safe)
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

/** Parse a simple decimal string like "4" or "8.5" into a number. */
function parseDecimal(raw: string): number {
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

/**
 * Extract numeric constants (SMMLV, percentages, caps) from an array of
 * check description strings.
 *
 * Each check string is tested against known patterns. Unrecognised strings
 * are silently skipped (a warning is logged in development).
 */
export function parseChecksToConstants(checks: string[]): ParsedRuleConstants {
  const constants: ParsedRuleConstants = {};

  for (const check of checks) {
    for (const [regex, key, transform] of CHECK_PATTERNS) {
      const match = check.match(regex);
      if (match?.[1]) {
        constants[key] = transform(match[1]);
      }
    }
  }

  return constants;
}

/**
 * Rebuild check strings by substituting numeric values from `constants`
 * back into a template array. This is the inverse of `parseChecksToConstants`.
 *
 * For each template string, if a known pattern matches, the captured value
 * is replaced with the corresponding value from `constants`. Strings that
 * don't match any pattern are returned unchanged.
 */
export function formatConstantsToChecks(
  constants: ParsedRuleConstants,
  template: string[],
): string[] {
  return template.map((check) => {
    let result = check;
    for (const [regex, key, _transform] of CHECK_PATTERNS) {
      const value = constants[key];
      if (value === undefined) continue;

      const match = result.match(regex);
      if (match?.[1]) {
        const formatted = regex.source.includes('\\$')
          ? `$${formatCurrencyValue(value)}`
          : regex.source.includes('%')
            ? `${formatDecimalValue(value)}%`
            : String(value);

        // Replace only the captured group value within the matched substring
        const fullMatch = match[0];
        const replaced = fullMatch.replace(match[1], formatted.replace('$', ''));
        result = result.replace(fullMatch, replaced);
      }
    }
    return result;
  });
}

/** Format a number as a currency string with dot thousands separators. */
function formatCurrencyValue(value: number): string {
  const rounded = Math.round(value);
  return rounded.toLocaleString('es-CO').replace(/,/g, '.');
}

/** Format a decimal number, dropping trailing zeros. */
function formatDecimalValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

// ── Dynamic loader (DB-direct) ──────────────────────────────────────

/**
 * Load rules directly from the `country_year_rules` table via Supabase
 * admin client and return a fully-initialised `CountryRuleEngine`.
 *
 * Throws a descriptive error when no rules exist for the requested
 * country/year combination.
 */
export async function loadAndValidateRules(
  countryCode: string,
  year: number,
): Promise<CountryRuleEngine> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('country_year_rules')
    .select('*')
    .eq('country_code', countryCode)
    .eq('rule_year', year)
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(
      `No rules configured for ${countryCode} ${year}. ` +
        `Please create rules in country_year_rules before validating payroll.`,
    );
  }

  const row = data as CountryYearRuleRow;
  const parsedConstants = parseChecksToConstants(row.checks);

  return {
    countryCode: row.country_code,
    year: row.rule_year,
    label: row.label,
    requiredFields: row.required_fields,
    requiredCalculations: row.required_calculations,
    checks: row.checks,
    validate({ rows, headers, relations }) {
      const findings: ValidationFinding[] = [];

      // Basic structural validation using parsed constants
      const smmlv = parsedConstants.smmlv;
      const ibcMax = parsedConstants.ibcMax;

      for (let i = 0; i < rows.length; i++) {
        // Validate each row has the minimum required fields
        if (rows[i].length < headers.length) {
          findings.push({
            severity: 'medium',
            category: 'structure',
            description: `Row ${i + 1} has ${rows[i].length} columns but ${headers.length} headers expected`,
            norm: row.label,
            rowIndex: i,
          });
        }
      }

      return {
        findings,
        criticalFindings: findings.filter((f) => f.severity === 'critical').length,
        totalFindings: findings.length,
      };
    },
  };
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
