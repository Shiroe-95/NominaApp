/**
 * Code splitting and lazy loading for heavy components.
 * Dynamic imports for Recharts, PayrollEditor, ReportBuilder, etc.
 *
 * Requirements: 23.2, 23.3, 23.4, 23.6, 23.7
 * @module lib/performance/lazy-components
 */

import { lazy, type ComponentType } from 'react';

// ─── Recharts (heavy charting library) ──────────────────────────────

export const LazyAreaChart = lazy(() =>
  import('recharts').then((m) => ({ default: m.AreaChart as ComponentType<any> })),
);

export const LazyBarChart = lazy(() =>
  import('recharts').then((m) => ({ default: m.BarChart as ComponentType<any> })),
);

export const LazyLineChart = lazy(() =>
  import('recharts').then((m) => ({ default: m.LineChart as ComponentType<any> })),
);

export const LazyPieChart = lazy(() =>
  import('recharts').then((m) => ({ default: m.PieChart as ComponentType<any> })),
);

export const LazyResponsiveContainer = lazy(() =>
  import('recharts').then((m) => ({ default: m.ResponsiveContainer as ComponentType<any> })),
);

// ─── Heavy page components (code-split by route) ───────────────────

export const LazyReportBuilder = lazy(() =>
  import('@/components/reports/ReportBuilder').then((m) => ({ default: m.default })),
);

export const LazyComparativeView = lazy(() =>
  import('@/components/reports/ComparativeView').then((m) => ({ default: m.default })),
);

export const LazyForecastChart = lazy(() =>
  import('@/components/dashboard/ForecastChart').then((m) => ({ default: m.default })),
);

export const LazyAnomalyPanel = lazy(() =>
  import('@/components/dashboard/AnomalyPanel').then((m) => ({ default: m.default })),
);

// ─── Progressive loading helpers ────────────────────────────────────

/**
 * Prefetch a dynamic import so it's ready when the user navigates.
 * Call on hover/focus of navigation links.
 */
export function prefetchComponent(importFn: () => Promise<unknown>): void {
  importFn().catch(() => {
    // Silently ignore prefetch failures
  });
}
