import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Chainable mock builder ──────────────────────────────────────────

function createChainMock(resolvedValue?: { data: unknown; error: unknown }) {
  const terminal = resolvedValue
    ? vi.fn().mockResolvedValue(resolvedValue)
    : vi.fn();

  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;

  chain.select = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.upsert = vi.fn().mockResolvedValue({ error: null });
  chain.eq = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = terminal;

  return { chain, terminal };
}

// ── Mock Supabase ───────────────────────────────────────────────────

let benchmarkMock: ReturnType<typeof createChainMock>;
const mockRpc = vi.fn();

const mockFrom = vi.fn((table: string) => {
  if (table === 'benchmark_data') return benchmarkMock.chain;
  return {};
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom, rpc: mockRpc }),
}));

import {
  queryBenchmarks,
  getPercentilePosition,
  refreshBenchmarkData,
  calculateApproximatePercentile,
  MIN_SAMPLE_COUNT,
  DEFAULT_PAGE_SIZE,
  type BenchmarkRow,
} from './benchmark-engine';

// ── Helpers ─────────────────────────────────────────────────────────

function makeBenchmarkRow(overrides: Partial<BenchmarkRow> = {}): BenchmarkRow {
  return {
    id: 'bench-001',
    industry: 'technology',
    country_code: 'CO',
    company_size: 'medium',
    period_year: 2025,
    period_quarter: 1,
    avg_cost_per_employee: 5000.0,
    avg_contribution_ratio: 0.125,
    avg_risk_score: 35.5,
    sample_count: 15,
    calculated_at: '2025-04-01T00:00:00Z',
    ...overrides,
  };
}


// ── Tests ───────────────────────────────────────────────────────────

