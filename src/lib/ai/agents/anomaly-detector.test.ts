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
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
                  })),
                  data: [],
                  error: null,
                })),
              })),
            })),
          })),
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
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
  createAnomalyDetectorAgent,
  detectOutliers,
  detectInterPeriodVariations,
  detectRoundingPatterns,
  compareAgainstBenchmarks,
  calculateMean,
  calculateStdDev,
  calculateZScore,
} = await import('./anomaly-detector');

type AnomalyResult = import('./anomaly-detector').AnomalyResult;

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
    // [2, 4, 4, 4, 5, 5, 7, 9] → stddev ≈ 2.138
    const stdDev = calculateStdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(stdDev).toBeCloseTo(2.138, 2);
  });

  it('calculateZScore returns correct z-score', () => {
    expect(calculateZScore(10, 10, 2)).toBe(0);
    expect(calculateZScore(12, 10, 2)).toBe(1);
    expect(calculateZScore(8, 10, 2)).toBe(-1);
    expect(calculateZScore(10, 10, 0)).toBe(0); // stdDev 0 → 0
  });
});

// ── Outlier Detection ───────────────────────────────────────────────

describe('detectOutliers', () => {
  it('detects outlier values with high z-score', () => {
    const currentRows = [
      { documento: '123', salario: 10000000 }, // way above historical
    ];
    const historicalData = [
      { year: 2024, month: 6, rows: [{ documento: '123', salario: 2000000 }] },
      { year: 2024, month: 5, rows: [{ documento: '123', salario: 2100000 }] },
      { year: 2024, month: 4, rows: [{ documento: '123', salario: 1900000 }] },
      { year: 2024, month: 3, rows: [{ documento: '123', salario: 2050000 }] },
    ];

    const anomalies = detectOutliers(currentRows, historicalData);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].employeeDoc).toBe('123');
    expect(anomalies[0].confidence).toBe('high');
    expect(anomalies[0].dataPoints.currentValue).toBe(10000000);
  });

  it('returns empty when values are within normal range', () => {
    const currentRows = [
      { documento: '123', salario: 2050000 },
    ];
    const historicalData = [
      { year: 2024, month: 6, rows: [{ documento: '123', salario: 2000000 }] },
      { year: 2024, month: 5, rows: [{ documento: '123', salario: 2100000 }] },
      { year: 2024, month: 4, rows: [{ documento: '123', salario: 1950000 }] },
    ];

    const anomalies = detectOutliers(currentRows, historicalData);
    expect(anomalies.length).toBe(0);
  });

  it('skips employees without historical data', () => {
    const currentRows = [
      { documento: 'new-employee', salario: 5000000 },
    ];
    const historicalData = [
      { year: 2024, month: 6, rows: [{ documento: '123', salario: 2000000 }] },
    ];

    const anomalies = detectOutliers(currentRows, historicalData);
    expect(anomalies.length).toBe(0);
  });
});

// ── Inter-Period Variation Detection ────────────────────────────────

describe('detectInterPeriodVariations', () => {
  it('detects significant increase in column totals', () => {
    const currentRows = [
      { documento: '1', salario: 5000000 },
      { documento: '2', salario: 5000000 },
    ];
    const historicalData = [
      {
        year: 2024, month: 6,
        rows: [
          { documento: '1', salario: 2000000 },
          { documento: '2', salario: 2000000 },
        ],
      },
      {
        year: 2024, month: 5,
        rows: [
          { documento: '1', salario: 2100000 },
          { documento: '2', salario: 2100000 },
        ],
      },
    ];

    const anomalies = detectInterPeriodVariations(currentRows, historicalData);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].employeeDoc).toBeNull(); // aggregate anomaly
    expect(anomalies[0].dataPoints.deviation).toBeGreaterThan(0);
  });

  it('returns empty when variation is within threshold', () => {
    const currentRows = [
      { documento: '1', salario: 2050000 },
    ];
    const historicalData = [
      { year: 2024, month: 6, rows: [{ documento: '1', salario: 2000000 }] },
      { year: 2024, month: 5, rows: [{ documento: '1', salario: 2100000 }] },
    ];

    const anomalies = detectInterPeriodVariations(currentRows, historicalData);
    expect(anomalies.length).toBe(0);
  });
});

// ── Rounding Pattern Detection ──────────────────────────────────────

describe('detectRoundingPatterns', () => {
  it('detects suspicious rounding when most values are round numbers', () => {
    const rows = [
      { documento: '1', salario: 1000000 },
      { documento: '2', salario: 2000000 },
      { documento: '3', salario: 3000000 },
      { documento: '4', salario: 4000000 },
      { documento: '5', salario: 5000000 },
      { documento: '6', salario: 6000000 },
      { documento: '7', salario: 7000000 },
    ];

    const anomalies = detectRoundingPatterns(rows);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].category).toBe('systematic_error');
  });

  it('returns empty when values have normal distribution of decimals', () => {
    const rows = [
      { documento: '1', salario: 1234567 },
      { documento: '2', salario: 2345678 },
      { documento: '3', salario: 3456789 },
      { documento: '4', salario: 4567890 },
      { documento: '5', salario: 5678901 },
    ];

    const anomalies = detectRoundingPatterns(rows);
    expect(anomalies.length).toBe(0);
  });
});

