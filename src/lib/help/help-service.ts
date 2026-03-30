/**
 * HelpService — Contextual articles, FAQ search, localized content, and video tutorials.
 *
 * Requirements: 31.1, 31.2, 31.3, 31.4, 31.5
 *
 * Content is stored in-memory (static) since it changes infrequently.
 * Localized for es, en, pt.
 *
 * @module lib/help/help-service
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type HelpLocale = 'es' | 'en' | 'pt';

export interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: 'faq' | 'guide' | 'reference';
  /** Routes where this article is contextually relevant (Req 31.3) */
  routes: string[];
  tags: string[];
}

export interface VideoTutorial {
  id: string;
  title: string;
  description: string;
  url: string;
  durationSeconds: number;
  /** Main flow this tutorial covers (Req 31.5) */
  flow: 'payroll-upload' | 'report-interpretation' | 'ai-provider-config' | 'general';
}

export interface HelpSearchResult {
  articles: HelpArticle[];
  query: string;
  total: number;
}

// ─── Localized Content Store (Req 31.4) ─────────────────────────────────────

const ARTICLES: Record<HelpLocale, HelpArticle[]> = {
  es: [
    { id: 'faq-upload', slug: 'como-cargar-nomina', title: '¿Cómo cargo una nómina?', summary: 'Pasos para cargar archivos de nómina en NominaSmart.', content: 'Navega a la sección de carga, selecciona tu archivo Excel y sigue el asistente de 4 pasos: carga, mapeo, auditoría y conciliación.', category: 'faq', routes: ['/dashboard', '/upload'], tags: ['carga', 'nómina', 'excel', 'upload'] },
    { id: 'faq-audit', slug: 'como-funciona-auditoria', title: '¿Cómo funciona la auditoría automática?', summary: 'Explicación del proceso de auditoría con IA.', content: 'NominaSmart usa 7 agentes de IA que analizan tu nómina buscando errores, inconsistencias y oportunidades de optimización. El proceso toma entre 30 segundos y 2 minutos.', category: 'faq', routes: ['/audit', '/reconcile'], tags: ['auditoría', 'ia', 'agentes', 'hallazgos'] },
    { id: 'faq-reports', slug: 'tipos-de-reportes', title: '¿Qué tipos de reportes puedo generar?', summary: 'Reportes disponibles: ejecutivo, detallado, comparativo, cumplimiento.', content: 'Puedes generar reportes ejecutivos, de detalle por empleado, comparativos entre periodos, de cumplimiento normativo y de análisis de costos. Todos exportables a PDF y Excel.', category: 'faq', routes: ['/reports'], tags: ['reportes', 'pdf', 'excel', 'exportar'] },
    { id: 'guide-ai-chat', slug: 'guia-chat-ia', title: 'Guía del Chat IA', summary: 'Cómo hacer preguntas en lenguaje natural sobre tu nómina.', content: 'Abre el panel de IA y escribe preguntas como "¿cuánto gastamos en salud el mes pasado?" o "compara enero vs febrero". El sistema interpreta tu consulta y responde con datos específicos.', category: 'guide', routes: ['/dashboard', '/ai'], tags: ['ia', 'chat', 'nlq', 'preguntas'] },
    { id: 'guide-workspace', slug: 'guia-workspaces', title: 'Guía de Workspaces', summary: 'Cómo organizar equipos y datos en workspaces.', content: 'Los workspaces permiten separar datos por filial, país o equipo. Cada workspace tiene sus propias planillas, reportes y configuraciones. Usa el selector en el header para cambiar entre ellos.', category: 'guide', routes: ['/admin', '/dashboard'], tags: ['workspace', 'equipo', 'organización'] },
    { id: 'ref-roles', slug: 'roles-permisos', title: 'Roles y Permisos', summary: 'Descripción de los roles: admin, analyst, client.', content: 'Admin: acceso completo incluyendo configuración. Analyst: carga, auditoría y reportes. Client: solo lectura de reportes y dashboard.', category: 'reference', routes: ['/admin/users'], tags: ['roles', 'permisos', 'rbac', 'admin'] },
    { id: 'faq-anomalies', slug: 'deteccion-anomalias', title: '¿Qué son las anomalías detectadas?', summary: 'Cómo la IA detecta patrones atípicos en tu nómina.', content: 'El detector de anomalías compara tus datos contra periodos anteriores y benchmarks de la industria para identificar valores atípicos, errores sistemáticos o variaciones sospechosas.', category: 'faq', routes: ['/dashboard', '/anomalies'], tags: ['anomalías', 'ia', 'fraude', 'detección'] },
    { id: 'guide-scheduled', slug: 'reportes-programados', title: 'Reportes Programados', summary: 'Cómo configurar reportes automáticos.', content: 'Ve a Reportes > Programados, configura el tipo, filtros, formato (PDF/Excel), destinatarios y frecuencia. Los reportes se generan y envían automáticamente.', category: 'guide', routes: ['/reports'], tags: ['reportes', 'programados', 'cron', 'automático'] },
  ],
  en: [
    { id: 'faq-upload', slug: 'how-to-upload-payroll', title: 'How do I upload a payroll?', summary: 'Steps to upload payroll files to NominaSmart.', content: 'Navigate to the upload section, select your Excel file and follow the 4-step wizard: upload, mapping, audit, and reconciliation.', category: 'faq', routes: ['/dashboard', '/upload'], tags: ['upload', 'payroll', 'excel', 'file'] },
    { id: 'faq-audit', slug: 'how-audit-works', title: 'How does the automatic audit work?', summary: 'Explanation of the AI-powered audit process.', content: 'NominaSmart uses 7 AI agents that analyze your payroll looking for errors, inconsistencies, and optimization opportunities. The process takes between 30 seconds and 2 minutes.', category: 'faq', routes: ['/audit', '/reconcile'], tags: ['audit', 'ai', 'agents', 'findings'] },
    { id: 'faq-reports', slug: 'report-types', title: 'What types of reports can I generate?', summary: 'Available reports: executive, detailed, comparative, compliance.', content: 'You can generate executive reports, employee detail reports, period comparisons, compliance reports, and cost analysis. All exportable to PDF and Excel.', category: 'faq', routes: ['/reports'], tags: ['reports', 'pdf', 'excel', 'export'] },
    { id: 'guide-ai-chat', slug: 'ai-chat-guide', title: 'AI Chat Guide', summary: 'How to ask natural language questions about your payroll.', content: 'Open the AI panel and type questions like "how much did we spend on health last month?" or "compare January vs February". The system interprets your query and responds with specific data.', category: 'guide', routes: ['/dashboard', '/ai'], tags: ['ai', 'chat', 'nlq', 'questions'] },
    { id: 'guide-workspace', slug: 'workspace-guide', title: 'Workspace Guide', summary: 'How to organize teams and data in workspaces.', content: 'Workspaces let you separate data by subsidiary, country, or team. Each workspace has its own payrolls, reports, and settings. Use the selector in the header to switch between them.', category: 'guide', routes: ['/admin', '/dashboard'], tags: ['workspace', 'team', 'organization'] },
    { id: 'ref-roles', slug: 'roles-permissions', title: 'Roles and Permissions', summary: 'Description of roles: admin, analyst, client.', content: 'Admin: full access including configuration. Analyst: upload, audit, and reports. Client: read-only access to reports and dashboard.', category: 'reference', routes: ['/admin/users'], tags: ['roles', 'permissions', 'rbac', 'admin'] },
    { id: 'faq-anomalies', slug: 'anomaly-detection', title: 'What are detected anomalies?', summary: 'How AI detects atypical patterns in your payroll.', content: 'The anomaly detector compares your data against previous periods and industry benchmarks to identify outliers, systematic errors, or suspicious variations.', category: 'faq', routes: ['/dashboard', '/anomalies'], tags: ['anomalies', 'ai', 'fraud', 'detection'] },
    { id: 'guide-scheduled', slug: 'scheduled-reports', title: 'Scheduled Reports', summary: 'How to set up automatic reports.', content: 'Go to Reports > Scheduled, configure the type, filters, format (PDF/Excel), recipients, and frequency. Reports are generated and sent automatically.', category: 'guide', routes: ['/reports'], tags: ['reports', 'scheduled', 'cron', 'automatic'] },
  ],
  pt: [
    { id: 'faq-upload', slug: 'como-carregar-folha', title: 'Como carrego uma folha de pagamento?', summary: 'Passos para carregar arquivos de folha no NominaSmart.', content: 'Navegue até a seção de upload, selecione seu arquivo Excel e siga o assistente de 4 etapas: upload, mapeamento, auditoria e reconciliação.', category: 'faq', routes: ['/dashboard', '/upload'], tags: ['upload', 'folha', 'excel', 'arquivo'] },
    { id: 'faq-audit', slug: 'como-funciona-auditoria', title: 'Como funciona a auditoria automática?', summary: 'Explicação do processo de auditoria com IA.', content: 'O NominaSmart usa 7 agentes de IA que analisam sua folha buscando erros, inconsistências e oportunidades de otimização. O processo leva entre 30 segundos e 2 minutos.', category: 'faq', routes: ['/audit', '/reconcile'], tags: ['auditoria', 'ia', 'agentes', 'achados'] },
    { id: 'faq-reports', slug: 'tipos-de-relatorios', title: 'Que tipos de relatórios posso gerar?', summary: 'Relatórios disponíveis: executivo, detalhado, comparativo, conformidade.', content: 'Você pode gerar relatórios executivos, de detalhe por funcionário, comparativos entre períodos, de conformidade e de análise de custos. Todos exportáveis para PDF e Excel.', category: 'faq', routes: ['/reports'], tags: ['relatórios', 'pdf', 'excel', 'exportar'] },
    { id: 'guide-ai-chat', slug: 'guia-chat-ia', title: 'Guia do Chat IA', summary: 'Como fazer perguntas em linguagem natural sobre sua folha.', content: 'Abra o painel de IA e digite perguntas como "quanto gastamos em saúde no mês passado?" ou "compare janeiro vs fevereiro". O sistema interpreta sua consulta e responde com dados específicos.', category: 'guide', routes: ['/dashboard', '/ai'], tags: ['ia', 'chat', 'nlq', 'perguntas'] },
    { id: 'guide-workspace', slug: 'guia-workspaces', title: 'Guia de Workspaces', summary: 'Como organizar equipes e dados em workspaces.', content: 'Os workspaces permitem separar dados por filial, país ou equipe. Cada workspace tem suas próprias folhas, relatórios e configurações. Use o seletor no cabeçalho para alternar entre eles.', category: 'guide', routes: ['/admin', '/dashboard'], tags: ['workspace', 'equipe', 'organização'] },
    { id: 'ref-roles', slug: 'papeis-permissoes', title: 'Papéis e Permissões', summary: 'Descrição dos papéis: admin, analyst, client.', content: 'Admin: acesso completo incluindo configuração. Analyst: upload, auditoria e relatórios. Client: acesso somente leitura a relatórios e dashboard.', category: 'reference', routes: ['/admin/users'], tags: ['papéis', 'permissões', 'rbac', 'admin'] },
    { id: 'faq-anomalies', slug: 'deteccao-anomalias', title: 'O que são anomalias detectadas?', summary: 'Como a IA detecta padrões atípicos na sua folha.', content: 'O detector de anomalias compara seus dados com períodos anteriores e benchmarks da indústria para identificar valores atípicos, erros sistemáticos ou variações suspeitas.', category: 'faq', routes: ['/dashboard', '/anomalies'], tags: ['anomalias', 'ia', 'fraude', 'detecção'] },
    { id: 'guide-scheduled', slug: 'relatorios-programados', title: 'Relatórios Programados', summary: 'Como configurar relatórios automáticos.', content: 'Vá para Relatórios > Programados, configure o tipo, filtros, formato (PDF/Excel), destinatários e frequência. Os relatórios são gerados e enviados automaticamente.', category: 'guide', routes: ['/reports'], tags: ['relatórios', 'programados', 'cron', 'automático'] },
  ],
};