describe('BenchmarkEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    benchmarkMock = createChainMock();
  });

  // ── Constants ─────────────────────────────────────────────────────

  describe('constants', () => {
    it('MIN_SAMPLE_COUNT is 10', () => {
      expect(MIN_SAMPLE_COUNT).toBe(10);
    });

    it('DEFAULT_PAGE_SIZE is 50', () => {
      expect(DEFAULT_PAGE_SIZE).toBe(50);
    });
  });

  // ── queryBenchmarks ───────────────────────────────────────────────

  describe('queryBenchmarks', () => {
    it('returns benchmark data filtered by MIN_SAMPLE_COUNT', async () => {
      const rows = [makeBenchmarkRow()];
      benchmarkMock.chain.order.mockResolvedValueOnce({ data: rows, error: null });

      const result = await queryBenchmarks({});

      expect(result.data).toEqual(rows);
      expect(result.total).toBe(1);
      expect(benchmarkMock.chain.gte).toHaveBeenCalledWith('sample_count', MIN_SAMPLE_COUNT);
    });

    it('applies industry filter', async () => {
      benchmarkMock.chain.order.mockResolvedValueOnce({ data: [], error: null });

      await queryBenchmarks({ industry: 'finance' });

      expect(benchmarkMock.chain.eq).toHaveBeenCalledWith('industry', 'finance');
    });

    it('applies country_code filter', async () => {
      benchmarkMock.chain.order.mockResolvedValueOnce({ data: [], error: null });

      await queryBenchmarks({ country_code: 'MX' });

      expect(benchmarkMock.chain.eq).toHaveBeenCalledWith('country_code', 'MX');
    });

    it('applies company_size filter', async () => {
      benchmarkMock.chain.order.mockResolvedValueOnce({ data: [], error: null });

      await queryBenchmarks({ company_size: 'large' });

      expect(benchmarkMock.chain.eq).toHaveBeenCalledWith('company_size', 'large');
    });

    it('applies period_year filter', async () => {
      benchmarkMock.chain.order.mockResolvedValueOnce({ data: [], error: null });

      await queryBenchmarks({ period_year: 2024 });

      expect(benchmarkMock.chain.eq).toHaveBeenCalledWith('period_year', 2024);
    });

    it('applies all filters simultaneously', async () => {
      benchmarkMock.chain.order.mockResolvedValueOnce({ data: [], error: null });

      await queryBenchmarks({
        industry: 'healthcare',
        country_code: 'BR',
        company_size: 'enterprise',
        period_year: 2025,
      });

      expect(benchmarkMock.chain.eq).toHaveBeenCalledWith('industry', 'healthcare');
      expect(benchmarkMock.chain.eq).toHaveBeenCalledWith('country_code', 'BR');
      expect(benchmarkMock.chain.eq).toHaveBeenCalledWith('company_size', 'enterprise');
      expect(benchmarkMock.chain.eq).toHaveBeenCalledWith('period_year', 2025);
    });

    it('returns filters_applied in result', async () => {
      benchmarkMock.chain.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await queryBenchmarks({ industry: 'tech' });

      expect(result.filters_applied).toEqual({
        industry: 'tech',
        country_code: null,
        company_size: null,
        period_year: null,
      });
    });

    it('returns empty data when no matches', async () => {
      benchmarkMock.chain.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await queryBenchmarks({});

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('throws on Supabase query error', async () => {
      benchmarkMock.chain.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection refused' },
      });

      await expect(queryBenchmarks({})).rejects.toThrow(
        'Failed to query benchmarks: connection refused',
      );
    });
  });

  // ── getPercentilePosition ─────────────────────────────────────────

  describe('getPercentilePosition', () => {
    it('returns percentile for a company metric value', async () => {
      const row = makeBenchmarkRow({ avg_cost_per_employee: 5000, sample_count: 20 });
      benchmarkMock.terminal.mockResolvedValueOnce({ data: [row], error: null });

      const result = await getPercentilePosition(
        'avg_cost_per_employee',
        5000,
        { industry: 'technology', country_code: 'CO', company_size: 'medium' },
      );

      expect(result).not.toBeNull();
      expect(result!.metric).toBe('avg_cost_per_employee');
      expect(result!.value).toBe(5000);
      expect(result!.percentile).toBe(50); // equal to average
      expect(result!.segment_average).toBe(5000);
      expect(result!.sample_count).toBe(20);
    });

    it('returns higher percentile for above-average value', async () => {
      const row = makeBenchmarkRow({ avg_cost_per_employee: 5000 });
      benchmarkMock.terminal.mockResolvedValueOnce({ data: [row], error: null });

      const result = await getPercentilePosition(
        'avg_cost_per_employee',
        6000,
        { industry: 'technology', country_code: 'CO', company_size: 'medium' },
      );

      expect(result).not.toBeNull();
      expect(result!.percentile).toBeGreaterThan(50);
    });

    it('returns lower percentile for below-average value', async () => {
      const row = makeBenchmarkRow({ avg_cost_per_employee: 5000 });
      benchmarkMock.terminal.mockResolvedValueOnce({ data: [row], error: null });

      const result = await getPercentilePosition(
        'avg_cost_per_employee',
        4000,
        { industry: 'technology', country_code: 'CO', company_size: 'medium' },
      );

      expect(result).not.toBeNull();
      expect(result!.percentile).toBeLessThan(50);
    });

    it('returns null when no benchmark data for segment', async () => {
      benchmarkMock.terminal.mockResolvedValueOnce({ data: [], error: null });

      const result = await getPercentilePosition(
        'avg_cost_per_employee',
        5000,
        { industry: 'unknown', country_code: 'XX', company_size: 'small' },
      );

      expect(result).toBeNull();
    });

    it('returns null when metric value is null in benchmark', async () => {
      const row = makeBenchmarkRow({ avg_cost_per_employee: null });
      benchmarkMock.terminal.mockResolvedValueOnce({ data: [row], error: null });

      const result = await getPercentilePosition(
        'avg_cost_per_employee',
        5000,
        { industry: 'technology', country_code: 'CO', company_size: 'medium' },
      );

      expect(result).toBeNull();
    });

    it('filters by MIN_SAMPLE_COUNT', async () => {
      benchmarkMock.terminal.mockResolvedValueOnce({ data: [], error: null });

      await getPercentilePosition(
        'avg_risk_score',
        30,
        { industry: 'tech', country_code: 'CO', company_size: 'small' },
      );

      expect(benchmarkMock.chain.gte).toHaveBeenCalledWith('sample_count', MIN_SAMPLE_COUNT);
    });

    it('throws on Supabase error', async () => {
      benchmarkMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'timeout' },
      });

      await expect(
        getPercentilePosition(
          'avg_cost_per_employee',
          5000,
          { industry: 'tech', country_code: 'CO', company_size: 'medium' },
        ),
      ).rejects.toThrow('Failed to get percentile position: timeout');
    });
  });

  // ── calculateApproximatePercentile ────────────────────────────────

  describe('calculateApproximatePercentile', () => {
    it('returns 50 when value equals average', () => {
      expect(calculateApproximatePercentile(100, 100, 20)).toBe(50);
    });

    it('returns above 50 when value is above average', () => {
      expect(calculateApproximatePercentile(150, 100, 20)).toBeGreaterThan(50);
    });

    it('returns below 50 when value is below average', () => {
      expect(calculateApproximatePercentile(50, 100, 20)).toBeLessThan(50);
    });

    it('clamps to minimum of 1', () => {
      expect(calculateApproximatePercentile(-100, 100, 20)).toBeGreaterThanOrEqual(1);
    });

    it('clamps to maximum of 99', () => {
      expect(calculateApproximatePercentile(1000, 100, 20)).toBeLessThanOrEqual(99);
    });

    it('handles zero average with zero value', () => {
      expect(calculateApproximatePercentile(0, 0, 20)).toBe(50);
    });

    it('handles zero average with positive value', () => {
      expect(calculateApproximatePercentile(100, 0, 20)).toBe(99);
    });

    it('handles zero average with negative value', () => {
      expect(calculateApproximatePercentile(-100, 0, 20)).toBe(1);
    });
  });

  // ── refreshBenchmarkData ──────────────────────────────────────────

  describe('refreshBenchmarkData', () => {
    it('calls RPC and upserts aggregated segments', async () => {
      const segments = [
        {
          industry: 'technology',
          country_code: 'CO',
          company_size: 'medium',
          avg_cost_per_employee: 5000,
          avg_contribution_ratio: 0.125,
          avg_risk_score: 35,
          sample_count: 15,
        },
        {
          industry: 'finance',
          country_code: 'MX',
          company_size: 'large',
          avg_cost_per_employee: 7000,
          avg_contribution_ratio: 0.15,
          avg_risk_score: 28,
          sample_count: 22,
        },
      ];

      mockRpc.mockResolvedValueOnce({ data: segments, error: null });
      benchmarkMock.chain.upsert.mockResolvedValue({ error: null });

      const result = await refreshBenchmarkData(2025, 1);

      expect(mockRpc).toHaveBeenCalledWith('aggregate_benchmark_metrics', {
        p_year: 2025,
        p_quarter: 1,
      });
      expect(result.upserted).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it('counts skipped segments on upsert error', async () => {
      const segments = [
        {
          industry: 'tech',
          country_code: 'CO',
          company_size: 'small',
          avg_cost_per_employee: 3000,
          avg_contribution_ratio: 0.1,
          avg_risk_score: 40,
          sample_count: 12,
        },
      ];

      mockRpc.mockResolvedValueOnce({ data: segments, error: null });
      benchmarkMock.chain.upsert.mockResolvedValueOnce({
        error: { message: 'constraint violation' },
      });

      const result = await refreshBenchmarkData(2025, 2);

      expect(result.upserted).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('throws on invalid quarter', async () => {
      await expect(refreshBenchmarkData(2025, 0)).rejects.toThrow(
        'period_quarter must be between 1 and 4',
      );
      await expect(refreshBenchmarkData(2025, 5)).rejects.toThrow(
        'period_quarter must be between 1 and 4',
      );
    });

    it('throws on invalid year', async () => {
      await expect(refreshBenchmarkData(2019, 1)).rejects.toThrow(
        'period_year must be between 2020 and 2030',
      );
      await expect(refreshBenchmarkData(2031, 1)).rejects.toThrow(
        'period_year must be between 2020 and 2030',
      );
    });

    it('throws on RPC error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'function not found' },
      });

      await expect(refreshBenchmarkData(2025, 1)).rejects.toThrow(
        'Failed to aggregate benchmark metrics: function not found',
      );
    });

    it('handles empty aggregates', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const result = await refreshBenchmarkData(2025, 3);

      expect(result.upserted).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });
});
