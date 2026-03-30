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
            single: vi.fn(() => Promise.resolve({ data: { role: 'editor' }, error: null })),
          })),
          order: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    })),
  })),
}));

const { generateText } = await import('ai');
const {
  createNLQEngineAgent,
  classifyQueryLocal,
  detectAmbiguity,
  executeAggregation,
  executeComparative,
  executeEmployeeLookup,
  executeRanking,
  processNLQuery,
} = await import('./nlq-engine');

function createMockModel(): LanguageModel {
  return {
    modelId: 'test-model',
    specificationVersion: 'v1',
    provider: 'test',
  } as unknown as LanguageModel;
}

// ── Query Classification ────────────────────────────────────────────

describe('classifyQueryLocal', () => {
  it('classifies comparative queries', () => {
    expect(classifyQueryLocal('compara los costos de enero vs febrero')).toBe('comparative');
    expect(classifyQueryLocal('diferencia entre periodos')).toBe('comparative');
    expect(classifyQueryLocal('compare January and February')).toBe('comparative');
  });

  it('classifies ranking queries', () => {
    expect(classifyQueryLocal('¿cuál es el empleado con mayor salario?')).toBe('ranking');
    expect(classifyQueryLocal('top 5 empleados por costo')).toBe('ranking');
    expect(classifyQueryLocal('lowest paid employee')).toBe('ranking');
  });

  it('classifies count queries', () => {
    expect(classifyQueryLocal('¿cuántas planillas tienen hallazgos?')).toBe('count');
    expect(classifyQueryLocal('número de empleados')).toBe('count');
    expect(classifyQueryLocal('how many payrolls')).toBe('count');
  });

  it('classifies trend queries', () => {
    expect(classifyQueryLocal('tendencia de costos')).toBe('trend');
    expect(classifyQueryLocal('evolución del salario')).toBe('trend');
    expect(classifyQueryLocal('cost trend over time')).toBe('trend');
  });

  it('classifies employee lookup queries', () => {
    expect(classifyQueryLocal('datos del empleado Juan')).toBe('employee_lookup');
    expect(classifyQueryLocal('buscar trabajador con cédula 123')).toBe('employee_lookup');
    expect(classifyQueryLocal('employee details')).toBe('employee_lookup');
  });

  it('classifies aggregation queries', () => {
    expect(classifyQueryLocal('¿cuánto gastamos en salud?')).toBe('aggregation');
    expect(classifyQueryLocal('total de aportes')).toBe('aggregation');
    expect(classifyQueryLocal('promedio salarial')).toBe('aggregation');
    expect(classifyQueryLocal('how much did we spend')).toBe('aggregation');
  });

  it('returns unknown for unrecognized queries', () => {
    expect(classifyQueryLocal('hola mundo')).toBe('unknown');
    expect(classifyQueryLocal('xyz abc')).toBe('unknown');
  });
});

// ── Ambiguity Detection ─────────────────────────────────────────────

describe('detectAmbiguity', () => {
  it('detects missing period for time-sensitive queries', () => {
    const result = detectAmbiguity(
      '¿cuánto gastamos en aportes?',
      ['salario', 'aportes_salud'],
      [{ year: 2024, month: 11 }, { year: 2024, month: 12 }],
    );
    expect(result).not.toBeNull();
    expect(result!.message).toContain('periodo');
    expect(result!.options.length).toBeGreaterThan(0);
  });

  it('returns null when period is specified', () => {
    const result = detectAmbiguity(
      '¿cuánto gastamos en aportes en enero?',
      ['salario', 'aportes_salud'],
      [{ year: 2024, month: 1 }, { year: 2024, month: 2 }],
    );
    expect(result).toBeNull();
  });

  it('returns null when only one period is available', () => {
    const result = detectAmbiguity(
      '¿cuánto gastamos en aportes?',
      ['salario'],
      [{ year: 2024, month: 12 }],
    );
    expect(result).toBeNull();
  });
});

// ── Aggregation Execution ───────────────────────────────────────────

