import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock zod to avoid ESM resolution issues with zod v4
vi.mock('zod', () => {
  const z = {
    string: () => z,
    number: () => z,
    object: () => z,
    array: () => z,
    enum: () => z,
    optional: () => z,
    describe: () => z,
  };
  return { z, default: z, ...z };
});

// Mock the 'ai' module to avoid zod ESM resolution issues
vi.mock('ai', () => ({
  generateText: vi.fn(),
  tool: vi.fn((def: unknown) => def),
}));

// Mock supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => ({ data: null, error: null }),
          }),
        }),
      }),
      upsert: () => ({ error: null }),
      insert: () => ({ error: null }),
    }),
  }),
}));

const {
  retryWithBackoff,
  executeWebSearch,
  webSearchFallback,
  _setDelay,
  resolveConflicts,
  confidenceRank,
  storeSources,
} = await import('./researcher');

type WebSearchConfig = Parameters<typeof executeWebSearch>[1] & {};
type SourceDataPoint = Parameters<typeof resolveConflicts>[0][number];

// ── Helpers ─────────────────────────────────────────────────────────

const noDelay = () => Promise.resolve();

beforeEach(() => {
  _setDelay(noDelay);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── retryWithBackoff ────────────────────────────────────────────────

describe('retryWithBackoff', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 }),
    ).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('applies exponential backoff delays (1s, 2s)', async () => {
    const delays: number[] = [];
    _setDelay(async (ms: number) => { delays.push(ms); });

    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1000 }).catch(() => {});
    // Delays: 1000 * 2^0 = 1000, 1000 * 2^1 = 2000 (no delay after last attempt)
    expect(delays).toEqual([1000, 2000]);
  });

  it('does not delay after the last failed attempt', async () => {
    const delays: number[] = [];
    _setDelay(async (ms: number) => { delays.push(ms); });

    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 500 }).catch(() => {});
    expect(delays).toEqual([500]);
  });
});


// ── webSearchFallback ───────────────────────────────────────────────

describe('webSearchFallback', () => {
  it('returns REGULATION_DB data with confidence low for known country', () => {
    const result = webSearchFallback('CO', 2025);
    expect(result.success).toBe(true);
    expect(result.confidence).toBe('low');
    expect(result.usedFallback).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.data).toContain('FALLBACK');
  });

  it('returns failure for unknown country', () => {
    const result = webSearchFallback('ZZ', 2025);
    expect(result.success).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.usedFallback).toBe(true);
    expect(result.sources).toEqual([]);
  });

  it('is case-insensitive for country code', () => {
    const result = webSearchFallback('co', 2025);
    expect(result.success).toBe(true);
    expect(result.confidence).toBe('low');
  });
});

// ── executeWebSearch ────────────────────────────────────────────────