// ─── Video Tutorials (Req 31.5) ─────────────────────────────────────────────

const VIDEOS: Record<HelpLocale, VideoTutorial[]> = {
  es: [
    { id: 'vid-upload', title: 'Cómo cargar una nómina', description: 'Tutorial paso a paso del proceso de carga.', url: 'https://nominasmart.com/tutorials/es/upload', durationSeconds: 180, flow: 'payroll-upload' },
    { id: 'vid-reports', title: 'Interpretación de reportes', description: 'Cómo leer y usar los reportes de auditoría.', url: 'https://nominasmart.com/tutorials/es/reports', durationSeconds: 240, flow: 'report-interpretation' },
    { id: 'vid-ai-config', title: 'Configuración de proveedores IA', description: 'Cómo configurar y priorizar proveedores de IA.', url: 'https://nominasmart.com/tutorials/es/ai-config', durationSeconds: 150, flow: 'ai-provider-config' },
  ],
  en: [
    { id: 'vid-upload', title: 'How to upload a payroll', description: 'Step-by-step upload tutorial.', url: 'https://nominasmart.com/tutorials/en/upload', durationSeconds: 180, flow: 'payroll-upload' },
    { id: 'vid-reports', title: 'Report interpretation', description: 'How to read and use audit reports.', url: 'https://nominasmart.com/tutorials/en/reports', durationSeconds: 240, flow: 'report-interpretation' },
    { id: 'vid-ai-config', title: 'AI provider configuration', description: 'How to configure and prioritize AI providers.', url: 'https://nominasmart.com/tutorials/en/ai-config', durationSeconds: 150, flow: 'ai-provider-config' },
  ],
  pt: [
    { id: 'vid-upload', title: 'Como carregar uma folha', description: 'Tutorial passo a passo do processo de upload.', url: 'https://nominasmart.com/tutorials/pt/upload', durationSeconds: 180, flow: 'payroll-upload' },
    { id: 'vid-reports', title: 'Interpretação de relatórios', description: 'Como ler e usar os relatórios de auditoria.', url: 'https://nominasmart.com/tutorials/pt/reports', durationSeconds: 240, flow: 'report-interpretation' },
    { id: 'vid-ai-config', title: 'Configuração de provedores IA', description: 'Como configurar e priorizar provedores de IA.', url: 'https://nominasmart.com/tutorials/pt/ai-config', durationSeconds: 150, flow: 'ai-provider-config' },
  ],
};