describe('executeAggregation', () => {
  it('computes sum, avg, min, max, count for columns', () => {
    const rows = [
      { salario: 1000, aportes: 100 },
      { salario: 2000, aportes: 200 },
      { salario: 3000, aportes: 300 },
    ];

    const result = executeAggregation(rows, ['salario', 'aportes']);

    expect(result.salario.sum).toBe(6000);
    expect(result.salario.avg).toBe(2000);
    expect(result.salario.min).toBe(1000);
    expect(result.salario.max).toBe(3000);
    expect(result.salario.count).toBe(3);

    expect(result.aportes.sum).toBe(600);
    expect(result.aportes.avg).toBe(200);
  });

  it('handles empty rows', () => {
    const result = executeAggregation([], ['salario']);
    expect(result.salario.sum).toBe(0);
    expect(result.salario.count).toBe(0);
  });
});

// ── Comparative Execution ───────────────────────────────────────────

describe('executeComparative', () => {
  it('computes differences between two periods', () => {
    const periodA = {
      label: '1/2024',
      rows: [{ salario: 1000 }, { salario: 2000 }],
    };
    const periodB = {
      label: '2/2024',
      rows: [{ salario: 1200 }, { salario: 2400 }],
    };

    const result = executeComparative(periodA, periodB, ['salario']);

    expect(result.salario.periodA).toBe(3000);
    expect(result.salario.periodB).toBe(3600);
    expect(result.salario.difference).toBe(600);
    expect(result.salario.percentChange).toBe(20);
  });

  it('handles zero values in period A', () => {
    const periodA = { label: '1/2024', rows: [{ salario: 0 }] };
    const periodB = { label: '2/2024', rows: [{ salario: 1000 }] };

    const result = executeComparative(periodA, periodB, ['salario']);
    expect(result.salario.percentChange).toBe(0); // division by zero guard
  });
});

// ── Employee Lookup ─────────────────────────────────────────────────

describe('executeEmployeeLookup', () => {
  it('finds employees by document number', () => {
    const rows = [
      { documento: '12345', nombre: 'Juan Pérez', salario: 3000000 },
      { documento: '67890', nombre: 'María López', salario: 4000000 },
    ];

    const result = executeEmployeeLookup(rows, '12345');
    expect(result.length).toBe(1);
    expect(result[0].nombre).toBe('Juan Pérez');
  });

  it('finds employees by name (partial match)', () => {
    const rows = [
      { documento: '12345', nombre: 'Juan Pérez', salario: 3000000 },
      { documento: '67890', nombre: 'María López', salario: 4000000 },
    ];

    const result = executeEmployeeLookup(rows, 'maría');
    expect(result.length).toBe(1);
    expect(result[0].documento).toBe('67890');
  });

  it('returns empty when no match', () => {
    const rows = [{ documento: '12345', nombre: 'Juan', salario: 3000000 }];
    const result = executeEmployeeLookup(rows, 'xyz');
    expect(result.length).toBe(0);
  });
});

// ── Ranking Execution ───────────────────────────────────────────────

describe('executeRanking', () => {
  it('returns top N employees by column', () => {
    const rows = [
      { nombre: 'A', salario: 1000 },
      { nombre: 'B', salario: 3000 },
      { nombre: 'C', salario: 2000 },
    ];

    const result = executeRanking(rows, 'salario', 'top', 2);
    expect(result.length).toBe(2);
    expect(result[0].employee).toBe('B');
    expect(result[0].value).toBe(3000);
    expect(result[1].employee).toBe('C');
  });

  it('returns bottom N employees by column', () => {
    const rows = [
      { nombre: 'A', salario: 1000 },
      { nombre: 'B', salario: 3000 },
      { nombre: 'C', salario: 2000 },
    ];

    const result = executeRanking(rows, 'salario', 'bottom', 2);
    expect(result.length).toBe(2);
    expect(result[0].employee).toBe('A');
    expect(result[0].value).toBe(1000);
  });
});


// ── processNLQuery ──────────────────────────────────────────────────