describe('executeWebSearch', () => {
  it('returns web results when fetch succeeds', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { url: 'https://www.mintrabajo.gov.co/test', title: 'MinTrabajo' },
            { url: 'https://www.ugpp.gov.co/test', title: 'UGPP' },
          ],
        },
      }),
    });

    const config: WebSearchConfig = { maxRetries: 1, baseDelayMs: 1, fetchFn: mockFetch as unknown as typeof fetch };
    const result = await executeWebSearch(
      { query: 'salario minimo', countryCode: 'CO', year: 2025 },
      config,
    );

    expect(result.success).toBe(true);
    expect(result.usedFallback).toBe(false);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].url).toContain('mintrabajo');
  });

  it('assigns high confidence when >= 2 government sources', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { url: 'https://www.gob.pe/normas', title: 'Normas Peru' },
            { url: 'https://www.sunat.gob.pe/test', title: 'SUNAT' },
          ],
        },
      }),
    });

    const config: WebSearchConfig = { maxRetries: 1, baseDelayMs: 1, fetchFn: mockFetch as unknown as typeof fetch };
    const result = await executeWebSearch(
      { query: 'regulaciones', countryCode: 'PE', year: 2025 },
      config,
    );

    expect(result.confidence).toBe('high');
  });

  it('assigns medium confidence when 1 government source', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { url: 'https://www.gob.pe/normas', title: 'Normas Peru' },
            { url: 'https://www.example.com/blog', title: 'Blog' },
          ],
        },
      }),
    });

    const config: WebSearchConfig = { maxRetries: 1, baseDelayMs: 1, fetchFn: mockFetch as unknown as typeof fetch };
    const result = await executeWebSearch(
      { query: 'regulaciones', countryCode: 'PE', year: 2025 },
      config,
    );

    expect(result.confidence).toBe('medium');
  });

  it('assigns low confidence when no government sources', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { url: 'https://www.example.com/a', title: 'Blog A' },
            { url: 'https://www.example.com/b', title: 'Blog B' },
          ],
        },
      }),
    });

    const config: WebSearchConfig = { maxRetries: 1, baseDelayMs: 1, fetchFn: mockFetch as unknown as typeof fetch };
    const result = await executeWebSearch(
      { query: 'regulaciones', countryCode: 'CO', year: 2025 },
      config,
    );

    expect(result.confidence).toBe('low');
  });

  it('falls back to REGULATION_DB when fetch fails after retries', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));

    const config: WebSearchConfig = { maxRetries: 3, baseDelayMs: 1, fetchFn: mockFetch as unknown as typeof fetch };
    const result = await executeWebSearch(
      { query: 'salario minimo', countryCode: 'CO', year: 2025 },
      config,
    );

    expect(result.usedFallback).toBe(true);
    expect(result.confidence).toBe('low');
    expect(result.data).toContain('FALLBACK');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('falls back to REGULATION_DB when response is not ok', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const config: WebSearchConfig = { maxRetries: 2, baseDelayMs: 1, fetchFn: mockFetch as unknown as typeof fetch };
    const result = await executeWebSearch(
      { query: 'test', countryCode: 'MX', year: 2025 },
      config,
    );

    expect(result.usedFallback).toBe(true);
    expect(result.confidence).toBe('low');
  });

  it('returns failure fallback for unknown country when web fails', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('fail'));

    const config: WebSearchConfig = { maxRetries: 1, baseDelayMs: 1, fetchFn: mockFetch as unknown as typeof fetch };
    const result = await executeWebSearch(
      { query: 'test', countryCode: 'ZZ', year: 2025 },
      config,
    );

    expect(result.usedFallback).toBe(true);
    expect(result.success).toBe(false);
    expect(result.sources).toEqual([]);
  });
});

// ── confidenceRank ──────────────────────────────────────────────────

describe('confidenceRank', () => {
  it('ranks high > medium > low', () => {
    expect(confidenceRank('high')).toBeGreaterThan(confidenceRank('medium'));
    expect(confidenceRank('medium')).toBeGreaterThan(confidenceRank('low'));
  });

  it('returns consistent values', () => {
    expect(confidenceRank('high')).toBe(3);
    expect(confidenceRank('medium')).toBe(2);
    expect(confidenceRank('low')).toBe(1);
  });
});

// ── resolveConflicts ────────────────────────────────────────────────

