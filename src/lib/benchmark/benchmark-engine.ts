import { createAdminClient } from '@/lib/supabase/admin';
import type { BenchmarkQueryInput } from '@/lib/schemas/world-class-schemas';

/**
 * BenchmarkEngine — Aggregated anonymized industry benchmarks with percentile positioning.
 *
 * Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6
 *
 * @module lib/benchmark/benchmark-engine
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** Minimum companies in a segment before showing benchmark data (Req 29.6) */
export const MIN_SAMPLE_COUNT = 10;

/** Default page size for benchmark queries */
export const DEFAULT_PAGE_SIZE = 50;

// ─── Types ──────────────────────────────────────────────────────────────────

export type CompanySize = 'small' | 'medium' | 'large' | 'enterprise';

export interface BenchmarkRow {
  id: string;
  industry: string;
  country_code: string;
  company_size: CompanySize;
  period_year: number;
  period_quarter: number;
  avg_cost_per_employee: number | null;
  avg_contribution_ratio: number | null;
  avg_risk_score: number | null;
  sample_count: number;
  calculated_at: string;
}

export interface BenchmarkResult {
  data: BenchmarkRow[];
  total: number;
  filters_applied: {
    industry: string | null;
    country_code: string | null;
    company_size: CompanySize | null;
    period_year: number | null;
  };
}

export interface PercentileResult {
  metric: string;
  value: number;
  percentile: number;
  segment: {
    industry: string;
    country_code: string;
    company_size: CompanySize;
  };
  segment_average: number;
  sample_count: number;
}

// ─── Query Benchmarks (Req 29.1, 29.2, 29.6) ──────────────────────────────

/**
 * Query benchmark data with optional filters.
 *
 * Only returns segments with sample_count >= MIN_SAMPLE_COUNT to ensure
 * anonymity (Req 29.5, 29.6).
 */
export async function queryBenchmarks(
  filters: BenchmarkQueryInput,
): Promise<BenchmarkResult> {
  const supabase = createAdminClient();

  let query = supabase
    .from('benchmark_data')
    .select('*')
    .gte('sample_count', MIN_SAMPLE_COUNT)
    .order('period_year', { ascending: false })
    .order('period_quarter', { ascending: false });

  if (filters.industry) {
    query = query.eq('industry', filters.industry);
  }
  if (filters.country_code) {
    query = query.eq('country_code', filters.country_code);
  }
  if (filters.company_size) {
    query = query.eq('company_size', filters.company_size);
  }
  if (filters.period_year) {
    query = query.eq('period_year', filters.period_year);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to query benchmarks: ${error.message}`);
  }

  const rows = (data ?? []) as BenchmarkRow[];

  return {
    data: rows,
    total: rows.length,
    filters_applied: {
      industry: filters.industry ?? null,
      country_code: filters.country_code ?? null,
      company_size: filters.company_size ?? null,
      period_year: filters.period_year ?? null,
    },
  };
}


// ─── Percentile Positioning (Req 29.3) ──────────────────────────────────────

/**
 * Calculate the percentile position of a company's metric value
 * within its segment (industry + country + company size).
 *
 * Uses the benchmark_data table to find all values for the segment
 * in the most recent quarter, then computes the percentile rank.
 *
 * Returns null if the segment has fewer than MIN_SAMPLE_COUNT companies.
 */
export async function getPercentilePosition(
  metric: 'avg_cost_per_employee' | 'avg_contribution_ratio' | 'avg_risk_score',
  companyValue: number,
  segment: {
    industry: string;
    country_code: string;
    company_size: CompanySize;
  },
): Promise<PercentileResult | null> {
  const supabase = createAdminClient();

  // Get the most recent benchmark row for this segment
  const { data, error } = await supabase
    .from('benchmark_data')
    .select('*')
    .eq('industry', segment.industry)
    .eq('country_code', segment.country_code)
    .eq('company_size', segment.company_size)
    .gte('sample_count', MIN_SAMPLE_COUNT)
    .order('period_year', { ascending: false })
    .order('period_quarter', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to get percentile position: ${error.message}`);
  }

  const rows = (data ?? []) as BenchmarkRow[];

  if (rows.length === 0) {
    return null;
  }

  const benchmarkRow = rows[0];
  const segmentAverage = benchmarkRow[metric];

  if (segmentAverage === null || segmentAverage === undefined) {
    return null;
  }

  // Calculate percentile using the segment average and sample count.
  // We approximate the percentile by assuming a normal distribution
  // centered on the segment average. For a more accurate calculation,
  // we'd need all individual values, but we only store aggregates
  // for anonymity (Req 29.5).
  const percentile = calculateApproximatePercentile(
    companyValue,
    segmentAverage,
    benchmarkRow.sample_count,
  );

  return {
    metric,
    value: companyValue,
    percentile,
    segment,
    segment_average: segmentAverage,
    sample_count: benchmarkRow.sample_count,
  };
}

