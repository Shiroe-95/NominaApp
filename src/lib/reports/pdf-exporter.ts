import type { AuditPDFData } from '@/lib/audit/audit-service';

/**
 * PDFExporter — Server-side PDF generation service.
 *
 * Generates structured PDF document data with professional layout:
 * company logo, headers, formatted tables, rendered charts,
 * footer with date/page number, and table of contents for >5 pages.
 *
 * Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6
 *
 * Supported report types:
 * - Executive reports (Ana's output)
 * - Comparative analysis between periods
 * - Custom reports from Report Builder
 * - Audit trail exports
 *
 * @module lib/reports/pdf-exporter
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** Page threshold for generating table of contents (Req 28.5) */
export const TOC_PAGE_THRESHOLD = 5;

/** Estimated rows per page for page count estimation */
export const ROWS_PER_PAGE = 30;

/** Default page margins in points */
export const DEFAULT_MARGINS = { top: 72, right: 56, bottom: 72, left: 56 };

// ─── Locale Labels ──────────────────────────────────────────────────────────

/** Locale-aware labels for PDF text rendering (Req 28.6) */
const LOCALE_LABELS: Record<string, PDFLocaleLabels> = {
  en: {
    tableOfContents: 'Table of Contents',
    page: 'Page',
    generatedAt: 'Generated',
    executiveSummary: 'Executive Summary',
    comparativeAnalysis: 'Comparative Analysis',
    auditTrail: 'Audit Trail Report',
    customReport: 'Custom Report',
    totalEntries: 'Total Entries',
    period: 'Period',
    company: 'Company',
    riskScore: 'Risk Score',
    findings: 'Findings',
    recommendations: 'Recommendations',
    change: 'Change',
    current: 'Current',
    previous: 'Previous',
    difference: 'Difference',
    action: 'Action',
    user: 'User',
    date: 'Date',
    severity: 'Severity',
    resource: 'Resource',
    confidential: 'Confidential',
  },
  es: {
    tableOfContents: 'Índice de Contenidos',
    page: 'Página',
    generatedAt: 'Generado',
    executiveSummary: 'Resumen Ejecutivo',
    comparativeAnalysis: 'Análisis Comparativo',
    auditTrail: 'Reporte de Auditoría',
    customReport: 'Reporte Personalizado',
    totalEntries: 'Total de Entradas',
    period: 'Periodo',
    company: 'Empresa',
    riskScore: 'Score de Riesgo',
    findings: 'Hallazgos',
    recommendations: 'Recomendaciones',
    change: 'Cambio',
    current: 'Actual',
    previous: 'Anterior',
    difference: 'Diferencia',
    action: 'Acción',
    user: 'Usuario',
    date: 'Fecha',
    severity: 'Severidad',
    resource: 'Recurso',
    confidential: 'Confidencial',
  },
  pt: {
    tableOfContents: 'Índice',
    page: 'Página',
    generatedAt: 'Gerado em',
    executiveSummary: 'Resumo Executivo',
    comparativeAnalysis: 'Análise Comparativa',
    auditTrail: 'Relatório de Auditoria',
    customReport: 'Relatório Personalizado',
    totalEntries: 'Total de Entradas',
    period: 'Período',
    company: 'Empresa',
    riskScore: 'Score de Risco',
    findings: 'Achados',
    recommendations: 'Recomendações',
    change: 'Mudança',
    current: 'Atual',
    previous: 'Anterior',
    difference: 'Diferença',
    action: 'Ação',
    user: 'Usuário',
    date: 'Data',
    severity: 'Severidade',
    resource: 'Recurso',
    confidential: 'Confidencial',
  },
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PDFLocaleLabels {
  tableOfContents: string;
  page: string;
  generatedAt: string;
  executiveSummary: string;
  comparativeAnalysis: string;
  auditTrail: string;
  customReport: string;
  totalEntries: string;
  period: string;
  company: string;
  riskScore: string;
  findings: string;
  recommendations: string;
  change: string;
  current: string;
  previous: string;
  difference: string;
  action: string;
  user: string;
  date: string;
  severity: string;
  resource: string;
  confidential: string;
}

export interface PDFConfig {
  locale: string;
  companyName: string;
  companyLogoUrl?: string | null;
  workspaceName?: string;
  margins?: { top: number; right: number; bottom: number; left: number };
  pageSize?: 'A4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  includeConfidentialWatermark?: boolean;
}

export interface PDFTableColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

export interface PDFTable {
  title?: string;
  columns: PDFTableColumn[];
  rows: Record<string, string | number | null>[];
  highlightCondition?: (row: Record<string, string | number | null>) => boolean;
}

export interface PDFChart {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: { label: string; value: number; color?: string }[];
  width?: number;
  height?: number;
}

export type PDFSectionContent =
  | { type: 'text'; value: string }
  | { type: 'table'; value: PDFTable }
  | { type: 'chart'; value: PDFChart }
  | { type: 'spacer'; height: number };

export interface PDFSection {
  id: string;
  title: string;
  content: PDFSectionContent[];
}

export interface PDFTOCEntry {
  title: string;
  page: number;
}

export interface PDFFooter {
  generatedAt: string;
  pageLabel: string;
  confidentialLabel?: string;
}

export interface PDFDocument {
  config: PDFConfig;
  title: string;
  subtitle?: string;
  header: {
    companyName: string;
    companyLogoUrl?: string | null;
    reportTitle: string;
    generatedAt: string;
  };
  tableOfContents: PDFTOCEntry[] | null;
  sections: PDFSection[];
  footer: PDFFooter;
  estimatedPages: number;
  metadata: {
    reportType: 'executive' | 'comparative' | 'custom' | 'audit_trail';
    locale: string;
    generatedAt: string;
  };
}

// ─── Executive Report Types ─────────────────────────────────────────────────

export interface ExecutiveReportInput {
  companyName: string;
  period: string;
  riskScore: number;
  totalEmployees: number;
  totalFindings: number;
  criticalFindings: number;
  certificationRate: number;
  summary: string;
  findings: { category: string; count: number; severity: string }[];
  recommendations: string[];
  charts?: PDFChart[];
}

// ─── Comparative Report Types ───────────────────────────────────────────────

export interface ComparativeReportInput {
  companyName: string;
  periodA: string;
  periodB: string;
  metrics: {
    label: string;
    valueA: number;
    valueB: number;
    unit?: string;
  }[];
  narrativeSummary?: string;
  charts?: PDFChart[];
}

// ─── Custom Report Types ────────────────────────────────────────────────────

export interface CustomReportInput {
  reportName: string;
  description?: string;
  sections: {
    title: string;
    content: PDFSectionContent[];
  }[];
}

// ─── Audit Trail Report Types ───────────────────────────────────────────────

export interface AuditTrailReportInput {
  auditData: AuditPDFData;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Get locale-aware labels, falling back to English for unsupported locales.
 */
export function getLocaleLabels(locale: string): PDFLocaleLabels {
  const lang = locale.split('-')[0].toLowerCase();
  return LOCALE_LABELS[lang] ?? LOCALE_LABELS['en'];
}

/**
 * Estimate the number of pages based on section content.
 * Uses a simple heuristic: text blocks ~5 lines, tables by row count,
 * charts take ~half a page, spacers by height.
 */
export function estimatePageCount(sections: PDFSection[]): number {
  let totalRows = 0;

  for (const section of sections) {
    totalRows += 2; // section title overhead
    for (const item of section.content) {
      switch (item.type) {
        case 'text':
          totalRows += Math.ceil(item.value.length / 80);
          break;
        case 'table':
          totalRows += item.value.rows.length + 2; // header + rows + spacing
          break;
        case 'chart':
          totalRows += 15; // chart takes ~half page
          break;
        case 'spacer':
          totalRows += Math.ceil(item.height / 20);
          break;
      }
    }
  }

  return Math.max(1, Math.ceil(totalRows / ROWS_PER_PAGE));
}

/**
 * Build the table of contents from sections if estimated pages > threshold.
 * Req 28.5: TOC for reports >5 pages.
 */
export function buildTableOfContents(
  sections: PDFSection[],
  estimatedPages: number,
): PDFTOCEntry[] | null {
  if (estimatedPages <= TOC_PAGE_THRESHOLD) {
    return null;
  }

  let currentPage = 2; // page 1 is title/header, TOC is page 2
  const entries: PDFTOCEntry[] = [];

  for (const section of sections) {
    entries.push({ title: section.title, page: currentPage });
    let sectionRows = 2;
    for (const item of section.content) {
      switch (item.type) {
        case 'text':
          sectionRows += Math.ceil(item.value.length / 80);
          break;
        case 'table':
          sectionRows += item.value.rows.length + 2;
          break;
        case 'chart':
          sectionRows += 15;
          break;
        case 'spacer':
          sectionRows += Math.ceil(item.height / 20);
          break;
      }
    }
    currentPage += Math.ceil(sectionRows / ROWS_PER_PAGE);
  }

  return entries;
}

/**
 * Format a percentage change with direction indicator.
 */
function formatChange(valueA: number, valueB: number): string {
  if (valueA === 0) return valueB === 0 ? '0%' : '+100%';
  const pct = ((valueB - valueA) / Math.abs(valueA)) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Create the common PDF footer structure.
 */
function buildFooter(labels: PDFLocaleLabels, config: PDFConfig): PDFFooter {
  return {
    generatedAt: `${labels.generatedAt}: ${new Date().toLocaleDateString(config.locale)}`,
    pageLabel: labels.page,
    confidentialLabel: config.includeConfidentialWatermark
      ? labels.confidential
      : undefined,
  };
}

/**
 * Create the common PDF header structure.
 */
function buildHeader(
  config: PDFConfig,
  reportTitle: string,
): PDFDocument['header'] {
  return {
    companyName: config.companyName,
    companyLogoUrl: config.companyLogoUrl ?? null,
    reportTitle,
    generatedAt: new Date().toISOString(),
  };
}

// ─── PDF Generation Functions ───────────────────────────────────────────────

/**
 * Generate an executive report PDF document.
 *
 * Req 28.1: Professional layout with logo, headers, tables, charts, footer.
 * Req 28.2: Support executive reports from Ana.
 * Req 28.3: Server-side generation.
 * Req 28.5: TOC for >5 pages.
 * Req 28.6: Locale-aware text.
 */
export function generateExecutiveReport(
  config: PDFConfig,
  input: ExecutiveReportInput,
): PDFDocument {
  const labels = getLocaleLabels(config.locale);

  const sections: PDFSection[] = [
    {
      id: 'summary',
      title: labels.executiveSummary,
      content: [
        { type: 'text', value: input.summary },
        { type: 'spacer', height: 10 },
        {
          type: 'table',
          value: {
            columns: [
              { key: 'metric', header: 'Metric', align: 'left' },
              { key: 'value', header: 'Value', align: 'right' },
            ],
            rows: [
              { metric: labels.company, value: input.companyName },
              { metric: labels.period, value: input.period },
              { metric: labels.riskScore, value: input.riskScore },
              { metric: 'Employees', value: input.totalEmployees },
              { metric: labels.findings, value: input.totalFindings },
              { metric: 'Critical', value: input.criticalFindings },
              { metric: 'Certification', value: `${input.certificationRate}%` },
            ],
          },
        },
      ],
    },
    {
      id: 'findings',
      title: labels.findings,
      content: [
        {
          type: 'table',
          value: {
            columns: [
              { key: 'category', header: 'Category', align: 'left' },
              { key: 'count', header: 'Count', align: 'right' },
              { key: 'severity', header: labels.severity, align: 'center' },
            ],
            rows: input.findings.map((f) => ({
              category: f.category,
              count: f.count,
              severity: f.severity,
            })),
          },
        },
      ],
    },
    {
      id: 'recommendations',
      title: labels.recommendations,
      content: input.recommendations.map((r) => ({
        type: 'text' as const,
        value: `• ${r}`,
      })),
    },
  ];

  // Add charts if provided
  if (input.charts && input.charts.length > 0) {
    sections.push({
      id: 'charts',
      title: 'Charts',
      content: input.charts.map((chart) => ({
        type: 'chart' as const,
        value: chart,
      })),
    });
  }

  const estimatedPages = estimatePageCount(sections);
  const toc = buildTableOfContents(sections, estimatedPages);

  return {
    config,
    title: labels.executiveSummary,
    subtitle: `${input.companyName} — ${input.period}`,
    header: buildHeader(config, labels.executiveSummary),
    tableOfContents: toc,
    sections,
    footer: buildFooter(labels, config),
    estimatedPages,
    metadata: {
      reportType: 'executive',
      locale: config.locale,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Generate a comparative analysis PDF document.
 *
 * Req 28.1: Professional layout.
 * Req 28.2: Support comparative analysis.
 * Req 28.6: Locale-aware text.
 */
export function generateComparativeReport(
  config: PDFConfig,
  input: ComparativeReportInput,
): PDFDocument {
  const labels = getLocaleLabels(config.locale);

  const sections: PDFSection[] = [];

  // Narrative summary if provided
  if (input.narrativeSummary) {
    sections.push({
      id: 'narrative',
      title: labels.comparativeAnalysis,
      content: [{ type: 'text', value: input.narrativeSummary }],
    });
  }

  // Comparison table
  sections.push({
    id: 'comparison',
    title: `${input.periodA} vs ${input.periodB}`,
    content: [
      {
        type: 'table',
        value: {
          title: labels.comparativeAnalysis,
          columns: [
            { key: 'label', header: 'Metric', align: 'left' },
            { key: 'valueA', header: `${labels.previous} (${input.periodA})`, align: 'right' },
            { key: 'valueB', header: `${labels.current} (${input.periodB})`, align: 'right' },
            { key: 'change', header: labels.change, align: 'right' },
          ],
          rows: input.metrics.map((m) => ({
            label: m.label,
            valueA: m.unit ? `${m.valueA} ${m.unit}` : m.valueA,
            valueB: m.unit ? `${m.valueB} ${m.unit}` : m.valueB,
            change: formatChange(m.valueA, m.valueB),
          })),
          highlightCondition: (row) => {
            const changeStr = String(row.change ?? '');
            const pct = parseFloat(changeStr.replace(/[+%]/g, ''));
            return !isNaN(pct) && Math.abs(pct) > 5;
          },
        },
      },
    ],
  });

  // Charts if provided
  if (input.charts && input.charts.length > 0) {
    sections.push({
      id: 'charts',
      title: 'Charts',
      content: input.charts.map((chart) => ({
        type: 'chart' as const,
        value: chart,
      })),
    });
  }

  const estimatedPages = estimatePageCount(sections);
  const toc = buildTableOfContents(sections, estimatedPages);

  return {
    config,
    title: labels.comparativeAnalysis,
    subtitle: `${input.companyName} — ${input.periodA} vs ${input.periodB}`,
    header: buildHeader(config, labels.comparativeAnalysis),
    tableOfContents: toc,
    sections,
    footer: buildFooter(labels, config),
    estimatedPages,
    metadata: {
      reportType: 'comparative',
      locale: config.locale,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Generate a custom report PDF document from Report Builder config.
 *
 * Req 28.1: Professional layout.
 * Req 28.2: Support custom reports from Report Builder.
 * Req 28.6: Locale-aware text.
 */
export function generateCustomReport(
  config: PDFConfig,
  input: CustomReportInput,
): PDFDocument {
  const labels = getLocaleLabels(config.locale);

  const sections: PDFSection[] = input.sections.map((s, i) => ({
    id: `custom-${i}`,
    title: s.title,
    content: s.content,
  }));

  const estimatedPages = estimatePageCount(sections);
  const toc = buildTableOfContents(sections, estimatedPages);

  return {
    config,
    title: input.reportName,
    subtitle: input.description,
    header: buildHeader(config, input.reportName),
    tableOfContents: toc,
    sections,
    footer: buildFooter(labels, config),
    estimatedPages,
    metadata: {
      reportType: 'custom',
      locale: config.locale,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Generate an audit trail export PDF document.
 *
 * Req 28.1: Professional layout.
 * Req 28.2: Support audit trail exports.
 * Req 28.5: TOC for >5 pages.
 * Req 28.6: Locale-aware text.
 */
export function generateAuditTrailReport(
  config: PDFConfig,
  input: AuditTrailReportInput,
): PDFDocument {
  const labels = getLocaleLabels(config.locale);
  const { auditData } = input;

  const filterSummaryParts: string[] = [];
  if (auditData.filters.action_type) filterSummaryParts.push(`${labels.action}: ${auditData.filters.action_type}`);
  if (auditData.filters.user_id) filterSummaryParts.push(`${labels.user}: ${auditData.filters.user_id}`);
  if (auditData.filters.severity) filterSummaryParts.push(`${labels.severity}: ${auditData.filters.severity}`);
  if (auditData.filters.date_from) filterSummaryParts.push(`From: ${auditData.filters.date_from}`);
  if (auditData.filters.date_to) filterSummaryParts.push(`To: ${auditData.filters.date_to}`);

  const sections: PDFSection[] = [
    {
      id: 'summary',
      title: labels.auditTrail,
      content: [
        {
          type: 'text',
          value: `${labels.totalEntries}: ${auditData.total_entries}`,
        },
        ...(filterSummaryParts.length > 0
          ? [{ type: 'text' as const, value: `Filters: ${filterSummaryParts.join(' | ')}` }]
          : []),
        { type: 'spacer', height: 10 },
      ],
    },
    {
      id: 'entries',
      title: `${labels.auditTrail} — ${labels.totalEntries}: ${auditData.total_entries}`,
      content: [
        {
          type: 'table',
          value: {
            columns: [
              { key: 'created_at', header: labels.date, align: 'left' },
              { key: 'action_type', header: labels.action, align: 'left' },
              { key: 'resource_type', header: labels.resource, align: 'left' },
              { key: 'severity', header: labels.severity, align: 'center' },
              { key: 'user_id', header: labels.user, align: 'left' },
            ],
            rows: auditData.entries.map((e) => ({
              created_at: e.created_at,
              action_type: e.action_type,
              resource_type: e.resource_type,
              severity: e.severity,
              user_id: e.user_id,
            })),
          },
        },
      ],
    },
  ];

  const estimatedPages = estimatePageCount(sections);
  const toc = buildTableOfContents(sections, estimatedPages);

  return {
    config,
    title: labels.auditTrail,
    subtitle: `${config.companyName} — ${auditData.generated_at}`,
    header: buildHeader(config, labels.auditTrail),
    tableOfContents: toc,
    sections,
    footer: buildFooter(labels, config),
    estimatedPages,
    metadata: {
      reportType: 'audit_trail',
      locale: config.locale,
      generatedAt: new Date().toISOString(),
    },
  };
}