describe('resolveConflicts', () => {
  it('returns empty results for empty input', () => {
    const result = resolveConflicts([]);
    expect(result.resolvedValues).toEqual({});
    expect(result.conflicts).toEqual([]);
    expect(result.overallConfidence).toBe('low');
  });

  it('resolves a single data point without conflicts', () => {
    const dataPoints: SourceDataPoint[] = [
      { field: 'smmlv', value: 1423500, confidence: 'high', sourceUrl: 'https://gov.co', sourceTitle: 'MinTrabajo' },
    ];
    const result = resolveConflicts(dataPoints);
    expect(result.resolvedValues).toEqual({ smmlv: 1423500 });
    expect(result.conflicts).toHaveLength(0);
    expect(result.overallConfidence).toBe('high');
  });

  it('selects the value from the highest-confidence source when there is a conflict', () => {
    const dataPoints: SourceDataPoint[] = [
      { field: 'smmlv', value: 1400000, confidence: 'low', sourceUrl: 'https://blog.com', sourceTitle: 'Blog' },
      { field: 'smmlv', value: 1423500, confidence: 'high', sourceUrl: 'https://gov.co', sourceTitle: 'MinTrabajo' },
      { field: 'smmlv', value: 1410000, confidence: 'medium', sourceUrl: 'https://audit.co', sourceTitle: 'Auditoría' },
    ];
    const result = resolveConflicts(dataPoints);
    expect(result.resolvedValues.smmlv).toBe(1423500);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].field).toBe('smmlv');
    expect(result.conflicts[0].selectedConfidence).toBe('high');
    expect(result.conflicts[0].alternatives).toHaveLength(2);
  });

  it('reports no conflict when all sources agree', () => {
    const dataPoints: SourceDataPoint[] = [
      { field: 'healthEmployee', value: 4, confidence: 'high', sourceUrl: 'https://gov.co', sourceTitle: 'Gov' },
      { field: 'healthEmployee', value: 4, confidence: 'medium', sourceUrl: 'https://audit.co', sourceTitle: 'Audit' },
    ];
    const result = resolveConflicts(dataPoints);
    expect(result.resolvedValues.healthEmployee).toBe(4);
    expect(result.conflicts).toHaveLength(0);
  });

  it('handles multiple fields independently', () => {
    const dataPoints: SourceDataPoint[] = [
      { field: 'smmlv', value: 1423500, confidence: 'high', sourceUrl: 'https://gov.co', sourceTitle: 'Gov' },
      { field: 'smmlv', value: 1400000, confidence: 'low', sourceUrl: 'https://blog.com', sourceTitle: 'Blog' },
      { field: 'healthEmployee', value: 4, confidence: 'medium', sourceUrl: 'https://audit.co', sourceTitle: 'Audit' },
    ];
    const result = resolveConflicts(dataPoints);
    expect(result.resolvedValues.smmlv).toBe(1423500);
    expect(result.resolvedValues.healthEmployee).toBe(4);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].field).toBe('smmlv');
  });

  it('breaks ties at the same confidence level by keeping the first occurrence', () => {
    const dataPoints: SourceDataPoint[] = [
      { field: 'smmlv', value: 1423500, confidence: 'high', sourceUrl: 'https://gov1.co', sourceTitle: 'Gov1' },
      { field: 'smmlv', value: 1430000, confidence: 'high', sourceUrl: 'https://gov2.co', sourceTitle: 'Gov2' },
    ];
    const result = resolveConflicts(dataPoints);
    expect(result.resolvedValues.smmlv).toBe(1423500);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].selectedValue).toBe(1423500);
  });

  it('sets overallConfidence to the highest confidence among resolved values', () => {
    const dataPoints: SourceDataPoint[] = [
      { field: 'smmlv', value: 1423500, confidence: 'low', sourceUrl: 'https://blog.com', sourceTitle: 'Blog' },
      { field: 'healthEmployee', value: 4, confidence: 'medium', sourceUrl: 'https://audit.co', sourceTitle: 'Audit' },
    ];
    const result = resolveConflicts(dataPoints);
    expect(result.overallConfidence).toBe('medium');
  });
});

// ── storeSources ────────────────────────────────────────────────────

describe('storeSources', () => {
  it('persists sources with all required fields', async () => {
    const result = await storeSources({
      countryCode: 'CO',
      year: 2025,
      sources: [
        { url: 'https://gov.co/normas', title: 'MinTrabajo', accessDate: '2025-01-15' },
        { url: 'https://ugpp.gov.co', title: 'UGPP', accessDate: '2025-01-15' },
      ],
      confidence: 'high',
      ruleId: 'rule-123',
    });
    expect(result.success).toBe(true);
    expect(result.summary).toContain('2 fuente(s)');
  });

  it('skips sources missing url and reports warning', async () => {
    const result = await storeSources({
      countryCode: 'CO',
      year: 2025,
      sources: [
        { url: '', title: 'No URL', accessDate: '2025-01-15' },
        { url: 'https://gov.co/normas', title: 'MinTrabajo', accessDate: '2025-01-15' },
      ],
      confidence: 'high',
    });
    expect(result.success).toBe(true);
    expect(result.summary).toContain('1 fuente(s)');
    expect(result.detail).toContain('Advertencias');
  });

  it('skips sources missing title and reports warning', async () => {
    const result = await storeSources({
      countryCode: 'CO',
      year: 2025,
      sources: [
        { url: 'https://gov.co/normas', title: '', accessDate: '2025-01-15' },
      ],
      confidence: 'medium',
    });
    expect(result.success).toBe(false);
    expect(result.summary).toContain('No hay fuentes válidas');
  });

  it('returns failure when all sources are invalid', async () => {
    const result = await storeSources({
      countryCode: 'CO',
      year: 2025,
      sources: [
        { url: '', title: '', accessDate: '2025-01-15' },
      ],
      confidence: 'low',
    });
    expect(result.success).toBe(false);
  });

  it('returns failure for empty sources array', async () => {
    const result = await storeSources({
      countryCode: 'CO',
      year: 2025,
      sources: [],
      confidence: 'low',
    });
    expect(result.success).toBe(false);
    expect(result.detail).toContain('vacía');
  });

  it('uppercases country code', async () => {
    const result = await storeSources({
      countryCode: 'co',
      year: 2025,
      sources: [
        { url: 'https://gov.co/normas', title: 'MinTrabajo', accessDate: '2025-01-15' },
      ],
      confidence: 'high',
    });
    expect(result.success).toBe(true);
  });
});