// ── Benchmark Comparison ────────────────────────────────────────────

describe('compareAgainstBenchmarks', () => {
  it('detects deviation from industry benchmark', () => {
    const rows = [
      { documento: '1', salario: 10000000 },
      { documento: '2', salario: 10000000 },
    ];
    const benchmark = {
      industry: 'tech',
      countryCode: 'CO',
      companySize: 'medium',
      avgCostPerEmployee: 3000000,
      avgContributionRatio: 0.12,
      avgRiskScore: 5.0,
      sampleCount: 50,
    };

    const anomalies = compareAgainstBenchmarks(rows, benchmark);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].dataPoints.historicalAverage).toBe(3000000);
  });

  it('returns empty when cost is within benchmark range', () => {
    const rows = [
      { documento: '1', salario: 3100000 },
    ];
    const benchmark = {
      industry: 'tech',
      countryCode: 'CO',
      companySize: 'medium',
      avgCostPerEmployee: 3000000,
      avgContributionRatio: 0.12,
      avgRiskScore: 5.0,
      sampleCount: 50,
    };

    const anomalies = compareAgainstBenchmarks(rows, benchmark);
    expect(anomalies.length).toBe(0);
  });
});

// ── Agent Definition ────────────────────────────────────────────────

describe('AnomalyDetector Agent', () => {
  const agent = createAnomalyDetectorAgent();

  it('returns an AgentDefinition with correct name and tools', () => {
    expect(agent.name).toBe('anomaly-detector');
    expect(agent.systemPrompt).toBeTruthy();
    expect(agent.tools).toBeDefined();
    expect(agent.tools!.length).toBe(1);
    expect(agent.tools![0].name).toBe('detectAnomalies');
  });

  it('returns success with empty anomalies when no payroll data', async () => {
    const context: AgentContext = {
      countryCode: 'CO',
      year: 2025,
      payrollData: [],
    };

    const result = await agent.execute(context, createMockModel());

    expect(result.agentName).toBe('anomaly-detector');
    expect(result.success).toBe(true);

    const data = result.data as { anomalies: AnomalyResult[]; message: string };
    expect(data.anomalies).toEqual([]);
    expect(data.message).toBe('No payroll data provided for analysis');
  });

  it('detects anomalies with historical data', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '[]',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    } as any);

    const context: AgentContext = {
      countryCode: 'CO',
      year: 2025,
      payrollData: [
        { documento: '123', salario: 10000000 },
      ],
      previousResults: {
        historicalData: [
          { year: 2024, month: 12, rows: [{ documento: '123', salario: 2000000 }] },
          { year: 2024, month: 11, rows: [{ documento: '123', salario: 2100000 }] },
          { year: 2024, month: 10, rows: [{ documento: '123', salario: 1900000 }] },
        ],
      },
    };

    const result = await agent.execute(context, createMockModel());

    expect(result.success).toBe(true);
    const data = result.data as { anomalies: AnomalyResult[]; summary: any };
    expect(data.anomalies.length).toBeGreaterThan(0);
    expect(data.summary.total).toBeGreaterThan(0);
    expect(data.summary.historicalPeriodsAnalyzed).toBe(3);
    expect(data.summary.usedBenchmarks).toBe(false);
  });

  it('sorts anomalies by confidence then category priority', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '[]',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    } as any);

    const context: AgentContext = {
      countryCode: 'CO',
      year: 2025,
      payrollData: [
        { documento: '1', salario: 10000000 },
        { documento: '2', salario: 8000000 },
      ],
      previousResults: {
        historicalData: [
          {
            year: 2024, month: 12,
            rows: [
              { documento: '1', salario: 2000000 },
              { documento: '2', salario: 2000000 },
            ],
          },
          {
            year: 2024, month: 11,
            rows: [
              { documento: '1', salario: 2100000 },
              { documento: '2', salario: 2100000 },
            ],
          },
          {
            year: 2024, month: 10,
            rows: [
              { documento: '1', salario: 1900000 },
              { documento: '2', salario: 1900000 },
            ],
          },
        ],
      },
    };

    const result = await agent.execute(context, createMockModel());
    const data = result.data as { anomalies: AnomalyResult[] };

    // Verify sorting: high confidence should come before medium
    if (data.anomalies.length >= 2) {
      const confidenceOrder = ['high', 'medium', 'low'];
      for (let i = 1; i < data.anomalies.length; i++) {
        const prevIdx = confidenceOrder.indexOf(data.anomalies[i - 1].confidence);
        const currIdx = confidenceOrder.indexOf(data.anomalies[i].confidence);
        expect(prevIdx).toBeLessThanOrEqual(currIdx);
      }
    }
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
