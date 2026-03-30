import { describe, it, expect, vi } from 'vitest';
import type { AgentContext } from '../types';
import type { LanguageModel } from 'ai';

// Mock the 'ai' module to avoid zod ESM resolution issues
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

// Mock Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}));

const { generateText } = await import('ai');
const {
  createPredictiveAnalyticsAgent,
  calculateMean,
  calculateStdDev,
  detectTrend,
  detectSeasonality,
  generateForecastBands,
  detectCostAlerts,
  calculateTotalCost,
  extractHistoricalCosts,
} = await import('./predictive-analytics');

type ForecastResult = import('./predictive-analytics').ForecastResult;
type ForecastBand = import('./predictive-analytics').ForecastBand;
type ForecastParameters = import('./predictive-analytics').ForecastParameters;

function createMockModel(): LanguageModel {
  return {
    modelId: 'test-model',
    specificationVersion: 'v1',
    provider: 'test',
  } as unknown as LanguageModel;
}

// ── Statistical Helpers ─────────────────────────────────────────────

describe('Statistical Helpers', () => {
  it('calculateMean returns correct average', () => {
    expect(calculateMean([10, 20, 30])).toBe(20);
    expect(calculateMean([100])).toBe(100);
    expect(calculateMean([])).toBe(0);
  });

  it('calculateStdDev returns correct standard deviation', () => {
    expect(calculateStdDev([10, 10, 10])).toBe(0);
    expect(calculateStdDev([])).toBe(0);
    expect(calculateStdDev([5])).toBe(0);
    const stdDev = calculateStdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(stdDev).toBeCloseTo(2.138, 2);
  });
});

// ── Trend Detection ─────────────────────────────────────────────────

describe('detectTrend', () => {
  it('detects increasing trend', () => {
    const result = detectTrend([100, 110, 120, 130, 140]);
    expect(result.direction).toBe('increasing');
    expect(result.slope).toBeGreaterThan(0);
    expect(result.percentageChange).toBeGreaterThan(0);
  });

  it('detects decreasing trend', () => {
    const result = detectTrend([140, 130, 120, 110, 100]);
    expect(result.direction).toBe('decreasing');
    expect(result.slope).toBeLessThan(0);
    expect(result.percentageChange).toBeLessThan(0);
  });

  it('detects stable trend', () => {
    const result = detectTrend([100, 100, 100, 100]);
    expect(result.direction).toBe('stable');
    expect(result.slope).toBe(0);
  });

  it('handles single value', () => {
    const result = detectTrend([100]);
    expect(result.direction).toBe('stable');
    expect(result.slope).toBe(0);
  });

  it('handles empty array', () => {
    const result = detectTrend([]);
    expect(result.direction).toBe('stable');
  });
});

// ── Seasonality Detection ───────────────────────────────────────────

describe('detectSeasonality', () => {
  it('detects seasonality with high variance', () => {
    // Alternating high/low values simulate seasonal pattern
    const result = detectSeasonality([100, 200, 100, 200, 100, 200]);
    expect(result.detected).toBe(true);
    expect(result.coefficientOfVariation).toBeGreaterThan(0);
  });

  it('no seasonality with stable values', () => {
    const result = detectSeasonality([100, 101, 99, 100, 100, 101]);
    expect(result.detected).toBe(false);
  });

  it('handles insufficient data', () => {
    const result = detectSeasonality([100, 200]);
    expect(result.detected).toBe(false);
  });
});

// ── Forecast Band Generation ────────────────────────────────────────

