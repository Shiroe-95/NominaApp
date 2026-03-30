/**
 * Reporting feature wiring helpers.
 * Wire ComparativeView, ScheduledReportList, ReportBuilder,
 * PDFExporter, and BenchmarkWidget into existing pages.
 *
 * Requirements: 5.1, 10.1, 27.1, 28.1, 29.2
 * @module lib/integration/wire-reporting
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReportPageConfig {
  showComparativeView: boolean;
  showScheduledReports: boolean;
  showReportBuilder: boolean;
  showBenchmarks: boolean;
}

/**
 * Get report page configuration based on user role.
 */
export function getReportPageConfig(role: string): ReportPageConfig {
  return {
    showComparativeView: role !== 'client',
    showScheduledReports: role === 'admin' || role === 'analyst',
    showReportBuilder: role === 'admin' || role === 'analyst',
    showBenchmarks: true,
  };
}

/**
 * Fetch scheduled reports for the current workspace.
 */
export async function fetchScheduledReports(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<{ id: string; name: string; isActive: boolean; nextRunAt: string | null }[]> {
  const { data } = await supabase
    .from('scheduled_reports')
    .select('id, name, is_active, next_run_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    isActive: r.is_active,
    nextRunAt: r.next_run_at,
  }));
}

/**
 * Trigger PDF export for a report.
 */
export async function triggerPDFExport(
  reportId: string,
  format: 'executive' | 'comparative' | 'custom',
): Promise<{ downloadUrl: string } | { error: string }> {
  try {
    const res = await fetch(`/api/v1/reports/${reportId}/pdf`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return { error: `PDF generation failed: ${res.status}` };
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return { downloadUrl: url };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Fetch benchmark data for the dashboard widget.
 */
export async function fetchBenchmarkData(
  supabase: SupabaseClient,
  params: { industry?: string; countryCode?: string; companySize?: string },
): Promise<{ metric: string; value: number; percentile: number }[]> {
  let query = supabase
    .from('benchmark_data')
    .select('metric_name, metric_value, percentile_rank')
    .eq('is_active', true);

  if (params.industry) query = query.eq('industry', params.industry);
  if (params.countryCode) query = query.eq('country_code', params.countryCode);

  const { data } = await query.limit(20);

  return (data ?? []).map((b) => ({
    metric: b.metric_name,
    value: b.metric_value,
    percentile: b.percentile_rank,
  }));
}
