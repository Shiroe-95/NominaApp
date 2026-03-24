import { describe, it, expect, vi } from 'vitest';
import type { AgentContext } from '../types';
import type { LanguageModel } from 'ai';

// Mock the 'ai' module to avoid zod ESM resolution issues
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

const { generateText } = await import('ai');
const { createAuditorAgent } = await import('./auditor');
type AuditReport = import('./auditor').AuditReport;

// Minimal mock model
function createMockModel(): LanguageModel {
  return {
    modelId: 'test-model',
    specificationVersion: 'v1',
    provider: 'test',
  } as unknown as LanguageModel;
}

describe('Auditor Agent', () => {
  const agent = createAuditorAgent();

  it('returns an AgentDefinition with correct name and tools', () => {
    expect(agent.name).toBe('auditor');
    expect(agent.systemPrompt).toContain('Agente Auditor');
    expect(agent.tools).toBeDefined();
    expect(agent.tools!.length).toBeGreaterThan(0);
    expect(agent.tools![0].name).toBe('validatePayrollCalculations');
  });

  it('returns success with empty findings when no payroll data', async () => {
    const context: AgentContext = {
      countryCode: 'CO',
      year: 2025,
      payrollData: [],
    };

    const result = await agent.execute(context, createMockModel());

    expect(result.agentName).toBe('auditor');
    expect(result.success).toBe(true);

    const report = result.data as AuditReport;
    expect(report.findings).toEqual([]);
    expect(report.summary.totalFindings).toBe(0);
    expect(report.validationReport.rowsAnalyzed).toBe(0);
  });

  it('detects findings for payroll rows with incorrect values', async () => {
    // Setup generateText mock to return interpretation
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Interpretación de prueba',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    } as any);

    const context: AgentContext = {
      countryCode: 'CO',
      year: 2025,
      payrollData: [
        {
          document_number: '123456',
          first_name: 'Juan',
          last_name: 'Pérez',
          base_salary: 2000000,
          non_salary_payments: 500000,
          ibc_total: 1500000, // Wrong: should be ~2000000
          health_employee_deduction: 50000, // Wrong
          pension_employee_deduction: 50000, // Wrong
        },
      ],
      previousResults: {
        relations: [
          { source: 'document_number', target: 'document_number', analysisCategory: 'identity', isCreated: false, requiredByRule: false },
          { source: 'first_name', target: 'first_name', analysisCategory: 'identity', isCreated: false, requiredByRule: false },
          { source: 'last_name', target: 'last_name', analysisCategory: 'identity', isCreated: false, requiredByRule: false },
          { source: 'base_salary', target: 'base_salary', analysisCategory: 'salary_base', isCreated: false, requiredByRule: true },
          { source: 'non_salary_payments', target: 'non_salary_payments', analysisCategory: 'non_salary', isCreated: false, requiredByRule: true },
          { source: 'ibc_total', target: 'ibc_total', analysisCategory: 'ibc', isCreated: false, requiredByRule: true },
          { source: 'health_employee_deduction', target: 'health_employee_deduction', analysisCategory: 'contribution', isCreated: false, requiredByRule: true },
          { source: 'pension_employee_deduction', target: 'pension_employee_deduction', analysisCategory: 'contribution', isCreated: false, requiredByRule: true },
        ],
      },
    };

    const result = await agent.execute(context, createMockModel());

    expect(result.agentName).toBe('auditor');
    expect(result.success).toBe(true);

    const report = result.data as AuditReport;
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.summary.totalFindings).toBe(report.findings.length);

    // Verify summary counts are consistent
    const severitySum = (Object.values(report.summary.bySeverity) as number[]).reduce((a, b) => a + b, 0);
    expect(severitySum).toBe(report.summary.totalFindings);

    const categorySum = (Object.values(report.summary.byCategory) as number[]).reduce((a, b) => a + b, 0);
    expect(categorySum).toBe(report.summary.totalFindings);

    // Every finding should have required fields
    for (const finding of report.findings) {
      expect(finding.document).toBeTruthy();
      expect(finding.description).toBeTruthy();
      expect(['alta', 'media', 'baja']).toContain(finding.severity);
      expect(finding.norm).toBeTruthy();
      expect(finding.category).toBeTruthy();
    }
  });

  it('includes AI interpretation when findings exist', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: 'Análisis ejecutivo de prueba',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    } as any);

    const context: AgentContext = {
      countryCode: 'CO',
      year: 2025,
      payrollData: [
        {
          base_salary: 3000000,
          non_salary_payments: 0,
          ibc_total: 1000000, // Clearly wrong
        },
      ],
      previousResults: {
        relations: [
          { source: 'base_salary', target: 'base_salary', analysisCategory: 'salary_base', isCreated: false, requiredByRule: true },
          { source: 'non_salary_payments', target: 'non_salary_payments', analysisCategory: 'non_salary', isCreated: false, requiredByRule: true },
          { source: 'ibc_total', target: 'ibc_total', analysisCategory: 'ibc', isCreated: false, requiredByRule: true },
        ],
      },
    };

    const result = await agent.execute(context, createMockModel());
    const report = result.data as AuditReport;

    expect(report.aiInterpretation).toBe('Análisis ejecutivo de prueba');
    expect(result.tokensUsed).toBe(30);
  });

  it('still succeeds when AI model fails', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error('Model unavailable'));

    const context: AgentContext = {
      countryCode: 'CO',
      year: 2025,
      payrollData: [
        {
          base_salary: 3000000,
          non_salary_payments: 0,
          ibc_total: 1000000,
        },
      ],
      previousResults: {
        relations: [
          { source: 'base_salary', target: 'base_salary', analysisCategory: 'salary_base', isCreated: false, requiredByRule: true },
          { source: 'non_salary_payments', target: 'non_salary_payments', analysisCategory: 'non_salary', isCreated: false, requiredByRule: true },
          { source: 'ibc_total', target: 'ibc_total', analysisCategory: 'ibc', isCreated: false, requiredByRule: true },
        ],
      },
    };

    const result = await agent.execute(context, createMockModel());

    // Should still succeed with mathematical results even if AI fails
    expect(result.success).toBe(true);
    const report = result.data as AuditReport;
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.aiInterpretation).toBeUndefined();
  });

  it('measures latency correctly', async () => {
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