// ─── Default locale ─────────────────────────────────────────────────────────

const DEFAULT_LOCALE: HelpLocale = 'es';

function resolveLocale(locale?: string): HelpLocale {
  if (locale === 'es' || locale === 'en' || locale === 'pt') return locale;
  return DEFAULT_LOCALE;
}

// ─── Contextual Articles (Req 31.3) ─────────────────────────────────────────

/**
 * Get help articles relevant to the current page/route.
 */
export function getArticlesByRoute(
  route: string,
  locale?: string,
): HelpArticle[] {
  const loc = resolveLocale(locale);
  return ARTICLES[loc].filter((a) =>
    a.routes.some((r) => route.startsWith(r)),
  );
}

// ─── Search (Req 31.2) ─────────────────────────────────────────────────────

/**
 * Search across FAQ and articles by query string.
 * Matches against title, summary, content, and tags.
 */
export function searchHelp(
  query: string,
  locale?: string,
): HelpSearchResult {
  const loc = resolveLocale(locale);
  const q = query.toLowerCase().trim();

  if (!q) {
    return { articles: [], query, total: 0 };
  }

  const terms = q.split(/\s+/);
  const articles = ARTICLES[loc].filter((a) => {
    const searchable = [a.title, a.summary, a.content, ...a.tags]
      .join(' ')
      .toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });

  return { articles, query, total: articles.length };
}

// ─── Get All Articles (Req 31.2) ────────────────────────────────────────────

/**
 * Get all help articles for a locale.
 */
export function getAllArticles(locale?: string): HelpArticle[] {
  return ARTICLES[resolveLocale(locale)];
}

/**
 * Get articles by category.
 */
export function getArticlesByCategory(
  category: 'faq' | 'guide' | 'reference',
  locale?: string,
): HelpArticle[] {
  return ARTICLES[resolveLocale(locale)].filter((a) => a.category === category);
}

/**
 * Get a single article by id.
 */
export function getArticleById(
  id: string,
  locale?: string,
): HelpArticle | null {
  return ARTICLES[resolveLocale(locale)].find((a) => a.id === id) ?? null;
}

// ─── Video Tutorials (Req 31.5) ─────────────────────────────────────────────

/**
 * Get all video tutorials for a locale.
 */
export function getVideoTutorials(locale?: string): VideoTutorial[] {
  return VIDEOS[resolveLocale(locale)];
}

/**
 * Get video tutorials for a specific flow.
 */
export function getVideosByFlow(
  flow: VideoTutorial['flow'],
  locale?: string,
): VideoTutorial[] {
  return VIDEOS[resolveLocale(locale)].filter((v) => v.flow === flow);
}
