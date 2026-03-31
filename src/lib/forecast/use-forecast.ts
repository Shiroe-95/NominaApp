/**
 * React hook for forecast data with auto-recalculation.
 *
 * Listens for payroll data changes and triggers forecast recalculation.
 * Supports configurable horizon and parameters.
 *
 * Requirements: 13.2, 13.3
 *
 * @module lib/forecast/use-forecast
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type ForecastBand,
  type CostAlert,
  type HistoricalCost,
  type ForecastParameters,
  type ForecastHorizon,
  type ForecastResult,
  type ForecastChartPoint,
  DEFAULT_PARAMETERS,
  detectCostAlerts,
  buildChartData,
  validateForecastFactors,
} from './forecast-service';

export interface UseForecastOptions {
  workspaceId?: string;
  horizon?: ForecastHorizon;
  parameters?: ForecastParameters;
  autoRecalculate?: boolean;
}

export interface UseForecastReturn {
  chartData: ForecastChartPoint[];
  bands: ForecastBand[];
  alerts: CostAlert[];
  historicalCosts: HistoricalCost[];
  loading: boolean;
  error: string | null;
  recalculate: () => void;
  setHorizon: (h: ForecastHorizon) => void;
  setParameters: (p: ForecastParameters) => void;
  horizon: ForecastHorizon;
  parameters: ForecastParameters;
}

/**
 * Custom event name dispatched when new payroll data is loaded.
 * Components that load payroll data should dispatch this event.
 */
export const PAYROLL_DATA_LOADED_EVENT = 'nominasmart:payroll-data-loaded';

export function useForecast(options: UseForecastOptions = {}): UseForecastReturn {
  const {
    workspaceId = 'default',
    horizon: initialHorizon = 6,
    parameters: initialParams = DEFAULT_PARAMETERS,
    autoRecalculate = true,
  } = options;

  const [horizon, setHorizon] = useState<ForecastHorizon>(initialHorizon);
  const [parameters, setParameters] = useState<ForecastParameters>(initialParams);
  const [historicalCosts, setHistoricalCosts] = useState<HistoricalCost[]>([]);
  const [bands, setBands] = useState<ForecastBand[]>([]);
  const [alerts, setAlerts] = useState<CostAlert[]>([]);
  const [chartData, setChartData] = useState<ForecastChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const calcVersion = useRef(0);

  const fetchHistoricalData = useCallback(async (): Promise<HistoricalCost[]> => {
    const res = await fetch(`/api/v1/forecast?workspace_id=${workspaceId}`);
    if (!res.ok) throw new Error('Failed to fetch forecast data');
    const data = await res.json();
    const forecasts = data.forecasts ?? [];

    if (forecasts.length === 0) {
      // Generate demo data
      const now = new Date();
      return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
        return {
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          totalCost: 50000 + Math.round(Math.random() * 5000) + i * 2000,
        };
      });
    }

    return forecasts.slice(0, 6).reverse().map((f: Record<string, unknown>, i: number) => ({
      year: (f.period_year as number) ?? new Date().getFullYear(),
      month: (f.period_month as number) ?? i + 1,
      totalCost: (f.total_cost as number) ?? 50000 + i * 2000,
    }));
  }, [workspaceId]);

  const calculateForecast = useCallback((
    historical: HistoricalCost[],
    h: ForecastHorizon,
    params: ForecastParameters,
  ) => {
    if (historical.length === 0) {
      setBands([]);
      setAlerts([]);
      setChartData([]);
      return;
    }

    const costs = historical.map(c => c.totalCost);
    const lastCost = costs[costs.length - 1];
    const firstCost = costs[0];
    const lastPeriod = historical[historical.length - 1];
    const slope = costs.length >= 2 ? (lastCost - firstCost) / (costs.length - 1) : 0;

    const newBands: ForecastBand[] = [];
    let cm = lastPeriod.month;
    let cy = lastPeriod.year;

    for (let i = 1; i <= h; i++) {
      cm++;
      if (cm > 12) { cm = 1; cy++; }

      let base = lastCost + slope * i;
      base *= Math.pow(1 + params.growthRate, i);
      base *= Math.pow(1 + params.salaryIncrease, i);

      for (const change of params.regulatoryChanges) {
        if (cm >= change.effectiveMonth) {
          base *= 1 + change.impactPercentage / 100;
        }
      }

      base = Math.max(0, base);

      newBands.push({
        month: cm,
        year: cy,
        optimistic: Math.round(base * 0.85),
        expected: Math.round(base),
        pessimistic: Math.round(base * 1.20),
      });
    }

    const newAlerts = detectCostAlerts(newBands, lastCost);
    const newChartData = buildChartData(historical, newBands);

    setBands(newBands);
    setAlerts(newAlerts);
    setChartData(newChartData);
  }, []);

  const recalculate = useCallback(async () => {
    const version = ++calcVersion.current;
    setLoading(true);
    setError(null);

    try {
      const historical = await fetchHistoricalData();
      if (version !== calcVersion.current) return; // stale

      setHistoricalCosts(historical);
      calculateForecast(historical, horizon, parameters);
    } catch {
      if (version === calcVersion.current) {
        setError('Failed to load forecast data');
      }
    } finally {
      if (version === calcVersion.current) {
        setLoading(false);
      }
    }
  }, [fetchHistoricalData, calculateForecast, horizon, parameters]);

  // Initial load + recalculate on horizon/params change
  useEffect(() => {
    recalculate();
  }, [recalculate]);

  // Auto-recalculate when new payroll data is loaded (13.2)
  useEffect(() => {
    if (!autoRecalculate) return;

    const handler = () => { recalculate(); };
    window.addEventListener(PAYROLL_DATA_LOADED_EVENT, handler);
    return () => window.removeEventListener(PAYROLL_DATA_LOADED_EVENT, handler);
  }, [autoRecalculate, recalculate]);

  return {
    chartData,
    bands,
    alerts,
    historicalCosts,
    loading,
    error,
    recalculate,
    setHorizon,
    setParameters,
    horizon,
    parameters,
  };
}

/**
 * Dispatches the payroll data loaded event to trigger forecast recalculation.
 * Call this after successfully loading new payroll data.
 */
export function notifyPayrollDataLoaded(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PAYROLL_DATA_LOADED_EVENT));
  }
}
