/**
 * Lazy-loaded heavy components for performance optimization.
 *
 * Uses React.lazy + dynamic import to defer loading of:
 * - Recharts (charting library)
 * - PayrollEditor (heavy spreadsheet editor)
 *
 * Requirements: 24.3
 *
 * @module lib/lazy/lazy-components
 */

import { lazy } from 'react';

/**
 * Lazy-loaded Recharts components.
 * Import these instead of directly importing from 'recharts' in page components.
 */
export const LazyAreaChart = lazy(() =>
  import('recharts').then((mod) => ({ default: mod.AreaChart })),
);

export const LazyBarChart = lazy(() =>
  import('recharts').then((mod) => ({ default: mod.BarChart })),
);

export const LazyLineChart = lazy(() =>
  import('recharts').then((mod) => ({ default: mod.LineChart })),
);

export const LazyResponsiveContainer = lazy(() =>
  import('recharts').then((mod) => ({ default: mod.ResponsiveContainer })),
);

/**
 * Maximum number of recent payrolls to query.
 * Prevents excessive data loading.
 *
 * Requirement: 24.5
 */
export const MAX_RECENT_PAYROLLS = 30;
