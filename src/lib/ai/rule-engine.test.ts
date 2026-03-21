import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseChecksToConstants,
  formatConstantsToChecks,
  loadAndValidateRules,
  getHardcodedConstants,
  loadRulesForCountry,
} from './rule-engine';

// ── Mock Supabase ───────────────────────────────────────────────────

const mockSingle = vi.fn();
const mockLimit = vi.fn(() => ({ single: mockSingle }));
const mockEqYear = vi.fn(() => ({ limit: mockLimit }));
const mockEqCountry = vi.fn(() => ({ eq: mockEqYear }));
const mockSelect = vi.fn(() => ({ eq: mockEqCountry }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

// ── parseChecksToConstants ──────────────────────────────────────────

describe('parseChecksToConstants', () => {
  it('extracts SMMLV from Colombian check strings', () => {
    const checks = [
      'SMMLV 2025: $1.423.500',
      'IBC máximo: 25 SMMLV',
      'Salud empleado: 4%',
      'Salud empleador: 8.5%',
      'Pensión empleado: 4%',
      'Pensión empleador: 12%',
    ];

    const result = parseChecksToConstants(checks);

    expect(result.smmlv).toBe(1_423_500);
    expect(result.ibcMax).toBe(25);
    expect(result.healthEmployee).toBe(4);
    expect(result.healthEmployer).toBe(8.5);
    expect(result.pensionEmployee).toBe(4);
    expect(result.pensionEmployer).toBe(12);
  });

  it('extracts transport allowance', () => {
    const checks = ['Auxilio de transporte: $200.000'];
    const result = parseChecksToConstants(checks);
    expect(result.transportAllowance).toBe(200_000);
  });

  it('handles comma-separated currency values', () => {
    const checks = ['SMMLV: $1,423,500'];
    const result = parseChecksToConstants(checks);
    expect(result.smmlv).toBe(1_423_500);
  });

  it('returns empty object for unrecognised checks', () => {
    const checks = ['Some random rule text', 'Another unrelated check'];
    const result = parseChecksToConstants(checks);
    expect(Object.keys(result).length).toBe(0);
  });

  it('handles empty checks array', () => {
    const result = parseChecksToConstants([]);
    expect(result).toEqual({});
  });

  it('extracts SMMLV with alternate format "Salario minimo (SMMLV) 2026: $1.750.905"', () => {
    const checks = ['Salario minimo (SMMLV) 2026: $1.750.905'];
    const result = parseChecksToConstants(checks);
    expect(result.smmlv).toBe(1_750_905);
  });
});

// ── formatConstantsToChecks ─────────────────────────────────────────

describe('formatConstantsToChecks', () => {
  it('substitutes constants back into template strings', () => {
    const constants = { smmlv: 1_500_000, healthEmployee: 4 };
    const template = ['SMMLV 2025: $1.423.500', 'Salud empleado: 4%'];

    const result = formatConstantsToChecks(constants, template);

    expect(result[0]).toContain('1.500.000');
    expect(result[1]).toContain('4%');
  });

  it('leaves unmatched strings unchanged', () => {
    const constants = { smmlv: 1_500_000 };
    const template = ['Some unrelated rule', 'SMMLV 2025: $1.423.500'];

    const result = formatConstantsToChecks(constants, template);

    expect(result[0]).toBe('Some unrelated rule');
    expect(result[1]).toContain('1.500.000');
  });

  it('handles empty template', () => {
    const result = formatConstantsToChecks({ smmlv: 1_000_000 }, []);
    expect(result).toEqual([]);
  });

  it('handles empty constants', () => {
    const template = ['SMMLV 2025: $1.423.500'];
    const result = formatConstantsToChecks({}, template);
    expect(result).toEqual(template);
  });
});


// ── loadAndValidateRules ────────────────────────────────────────────

describe('loadAndValidateRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a CountryRuleEngine when rules exist', async () => {
    const fakeRow = {
      id: 'rule-1',
      country_code: 'CO',
      rule_year: 2025,
      label: 'UGPP Colombia 2025',
      required_fields: ['base_salary', 'ibc_total'],
      required_calculations: ['health_employee_deduction'],
      checks: ['SMMLV 2025: $1.423.500', 'IBC máximo: 25 SMMLV'],
      status: 'approved',
    };

    mockSingle.mockResolvedValue({ data: fakeRow, error: null });

    const engine = await loadAndValidateRules('CO', 2025);

    expect(engine.countryCode).toBe('CO');
    expect(engine.year).toBe(2025);
    expect(engine.label).toBe('UGPP Colombia 2025');
    expect(engine.requiredFields).toEqual(['base_salary', 'ibc_total']);
    expect(engine.checks).toEqual(fakeRow.checks);
    expect(typeof engine.validate).toBe('function');
  });

  it('throws descriptive error when no rules exist', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    await expect(loadAndValidateRules('MX', 2025)).rejects.toThrow(
      'No rules configured for MX 2025',
    );
  });

  it('validate() returns findings for rows with wrong column count', async () => {
    const fakeRow = {
      id: 'rule-2',
      country_code: 'CO',
      rule_year: 2025,
      label: 'UGPP Colombia 2025',
      required_fields: [],
      required_calculations: [],
      checks: ['SMMLV 2025: $1.423.500'],
      status: 'approved',
    };

    mockSingle.mockResolvedValue({ data: fakeRow, error: null });

    const engine = await loadAndValidateRules('CO', 2025);
    const result = engine.validate({
      rows: [['a'], ['b', 'c']],
      headers: ['col1', 'col2'],
      relations: [],
    });

    expect(result.totalFindings).toBe(1);
    expect(result.findings[0].category).toBe('structure');
  });
});

// ── getHardcodedConstants (deprecated fallback) ─────────────────────

describe('getHardcodedConstants', () => {
  it('returns constants for CO 2025', () => {
    const result = getHardcodedConstants('CO', 2025);
    expect(result).toEqual({ smmlv: 1_423_500, ibcMaxSmmlv: 25 });
  });

  it('returns null for unsupported country', () => {
    expect(getHardcodedConstants('MX', 2025)).toBeNull();
  });

  it('returns null for unsupported year', () => {
    expect(getHardcodedConstants('CO', 2020)).toBeNull();
  });
});

// ── loadRulesForCountry (existing API-based loader) ─────────────────

describe('loadRulesForCountry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    const result = await loadRulesForCountry('CO', 2025, 'http://localhost:3000');
    expect(result).toBeNull();
  });

  it('returns null when response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
    } as Response);
    const result = await loadRulesForCountry('CO', 2025, 'http://localhost:3000');
    expect(result).toBeNull();
  });

  it('returns matching rule from API response', async () => {
    const fakeRule = {
      country_code: 'CO',
      rule_year: 2025,
      label: 'UGPP CO 2025',
      required_fields: [],
      required_calculations: [],
      checks: [],
      status: 'approved',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ rules: [fakeRule] }),
    } as Response);

    const result = await loadRulesForCountry('CO', 2025, 'http://localhost:3000');
    expect(result).toEqual(fakeRule);
  });
});
