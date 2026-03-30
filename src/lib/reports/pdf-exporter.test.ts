import { describe, it, expect } from 'vitest';
import {
  generateExecutiveReport,
  generateComparativeReport,
  generateCustomReport,
  generateAuditTrailReport,
  getLocaleLabels,
  estimatePageCount,
  buildTableOfContents,
  TOC_PAGE_THRESHOLD,
  type PDFConfig,
  type PDFSection,
  type ExecutiveReportInput,
  type ComparativeReportInput,
  type CustomReportInput,
  type AuditTrailReportInput,
} from './pdf-exporter';
import type { AuditPDFData } from '@/lib/audit/audit-service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<PDFConfig> = {}): PDFConfig {
  return {
    locale: 'en',
    companyName: 'Acme Corp',
    companyLogoUrl: 'https://example.com/logo.png',
    workspaceName: 'Main',
    ...overrides,
  };
}

function makeExecutiveInput(overrides: Partial<ExecutiveReportInput> = {}): ExecutiveReportInput {
  return {
    companyName: 'Acme Corp',
    period: '2024-01',
    riskScore: 72,
    totalEmployees: 150,
    totalFindings: 23,
    criticalFindings: 3,
    certificationRate: 85,
    summary: 'Overall payroll compliance is good with minor issues.',
    findings: [
      { category: 'Tax', count: 10, severity: 'high' },
      { category: 'Benefits', count: 8, severity: 'medium' },
      { category: 'Rounding', count: 5, severity: 'low' },
    ],
    recommendations: [
      'Review tax withholding calculations',
      'Update benefit contribution rates',
    ],
    ...overrides,
  };
}

function makeComparativeInput(overrides: Partial<ComparativeReportInput> = {}): ComparativeReportInput {
  return {
    companyName: 'Acme Corp',
    periodA: '2024-01',
    periodB: '2024-02',
    metrics: [
      { label: 'Total Cost', valueA: 100000, valueB: 105000, unit: 'USD' },
      { label: 'Employees', valueA: 150, valueB: 155 },
      { label: 'Risk Score', valueA: 72, valueB: 68 },
    ],
    narrativeSummary: 'Costs increased 5% due to new hires.',
    ...overrides,
  };
}