describe('processNLQuery', () => {
  it('returns clarification when query is ambiguous', async () => {
    const rows = [
      { documento: '1', salario: 1000, aportes: 100 },
    ];

    const result = await processNLQuery(
      '¿cuánto gastamos?',
      rows,
      [
        { year: 2024, month: 11, rows },
        { year: 2024, month: 12, rows },
      ],
      [],
      createMockModel(),
      'es',
    );

    expect(result.clarification).not.toBeNull();
    expect(result.query).toBe('¿cuánto gastamos?');
    expect(result.rbacFiltered).toBe(true);
  });

  it('processes aggregation query with AI enhancement', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"answer": "El total de salarios es $6,000.", "enhancedData": null}',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    } as any);

    const rows = [
      { documento: '1', salario: 1000, nombre: 'A' },
      { documento: '2', salario: 2000, nombre: 'B' },
      { documento: '3', salario: 3000, nombre: 'C' },
    ];

    const result = await processNLQuery(
      'total de salarios en enero',
      rows,
      [],
      [{ table: 'payroll_uploads', description: 'Planilla enero', rowCount: 3 }],
      createMockModel(),
      'es',
    );

    expect(result.queryType).toBe('aggregation');
    expect(result.answer).toContain('6,000');
    expect(result.clarification).toBeNull();
    expect(result.dataSources.length).toBe(1);
  });

  it('processes comparative query', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"answer": "Los costos aumentaron un 20%.", "enhancedData": null}',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    } as any);

    const periodA = [{ documento: '1', salario: 1000 }];
    const periodB = [{ documento: '1', salario: 1200 }];

    const result = await processNLQuery(
      'compara los costos de enero vs febrero',
      periodA,
      [
        { year: 2024, month: 1, rows: periodA },
        { year: 2024, month: 2, rows: periodB },
      ],
      [],
      createMockModel(),
      'es',
    );

    expect(result.queryType).toBe('comparative');
    expect(result.answer).toContain('20%');
  });

  it('handles employee lookup query', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"answer": "Empleado Juan Pérez encontrado.", "enhancedData": null}',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    } as any);

    const rows = [
      { documento: '12345', nombre: 'Juan Pérez', salario: 3000000 },
      { documento: '67890', nombre: 'María López', salario: 4000000 },
    ];

    const result = await processNLQuery(
      'datos del empleado 12345',
      rows,
      [],
      [],
      createMockModel(),
      'es',
    );

    expect(result.queryType).toBe('employee_lookup');
  });
});

// ── Agent Definition ────────────────────────────────────────────────

describe('NLQEngine Agent', () => {
  const agent = createNLQEngineAgent();

  it('returns an AgentDefinition with correct name and tools', () => {
    expect(agent.name).toBe('nlq');
    expect(agent.systemPrompt).toBeTruthy();
    expect(agent.tools).toBeDefined();
    expect(agent.tools!.length).toBe(1);
    expect(agent.tools![0].name).toBe('queryPayrollData');
  });

  it('returns error when no query is provided', async () => {
    const context: AgentContext = {
      countryCode: 'CO',
      year: 2025,
      payrollData: [],
    };

    const result = await agent.execute(context, createMockModel());

    expect(result.agentName).toBe('nlq');
    expect(result.success).toBe(false);
    const data = result.data as { error: string };
    expect(data.error).toBe('No query provided');
  });

  it('processes a query from context and returns NLQ result', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: '{"answer": "Hay 2 empleados en la planilla.", "enhancedData": null}',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    } as any);

    const context: AgentContext = {
      countryCode: 'CO',
      year: 2025,
      locale: 'es',
      payrollData: [
        { documento: '1', salario: 1000000, nombre: 'A' },
        { documento: '2', salario: 2000000, nombre: 'B' },
      ],
      previousResults: {
        nlqQuery: '¿cuántos empleados hay?',
      },
    };

    const result = await agent.execute(context, createMockModel());

    expect(result.agentName).toBe('nlq');
    expect(result.success).toBe(true);
    const data = result.data as { result: any; summary: any };
    expect(data.result.queryType).toBe('count');
    expect(data.summary.rbacFiltered).toBe(true);
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