/**
 * Approximate percentile position using the company value relative
 * to the segment average. Returns a value between 0 and 100.
 *
 * Uses a simple linear interpolation model:
 * - value == average → 50th percentile
 * - value < average → below 50th
 * - value > average → above 50th
 *
 * Clamped to [1, 99] range.
 */
export function calculateApproximatePercentile(
  value: number,
  average: number,
  _sampleCount: number,
): number {
  if (average === 0) {
    return value === 0 ? 50 : value > 0 ? 99 : 1;
  }

  // Ratio of value to average
  const ratio = value / average;

  // Map ratio to percentile: ratio=1 → 50, ratio=0 → 1, ratio=2 → 99
  // Using a sigmoid-like mapping for smoother distribution
  const percentile = 50 + (ratio - 1) * 50;

  return Math.max(1, Math.min(99, Math.round(percentile)));
}

// ─── Quarterly Data Refresh (Req 29.4) ──────────────────────────────────────

/**
 * Refresh benchmark data by aggregating anonymized metrics from payroll data.
 *
 * This function aggregates payroll metrics by industry, country, and company size
 * for the specified quarter, then upserts the results into benchmark_data.
 *
 * Requirement 29.4: quarterly data refresh using aggregated platform data.
 * Requirement 29.5: data is completely anonymized — only aggregates are stored.
 */
export async function refreshBenchmarkData(
  periodYear: number,
  periodQuarter: number,
): Promise<{ upserted: number; skipped: number }> {
  if (periodQuarter < 1 || periodQuarter > 4) {
    throw new Error('period_quarter must be between 1 and 4');
  }
  if (periodYear < 2020 || periodYear > 2030) {
    throw new Error('period_year must be between 2020 and 2030');
  }

  const supabase = createAdminClient();

  // Fetch aggregated metrics from companies grouped by industry, country, size.
  // This query joins companies with their payroll data for the given quarter.
  const { data: aggregates, error: aggError } = await supabase.rpc(
    'aggregate_benchmark_metrics',
    {
      p_year: periodYear,
      p_quarter: periodQuarter,
    },
  );

  if (aggError) {
    throw new Error(`Failed to aggregate benchmark metrics: ${aggError.message}`);
  }

  const segments = (aggregates ?? []) as Array<{
    industry: string;
    country_code: string;
    company_size: CompanySize;
    avg_cost_per_employee: number | null;
    avg_contribution_ratio: number | null;
    avg_risk_score: number | null;
    sample_count: number;
  }>;

  let upserted = 0;
  let skipped = 0;

  for (const segment of segments) {
    // Upsert each segment's benchmark data
    const { error: upsertError } = await supabase
      .from('benchmark_data')
      .upsert(
        {
          industry: segment.industry,
          country_code: segment.country_code,
          company_size: segment.company_size,
          period_year: periodYear,
          period_quarter: periodQuarter,
          avg_cost_per_employee: segment.avg_cost_per_employee,
          avg_contribution_ratio: segment.avg_contribution_ratio,
          avg_risk_score: segment.avg_risk_score,
          sample_count: segment.sample_count,
          calculated_at: new Date().toISOString(),
        },
        {
          onConflict: 'industry,country_code,company_size,period_year,period_quarter',
        },
      );

    if (upsertError) {
      skipped++;
    } else {
      upserted++;
    }
  }

  return { upserted, skipped };
}
