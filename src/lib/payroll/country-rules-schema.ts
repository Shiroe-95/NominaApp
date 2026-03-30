/**
 * Zod schemas for country_year_rules and supported_countries validation.
 *
 * Requirements: 10.1, 10.2, 10.5
 */
import { z } from 'zod';

// ── Supported Countries ─────────────────────────────────────────────

/** The 7 countries supported by NominaSmart. */
export const SUPPORTED_COUNTRY_CODES = ['CO', 'MX', 'PE', 'CL', 'BR', 'AR', 'US'] as const;
export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

/** Default currency for each supported country. */
export const COUNTRY_CURRENCIES: Record<SupportedCountryCode, string> = {
  CO: 'COP',
  MX: 'MXN',
  PE: 'PEN',
  CL: 'CLP',
  BR: 'BRL',
  AR: 'ARS',
  US: 'USD',
};

/** Default sync frequency for each country. */
export const COUNTRY_SYNC_FREQUENCY: Record<SupportedCountryCode, 'weekly' | 'monthly'> = {
  CO: 'weekly',
  MX: 'weekly',
  PE: 'monthly',
  CL: 'monthly',
  BR: 'weekly',
  AR: 'monthly',
  US: 'monthly',
};

/** Valid rule statuses for the approval workflow. */
export const RULE_STATUSES = ['active', 'pending_review', 'draft'] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

// ── Zod Schemas ─────────────────────────────────────────────────────

/** Schema for validating a country_year_rules entry. */
export const CountryYearRuleSchema = z.object({
  country_code: z.string().length(2),
  rule_year: z.number().int().min(2020).max(2030),
  label: z.string().min(1).max(200),
  required_fields: z.array(z.string()),
  required_calculations: z.array(z.string()),
  checks: z.array(z.string()),
  status: z.enum(RULE_STATUSES).default('draft'),
});

export type CountryYearRuleInput = z.infer<typeof CountryYearRuleSchema>;

/** Schema for validating a supported_countries entry. */
export const SupportedCountrySchema = z.object({
  country_code: z.string().min(2).max(5),
  country_name: z.string().min(1).max(100),
  currency_code: z.string().length(3),
  is_active: z.boolean().default(true),
  sync_frequency: z.enum(['weekly', 'monthly']).default('weekly'),
});

export type SupportedCountryInput = z.infer<typeof SupportedCountrySchema>;

/**
 * Validates a rule object against the CountryYearRuleSchema.
 * Returns the parsed data or throws a ZodError.
 */
export function validateRule(data: unknown): CountryYearRuleInput {
  return CountryYearRuleSchema.parse(data);
}

/**
 * Safely validates a rule object. Returns { success, data, error }.
 */
export function safeValidateRule(data: unknown) {
  return CountryYearRuleSchema.safeParse(data);
}

/**
 * Checks if a country code is one of the 7 supported countries.
 */
export function isSupportedCountry(code: string): code is SupportedCountryCode {
  return SUPPORTED_COUNTRY_CODES.includes(code as SupportedCountryCode);
}