describe('generateForecastBands', () => {
  const defaultParams: ForecastParameters = {
    growthRate: 0,
    salaryIncrease: 0,
    regulatoryChanges: [],
  };

  it('generates correct number of bands', () => {
    const historical = [
      { year: 2024, month: 10, totalCost: 1000000 },
      { year: 2024, month: 11, totalCost: 1050000 },
      { year: 2024, month: 12, totalCost: 1100000 },
    ];

    const bands3 = generateForecastBands(historical, 3, defaultParams);
    expect(bands3.length).toBe(3);

    const bands6 = generateForecastBands(historical, 6, defaultParams);
    expect(bands6.length).toBe(6);

    const bands12 = generateForecastBands(historical, 12, defaultParams);
    expect(bands12.length).toBe(12);
  });

  it('generates bands with correct month/year progression', () => {
    const historical = [
      { year: 2024, month: 11, totalCost: 1000000 },
      { year: 2024, month: 12, totalCost: 1050000 },
    ];

    const bands = generateForecastBands(historical, 3, defaultParams);
    expect(bands[0].month).toBe(1);
    expect(bands[0].year).toBe(2025);
    expect(bands[1].month).toBe(2);
    expect(bands[1].year).toBe(2025);
    expect(bands[2].month).toBe(3);
    expect(bands[2].year).toBe(2025);
  });

  it('optimistic < expected < pessimistic', () => {
    const historical = [
      { year: 2024, month: 10, totalCost: 1000000 },
      { year: 2024, month: 11, totalCost: 1050000 },
      { year: 2024, month: 12, totalCost: 1100000 },
    ];

    const bands = generateForecastBands(historical, 6, defaultParams);
    for (const band of bands) {
      expect(band.optimistic).toBeLessThan(band.expected);
      expect(band.expected).toBeLessThan(band.pessimistic);
    }
  });

  it('applies growth rate', () => {
    const historical = [
      { year: 2024, month: 11, totalCost: 1000000 },
      { year: 2024, month: 12, totalCost: 1000000 },
    ];

    const noGrowth = generateForecastBands(historical, 3, defaultParams);
    const withGrowth = generateForecastBands(historical, 3, {
      ...defaultParams,
      growthRate: 0.05,
    });

    // With growth, costs should be higher
    for (let i = 0; i < 3; i++) {
      expect(withGrowth[i].expected).toBeGreaterThan(noGrowth[i].expected);
    }
  });

  it('applies salary increase', () => {
    const historical = [
      { year: 2024, month: 11, totalCost: 1000000 },
      { year: 2024, month: 12, totalCost: 1000000 },
    ];

    const noIncrease = generateForecastBands(historical, 3, defaultParams);
    const withIncrease = generateForecastBands(historical, 3, {
      ...defaultParams,
      salaryIncrease: 0.03,
    });

    for (let i = 0; i < 3; i++) {
      expect(withIncrease[i].expected).toBeGreaterThan(noIncrease[i].expected);
    }
  });

  it('applies regulatory changes', () => {
    const historical = [
      { year: 2024, month: 11, totalCost: 1000000 },
      { year: 2024, month: 12, totalCost: 1000000 },
    ];

    const noRegulatory = generateForecastBands(historical, 3, defaultParams);
    const withRegulatory = generateForecastBands(historical, 3, {
      ...defaultParams,
      regulatoryChanges: [
        { description: 'New tax', impactPercentage: 5, effectiveMonth: 1 },
      ],
    });

    // January onward should be higher due to regulatory change
    expect(withRegulatory[0].expected).toBeGreaterThan(noRegulatory[0].expected);
  });

  it('returns empty for empty historical data', () => {
    const bands = generateForecastBands([], 3, defaultParams);
    expect(bands).toEqual([]);
  });
});

// ── Cost Alerts ─────────────────────────────────────────────────────

describe('detectCostAlerts', () => {
  it('alerts when projected increase exceeds 15%', () => {
    const bands: ForecastBand[] = [
      { month: 1, year: 2025, optimistic: 900000, expected: 1200000, pessimistic: 1500000 },
    ];

    const alerts = detectCostAlerts(bands, 1000000);
    expect(alerts.length).toBe(1);
    expect(alerts[0].projectedIncrease).toBe(20);
    expect(alerts[0].month).toBe(1);
    expect(alerts[0].year).toBe(2025);
  });

  it('no alert when increase is below threshold', () => {
    const bands: ForecastBand[] = [
      { month: 1, year: 2025, optimistic: 900000, expected: 1100000, pessimistic: 1300000 },
    ];

    const alerts = detectCostAlerts(bands, 1000000);
    expect(alerts.length).toBe(0);
  });

  it('handles zero last cost', () => {
    const bands: ForecastBand[] = [
      { month: 1, year: 2025, optimistic: 900000, expected: 1200000, pessimistic: 1500000 },
    ];

    const alerts = detectCostAlerts(bands, 0);
    expect(alerts.length).toBe(0);
  });

  it('handles empty bands', () => {
    const alerts = detectCostAlerts([], 1000000);
    expect(alerts.length).toBe(0);
  });
});

// ── Data Helpers ────────────────────────────────────────────────────