function makeAuditData(): AuditPDFData {
  return {
    title: 'Audit Trail Report',
    generated_at: '2024-01-15T10:00:00Z',
    filters: {
      workspace_id: 'ws-1',
      action_type: null,
      resource_type: null,
      user_id: null,
      severity: null,
      date_from: null,
      date_to: null,
    },
    total_entries: 3,
    entries: [
      {
        id: 'e1',
        user_id: 'u1',
        action_type: 'create',
        resource_type: 'payroll',
        resource_id: 'p1',
        severity: 'info',
        ip_address: '1.2.3.4',
        created_at: '2024-01-15T09:00:00Z',
        has_data_changes: true,
      },
      {
        id: 'e2',
        user_id: 'u2',
        action_type: 'update',
        resource_type: 'rule',
        resource_id: 'r1',
        severity: 'warning',
        ip_address: '5.6.7.8',
        created_at: '2024-01-15T09:30:00Z',
        has_data_changes: true,
      },
      {
        id: 'e3',
        user_id: 'u1',
        action_type: 'delete',
        resource_type: 'payroll',
        resource_id: 'p2',
        severity: 'critical',
        ip_address: '1.2.3.4',
        created_at: '2024-01-15T10:00:00Z',
        has_data_changes: false,
      },
    ],
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('getLocaleLabels', () => {
  it('returns English labels for "en"', () => {
    const labels = getLocaleLabels('en');
    expect(labels.executiveSummary).toBe('Executive Summary');
    expect(labels.page).toBe('Page');
  });

  it('returns Spanish labels for "es"', () => {
    const labels = getLocaleLabels('es');
    expect(labels.executiveSummary).toBe('Resumen Ejecutivo');
    expect(labels.page).toBe('Página');
  });

  it('returns Portuguese labels for "pt"', () => {
    const labels = getLocaleLabels('pt');
    expect(labels.executiveSummary).toBe('Resumo Executivo');
  });

  it('falls back to English for unsupported locale', () => {
    const labels = getLocaleLabels('fr');
    expect(labels.executiveSummary).toBe('Executive Summary');
  });

  it('handles locale with region code (e.g., "es-CO")', () => {
    const labels = getLocaleLabels('es-CO');
    expect(labels.executiveSummary).toBe('Resumen Ejecutivo');
  });
});

describe('estimatePageCount', () => {
  it('returns 1 for empty sections', () => {
    expect(estimatePageCount([])).toBe(1);
  });

  it('estimates pages based on table rows', () => {
    const sections: PDFSection[] = [
      {
        id: 'big-table',
        title: 'Data',
        content: [
          {
            type: 'table',
            value: {
              columns: [{ key: 'a', header: 'A' }],
              rows: Array.from({ length: 100 }, (_, i) => ({ a: i })),
            },
          },
        ],
      },
    ];
    const pages = estimatePageCount(sections);
    expect(pages).toBeGreaterThan(1);
  });

  it('accounts for charts taking space', () => {
    const sections: PDFSection[] = [
      {
        id: 'charts',
        title: 'Charts',
        content: [
          { type: 'chart', value: { type: 'bar', title: 'Test', data: [{ label: 'A', value: 1 }] } },
          { type: 'chart', value: { type: 'line', title: 'Test2', data: [{ label: 'B', value: 2 }] } },
        ],
      },
    ];
    const pages = estimatePageCount(sections);
    expect(pages).toBeGreaterThanOrEqual(1);
  });
});

describe('buildTableOfContents', () => {
  it('returns null when estimated pages <= threshold', () => {
    const sections: PDFSection[] = [
      { id: 's1', title: 'Section 1', content: [{ type: 'text', value: 'Short text' }] },
    ];
    expect(buildTableOfContents(sections, TOC_PAGE_THRESHOLD)).toBeNull();
  });

  it('returns TOC entries when estimated pages > threshold', () => {
    const sections: PDFSection[] = [
      { id: 's1', title: 'Introduction', content: [{ type: 'text', value: 'Intro' }] },
      { id: 's2', title: 'Data', content: [{ type: 'text', value: 'Data section' }] },
    ];
    const toc = buildTableOfContents(sections, TOC_PAGE_THRESHOLD + 1);
    expect(toc).not.toBeNull();
    expect(toc!.length).toBe(2);
    expect(toc![0].title).toBe('Introduction');
    expect(toc![1].title).toBe('Data');
    expect(toc![0].page).toBeGreaterThanOrEqual(2);
  });
});

describe('generateExecutiveReport', () => {
  it('produces a valid PDFDocument with correct metadata', () => {
    const config = makeConfig();
    const input = makeExecutiveInput();
    const doc = generateExecutiveReport(config, input);

    expect(doc.metadata.reportType).toBe('executive');
    expect(doc.metadata.locale).toBe('en');
    expect(doc.title).toBe('Executive Summary');
    expect(doc.subtitle).toContain('Acme Corp');
    expect(doc.header.companyName).toBe('Acme Corp');
    expect(doc.header.companyLogoUrl).toBe('https://example.com/logo.png');
    expect(doc.footer.pageLabel).toBe('Page');
    expect(doc.sections.length).toBeGreaterThanOrEqual(3);
    expect(doc.estimatedPages).toBeGreaterThanOrEqual(1);
  });

  it('uses Spanish labels when locale is "es"', () => {
    const config = makeConfig({ locale: 'es' });
    const input = makeExecutiveInput();
    const doc = generateExecutiveReport(config, input);

    expect(doc.title).toBe('Resumen Ejecutivo');
    expect(doc.sections[0].title).toBe('Resumen Ejecutivo');
    expect(doc.footer.pageLabel).toBe('Página');
  });

  it('includes charts section when charts are provided', () => {
    const config = makeConfig();
    const input = makeExecutiveInput({
      charts: [{ type: 'bar', title: 'Risk Trend', data: [{ label: 'Jan', value: 72 }] }],
    });
    const doc = generateExecutiveReport(config, input);

    const chartSection = doc.sections.find((s) => s.id === 'charts');
    expect(chartSection).toBeDefined();
    expect(chartSection!.content[0].type).toBe('chart');
  });

  it('includes confidential watermark when configured', () => {
    const config = makeConfig({ includeConfidentialWatermark: true });
    const input = makeExecutiveInput();
    const doc = generateExecutiveReport(config, input);

    expect(doc.footer.confidentialLabel).toBe('Confidential');
  });

  it('omits confidential watermark by default', () => {
    const config = makeConfig();
    const input = makeExecutiveInput();
    const doc = generateExecutiveReport(config, input);

    expect(doc.footer.confidentialLabel).toBeUndefined();
  });
});

describe('generateComparativeReport', () => {
  it('produces a valid comparative PDFDocument', () => {
    const config = makeConfig();
    const input = makeComparativeInput();
    const doc = generateComparativeReport(config, input);

    expect(doc.metadata.reportType).toBe('comparative');
    expect(doc.title).toBe('Comparative Analysis');
    expect(doc.subtitle).toContain('2024-01 vs 2024-02');
    expect(doc.sections.length).toBeGreaterThanOrEqual(2);
  });

  it('includes narrative summary section when provided', () => {
    const config = makeConfig();
    const input = makeComparativeInput({ narrativeSummary: 'Costs went up.' });
    const doc = generateComparativeReport(config, input);

    const narrative = doc.sections.find((s) => s.id === 'narrative');
    expect(narrative).toBeDefined();
    expect(narrative!.content[0].type).toBe('text');
  });

  it('omits narrative section when not provided', () => {
    const config = makeConfig();
    const input = makeComparativeInput({ narrativeSummary: undefined });
    const doc = generateComparativeReport(config, input);

    const narrative = doc.sections.find((s) => s.id === 'narrative');
    expect(narrative).toBeUndefined();
  });

  it('formats percentage changes in comparison table', () => {
    const config = makeConfig();
    const input = makeComparativeInput();
    const doc = generateComparativeReport(config, input);

    const compSection = doc.sections.find((s) => s.id === 'comparison');
    expect(compSection).toBeDefined();
    const tableContent = compSection!.content[0];
    expect(tableContent.type).toBe('table');
    if (tableContent.type === 'table') {
      const firstRow = tableContent.value.rows[0];
      expect(firstRow.change).toBe('+5.0%');
    }
  });
});

describe('generateCustomReport', () => {
  it('produces a valid custom PDFDocument', () => {
    const config = makeConfig();
    const input: CustomReportInput = {
      reportName: 'Monthly Summary',
      description: 'Custom monthly report',
      sections: [
        {
          title: 'Overview',
          content: [{ type: 'text', value: 'This is a custom report.' }],
        },
        {
          title: 'Details',
          content: [
            {
              type: 'table',
              value: {
                columns: [{ key: 'name', header: 'Name' }],
                rows: [{ name: 'Item 1' }],
              },
            },
          ],
        },
      ],
    };
    const doc = generateCustomReport(config, input);

    expect(doc.metadata.reportType).toBe('custom');
    expect(doc.title).toBe('Monthly Summary');
    expect(doc.subtitle).toBe('Custom monthly report');
    expect(doc.sections.length).toBe(2);
    expect(doc.sections[0].id).toBe('custom-0');
    expect(doc.sections[1].id).toBe('custom-1');
  });
});

describe('generateAuditTrailReport', () => {
  it('produces a valid audit trail PDFDocument', () => {
    const config = makeConfig();
    const input: AuditTrailReportInput = { auditData: makeAuditData() };
    const doc = generateAuditTrailReport(config, input);

    expect(doc.metadata.reportType).toBe('audit_trail');
    expect(doc.title).toBe('Audit Trail Report');
    expect(doc.sections.length).toBe(2);
  });

  it('includes filter summary when filters are applied', () => {
    const config = makeConfig();
    const auditData = makeAuditData();
    auditData.filters.action_type = 'create';
    auditData.filters.severity = 'critical';
    const doc = generateAuditTrailReport(config, { auditData });

    const summarySection = doc.sections[0];
    const filterText = summarySection.content.find(
      (c) => c.type === 'text' && (c as { type: 'text'; value: string }).value.includes('Filters'),
    );
    expect(filterText).toBeDefined();
  });

  it('renders all audit entries in the table', () => {
    const config = makeConfig();
    const input: AuditTrailReportInput = { auditData: makeAuditData() };
    const doc = generateAuditTrailReport(config, input);

    const entriesSection = doc.sections[1];
    const tableContent = entriesSection.content[0];
    expect(tableContent.type).toBe('table');
    if (tableContent.type === 'table') {
      expect(tableContent.value.rows.length).toBe(3);
    }
  });

  it('uses Portuguese labels when locale is "pt"', () => {
    const config = makeConfig({ locale: 'pt' });
    const input: AuditTrailReportInput = { auditData: makeAuditData() };
    const doc = generateAuditTrailReport(config, input);

    expect(doc.title).toBe('Relatório de Auditoria');
    expect(doc.footer.pageLabel).toBe('Página');
  });
});