describe('calculateTotalCost', () => {
  it('sums all numeric columns', () => {
    const rows = [
      { documento: '1', salario: 1000000, bonificacion: 200000 },
      { documento: '2', salario: 1500000, bonificacion: 300000 },
    ];
    const total = calculateTotalCost(rows);
    expect(total).toBe(3000000);
  });

  it('returns 0 for empty rows', () => {
    expect(calculateTotalCost([])).toBe(0);
  });
});

describe('extractHistoricalCosts', () => {
  it('extracts and sorts costs chronologically', () => {
    const data = [
      { year: 2024, month: 12, rows: [{ documento: '1', salario: 2000000 }] },
      { year: 2024, month: 10, rows: [{ documento: '1', salario: 1000000 }] },
      { year: 2024, month: 11, rows: [{ documento: '1', salario: 1500000 }] },
    ];

    const costs = extractHistoricalCosts(data);
    expect(costs.length).toBe(3);
    expect(costs[0].month).toBe(10);
    expect(costs[1].month).toBe(11);
    expect(costs[2].month).toBe(12);
  });

  it('filters out periods with zero cost', () => {
    const data = [
      { year: 2024, month: 10, rows: [{ documento: '1', salario: 1000000 }] },
      { year: 2024, month: 11, rows: [] },
    ];

    const costs = extractHistoricalCosts(data);
    expect(costs.length).toBe(1);
  });
});

// ── Agent Definition ────────────────────────────────────────────────

describe('PredictiveAnalytics Agent', () => {
  const agent = createPredictiveAnalyticsAgent();

  it('returns an AgentDefinition with correct name and tools', () => {
    expect(agent.name).toBe('predictive');
    expect(agent.systemPrompt).toBeTruthy();
    expect(agent.tools).toBeDefined();
    expect(agent.tools!.length).toBe(1);
    expect(agent.tools![0].name).toBe('generateForecast');
  });

  it('returns message when insufficient historical data', async () => {
    const context: AgentContext = {
      countryCode: 'CO',
      year: 2025,
      payrollData: [{ documento: '1', salario: 1000000 }],
    };

    const result = await agent.execute(context, createMockModel());

    expect(result.agentName).toBe('predictive');
    expect(result.success).toBe(true);
    const data = result.data as { forecast: null; message: string };
    expect(data.forecast).toBeNull();
    expect(data.message).toContain('periodos');
  });

  it('generates forecast with sufficient historical data', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Resumen ejecutivo de prueba.',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    } as any);

    const context: AgentContext = {
      countryCode: 'CO',
      year: 2025,
      payrollData: [
        { documento: '1', salario: 2200000 },
      ],
      previousResults: {
        historicalData: [
          { year: 2024, month: 10, rows: [{ documento: '1', salario: 2000000 }] },
          { year: 2024, month: 11, rows: [{ documento: '1', salario: 2050000 }] },
          { year: 2024, month: 12, rows: [{ documento: '1', salario: 2100000 }] },
        ],
      },
    };

    const result = await agent.execute(context, createMockModel());

    expect(result.success).toBe(true);
    const data = result.data as { forecast: ForecastResult; summary: any };
    expect(data.forecast).not.toBeNull();
    expect(data.forecast.bands.length).toBe(6); // default monthsAhead
    expect(data.forecast.countryCode).toBe('CO');
    expect(data.forecast.historicalSummary.periodsAnalyzed).toBeGreaterThanOrEqual(3);
    expect(data.summary.monthsAhead).toBe(6);
  });

  it('respects monthsAhead parameter', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Resumen.',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    } as any);

    const context: AgentContext = {
      countryCode: 'CO',
      year: 2025,
      payrollData: [{ documento: '1', salario: 2200000 }],
      previousResults: {
        forecastParams: { months_ahead: 12 },
        historicalData: [
          { year: 2024, month: 10, rows: [{ documento: '1', salario: 2000000 }] },
          { year: 2024, month: 11, rows: [{ documento: '1', salario: 2050000 }] },
          { year: 2024, month: 12, rows: [{ documento: '1', salario: 2100000 }] },
        ],
      },
    };

    const result = await agent.execute(context, createMockModel());
    const data = result.data as { forecast: ForecastResult };
    expect(data.forecast.bands.length).toBe(12);
  });

  it('measures latency and reports provider', async () => {
    const context: AgentContext = {
      countryCode: 'CO',
      year: 2025,
      payrollData: [],
    };

    const result = await agent.execute(context, createMockModel());
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.providerUsed).toBe('test-model');
  });
});
