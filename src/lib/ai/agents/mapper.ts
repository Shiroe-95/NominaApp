import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';
import type {
  AgentContext,
  AgentDefinition,
  AgentResult,
  ToolDefinition,
} from '../types';
import { normalizeHeader } from '../../payroll/conceptClassifier';
import { COUNTRY_CURRENCY_MAP, type CurrencyInfo } from '../../i18n/currency';

// ── Mapping types ───────────────────────────────────────────────────

export type MappingCategory =
  | 'identity'
  | 'salary_base'
  | 'non_salary'
  | 'ibc'
  | 'contribution'
  | 'contract'
  | 'informational';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  category: MappingCategory;
  confidence: 'high' | 'medium' | 'low';
  matchMethod: 'synonym' | 'ai' | 'created';
}

export interface LocaleParsingHints {
  decimalSeparator: string;
  thousandsSeparator: string;
  currencyCode: string;
  dateFormat: string;
  notes: string;
}

export interface MappingReport {
  mappings: ColumnMapping[];
  totalColumns: number;
  synonymMatches: number;
  aiMatches: number;
  createdFields: number;
  detectedLanguage?: string;
  localeHints?: LocaleParsingHints;
}

// ── Synonym dictionary for Colombian payroll terms (Req 8.1) ────────

interface SynonymEntry {
  target: string;
  category: MappingCategory;
}

/**
 * Colombian payroll synonym dictionary.
 * Maps normalized header patterns to standard field names and categories.
 * Reuses normalizeHeader from conceptClassifier for consistent normalization.
 */
const SYNONYM_DICTIONARY: Array<{ patterns: RegExp[]; target: string; category: MappingCategory }> = [
  // Identity fields
  {
    patterns: [/^cedula$/, /^documento$/, /^numero de documento$/, /^identificacion$/, /^nit$/, /^cc$/],
    target: 'document_number',
    category: 'identity',
  },
  {
    patterns: [/^nombre$/, /^nombre completo$/, /^empleado$/, /^nombre empleado$/, /^trabajador$/],
    target: 'employee_name',
    category: 'identity',
  },
  {
    patterns: [/^tipo de documento$/, /^tipo documento$/, /^tipo doc$/],
    target: 'document_type',
    category: 'identity',
  },
  {
    patterns: [/^codigo empleado$/, /^codigo$/, /^id empleado$/],
    target: 'employee_code',
    category: 'identity',
  },

  // Contract fields
  {
    patterns: [/^cargo$/, /^puesto$/, /^posicion$/],
    target: 'position',
    category: 'contract',
  },
  {
    patterns: [/^area$/, /^departamento$/, /^dependencia$/, /^seccion$/],
    target: 'department',
    category: 'contract',
  },
  {
    patterns: [/^fecha de ingreso$/, /^fecha ingreso$/, /^fecha inicio$/],
    target: 'start_date',
    category: 'contract',
  },
  {
    patterns: [/^fecha de retiro$/, /^fecha retiro$/, /^fecha fin$/],
    target: 'end_date',
    category: 'contract',
  },
  {
    patterns: [/^tipo de contrato$/, /^tipo contrato$/],
    target: 'contract_type',
    category: 'contract',
  },
  {
    patterns: [/^dias laborados$/, /^dias trabajados$/],
    target: 'days_worked',
    category: 'contract',
  },

  // Salary base fields
  {
    patterns: [/^salario$/, /^salario basico$/, /^sueldo$/, /^sueldo basico$/, /^base salarial$/, /^salario base$/],
    target: 'base_salary',
    category: 'salary_base',
  },
  {
    patterns: [/^total devengado$/, /^devengado$/, /^total devengados$/],
    target: 'gross_pay',
    category: 'salary_base',
  },
  {
    patterns: [/^neto a pagar$/, /^neto$/, /^pago neto$/, /^total a pagar$/],
    target: 'net_pay',
    category: 'salary_base',
  },

  // Non-salary fields
  {
    patterns: [/^auxilio de transporte$/, /^aux transporte$/, /^transporte$/],
    target: 'transport_allowance',
    category: 'non_salary',
  },
  {
    patterns: [/^pagos no salariales$/, /^no salarial$/, /^ingresos no salariales$/],
    target: 'non_salary_payments',
    category: 'non_salary',
  },
  {
    patterns: [/^bonificacion$/, /^bono$/, /^bonificaciones$/],
    target: 'bonus',
    category: 'non_salary',
  },
  {
    patterns: [/^comision$/, /^comisiones$/],
    target: 'commissions',
    category: 'non_salary',
  },
  {
    patterns: [/^horas extra$/, /^horas extras$/, /^hora extra$/],
    target: 'overtime_pay',
    category: 'non_salary',
  },
  {
    patterns: [/^recargo nocturno$/, /^nocturno$/],
    target: 'night_surcharge',
    category: 'non_salary',
  },
  {
    patterns: [/^dominical$/, /^festivo$/, /^dominicales y festivos$/],
    target: 'holiday_pay',
    category: 'non_salary',
  },

  // IBC fields
  {
    patterns: [/^ibc$/, /^ibc total$/, /^ingreso base de cotizacion$/, /^base de cotizacion$/],
    target: 'ibc_total',
    category: 'ibc',
  },
  {
    patterns: [/^ibc salud$/, /^ibc eps$/],
    target: 'ibc_health',
    category: 'ibc',
  },
  {
    patterns: [/^ibc pension$/, /^ibc afp$/],
    target: 'ibc_pension',
    category: 'ibc',
  },
  {
    patterns: [/^ibc arl$/, /^ibc riesgos$/],
    target: 'ibc_arl',
    category: 'ibc',
  },

  // Contribution fields
  {
    patterns: [/^aporte salud empleado$/, /^salud empleado$/, /^descuento salud$/, /^eps empleado$/],
    target: 'health_employee_deduction',
    category: 'contribution',
  },
  {
    patterns: [/^aporte pension empleado$/, /^pension empleado$/, /^descuento pension$/, /^afp empleado$/],
    target: 'pension_employee_deduction',
    category: 'contribution',
  },
  {
    patterns: [/^aporte salud empleador$/, /^salud empleador$/, /^eps empleador$/],
    target: 'health_employer_contribution',
    category: 'contribution',
  },
  {
    patterns: [/^aporte pension empleador$/, /^pension empleador$/, /^afp empleador$/],
    target: 'pension_employer_contribution',
    category: 'contribution',
  },
  {
    patterns: [/^arl$/, /^aporte arl$/, /^riesgos laborales$/],
    target: 'arl_contribution',
    category: 'contribution',
  },
  {
    patterns: [/^parafiscales$/, /^aportes parafiscales$/],
    target: 'parafiscales_total',
    category: 'contribution',
  },
  {
    patterns: [/^sena$/, /^aporte sena$/],
    target: 'sena_contribution',
    category: 'contribution',
  },
  {
    patterns: [/^icbf$/, /^aporte icbf$/],
    target: 'icbf_contribution',
    category: 'contribution',
  },
  {
    patterns: [/^caja de compensacion$/, /^caja compensacion$/, /^ccf$/],
    target: 'compensation_fund',
    category: 'contribution',
  },
  {
    patterns: [/^cesantias$/, /^provision cesantias$/],
    target: 'cesantias_provision',
    category: 'contribution',
  },
  {
    patterns: [/^intereses cesantias$/, /^intereses de cesantias$/],
    target: 'cesantias_interest',
    category: 'contribution',
  },
  {
    patterns: [/^prima$/, /^prima de servicios$/, /^provision prima$/],
    target: 'prima_provision',
    category: 'contribution',
  },
  {
    patterns: [/^vacaciones$/, /^provision vacaciones$/],
    target: 'vacation_provision',
    category: 'contribution',
  },
  {
    patterns: [/^retencion en la fuente$/, /^retefuente$/, /^retencion fuente$/],
    target: 'income_tax_withholding',
    category: 'contribution',
  },
  {
    patterns: [/^fondo de solidaridad$/, /^fsp$/, /^solidaridad pensional$/],
    target: 'solidarity_fund',
    category: 'contribution',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Looks up a column header in the synonym dictionary.
 * Returns the matching entry or null if no match is found.
 */
function lookupSynonym(header: string): SynonymEntry | null {
  const normalized = normalizeHeader(header);

  for (const entry of SYNONYM_DICTIONARY) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) {
      return { target: entry.target, category: entry.category };
    }
  }

  return null;
}

/**
 * Converts a column header to a snake_case field name (Req 8.3).
 * Strips accents, replaces spaces/special chars with underscores.
 */
export function toSnakeCase(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

// ── Language detection & locale helpers ──────────────────────────────

/**
 * Common payroll-related keywords per language for header language detection.
 * We check normalized (accent-stripped, lowercase) headers against these.
 */
const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  es: ['salario', 'sueldo', 'empleado', 'cedula', 'nomina', 'devengado', 'descuento', 'aporte', 'vacaciones', 'prima', 'cargo', 'dias'],
  pt: ['salario', 'funcionario', 'empregado', 'desconto', 'ferias', 'beneficio', 'contribuicao', 'cargo', 'admissao', 'rescisao', 'fgts', 'inss', 'irrf', 'vale'],
  en: ['salary', 'employee', 'deduction', 'allowance', 'gross', 'net', 'overtime', 'department', 'position', 'hire', 'bonus', 'tax', 'withholding'],
};

/**
 * Detect the most likely language of column headers by keyword frequency.
 * Returns the ISO 639-1 code (es, pt, en) or 'unknown'.
 */
export function detectHeaderLanguage(headers: string[]): string {
  const scores: Record<string, number> = { es: 0, pt: 0, en: 0 };

  for (const header of headers) {
    const normalized = header
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '');

    for (const [lang, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
      for (const kw of keywords) {
        if (normalized.includes(kw)) {
          scores[lang]++;
        }
      }
    }
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'unknown';
}

/** Date format conventions per country. */
const COUNTRY_DATE_FORMATS: Record<string, string> = {
  CO: 'DD/MM/YYYY',
  MX: 'DD/MM/YYYY',
  PE: 'DD/MM/YYYY',
  CL: 'DD-MM-YYYY',
  BR: 'DD/MM/YYYY',
  AR: 'DD/MM/YYYY',
  US: 'MM/DD/YYYY',
};

/**
 * Build locale-aware parsing hints from the country code.
 */
function buildLocaleHints(countryCode: string): LocaleParsingHints | undefined {
  const currency: CurrencyInfo | undefined = COUNTRY_CURRENCY_MAP[countryCode];
  if (!currency) return undefined;

  return {
    decimalSeparator: currency.decimalSeparator,
    thousandsSeparator: currency.thousandsSeparator,
    currencyCode: currency.currencyCode,
    dateFormat: COUNTRY_DATE_FORMATS[countryCode] ?? 'DD/MM/YYYY',
    notes: `Use "${currency.decimalSeparator}" as decimal separator and "${currency.thousandsSeparator}" as thousands separator for ${countryCode}. Currency: ${currency.currencyCode}.`,
  };
}

// ── Zod schema for AI disambiguation ────────────────────────────────

const AiMappingSuggestionSchema = z.object({
  mappings: z.array(
    z.object({
      sourceColumn: z.string().describe('Nombre original de la columna'),
      targetField: z.string().describe('Campo estándar sugerido en snake_case'),
      category: z
        .enum(['identity', 'salary_base', 'non_salary', 'ibc', 'contribution', 'contract', 'informational'])
        .describe('Categoría de análisis del campo'),
      confidence: z
        .enum(['high', 'medium', 'low'])
        .describe('Nivel de confianza en el mapeo'),
    }),
  ),
});

type AiMappingSuggestion = z.infer<typeof AiMappingSuggestionSchema>;

// ── System prompt ───────────────────────────────────────────────────

const MAPPER_SYSTEM_PROMPT = `Eres el Agente Mapeador de NóminaSmart, especializado en mapear columnas de archivos de nómina a campos estándar del sistema.

Tu rol es analizar nombres de columnas ambiguos que no coinciden con el diccionario de sinónimos y determinar a qué campo estándar corresponden.

IMPORTANTE — Soporte multi-idioma:
- Las columnas pueden estar en español, portugués, inglés u otros idiomas.
- Debes reconocer términos de nómina en cualquier idioma y mapearlos al campo estándar correspondiente.
- Ejemplos de mapeo cross-idioma:
  - "salário base" (PT) → base_salary
  - "base salary" (EN) → base_salary
  - "salario basico" (ES) → base_salary
  - "funcionário" (PT) → employee_name
  - "employee name" (EN) → employee_name
  - "férias" (PT) → vacation_provision
  - "vacation" (EN) → vacation_provision
  - "FGTS" (PT-BR) → fgts_contribution
  - "INSS" (PT-BR) → social_security_deduction
  - "IRRF" (PT-BR) → income_tax_withholding
  - "13º salário" (PT-BR) → thirteenth_salary
  - "aguinaldo" (ES-MX) → thirteenth_salary
  - "ISR" (ES-MX) → income_tax_withholding
  - "IMSS" (ES-MX) → social_security_deduction
  - "AFP" (ES-CL/PE) → pension_contribution

Campos estándar del sistema:
- identity: document_number, employee_name, document_type, employee_code
- contract: position, department, start_date, end_date, contract_type, days_worked
- salary_base: base_salary, gross_pay, net_pay
- non_salary: transport_allowance, non_salary_payments, bonus, commissions, overtime_pay, night_surcharge, holiday_pay
- ibc: ibc_total, ibc_health, ibc_pension, ibc_arl
- contribution: health_employee_deduction, pension_employee_deduction, health_employer_contribution, pension_employer_contribution, arl_contribution, parafiscales_total, sena_contribution, icbf_contribution, compensation_fund, cesantias_provision, cesantias_interest, prima_provision, vacation_provision, income_tax_withholding, solidarity_fund

Reglas:
- Si reconoces la columna como un campo estándar de nómina (de cualquier país/idioma), mapéala al campo correspondiente
- Si la columna es ambigua pero puedes inferir su significado por contexto, asigna la categoría más probable
- Si no puedes determinar el campo estándar, crea un nombre en snake_case y clasifica como "informational"
- Usa datos de muestra de la columna (si disponibles) para mejorar la clasificación
- Presta atención a las pistas de formato numérico/fecha del país para interpretar datos de muestra correctamente
- Prioriza precisión sobre velocidad`;

// ── Agent factory ───────────────────────────────────────────────────

export function createMapperAgent(): AgentDefinition {
  const tools: ToolDefinition[] = [
    {
      name: 'mapColumns',
      description:
        'Mapea columnas de un archivo de nómina a campos estándar del sistema usando diccionario de sinónimos e IA.',
      parameters: {
        type: 'object',
        properties: {
          columns: { type: 'array', description: 'Lista de nombres de columnas del archivo' },
          sampleData: { type: 'array', description: 'Datos de muestra para contexto' },
        },
        required: ['columns'],
      },
    },
  ];

  async function execute(
    context: AgentContext,
    model: LanguageModel,
  ): Promise<AgentResult> {
    const startTime = Date.now();

    // Extract column headers from payroll data
    const rows = context.payrollData ?? [];
    const columns: string[] =
      rows.length > 0 ? Object.keys(rows[0]) : [];

    if (columns.length === 0) {
      const report: MappingReport = {
        mappings: [],
        totalColumns: 0,
        synonymMatches: 0,
        aiMatches: 0,
        createdFields: 0,
      };

      return {
        agentName: 'mapper',
        success: true,
        data: report,
        tokensUsed: 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: Date.now() - startTime,
      };
    }

    // Detect language of column headers
    const detectedLanguage = detectHeaderLanguage(columns);

    // Build locale-aware parsing hints from country code
    const localeHints = buildLocaleHints(context.countryCode);

    // Phase 1: Match columns using synonym dictionary (Req 8.1)
    const mappings: ColumnMapping[] = [];
    const ambiguousColumns: string[] = [];
    const usedTargets = new Set<string>();

    for (const column of columns) {
      const synonym = lookupSynonym(column);

      if (synonym && !usedTargets.has(synonym.target)) {
        mappings.push({
          sourceColumn: column,
          targetField: synonym.target,
          category: synonym.category,
          confidence: 'high',
          matchMethod: 'synonym',
        });
        usedTargets.add(synonym.target);
      } else {
        ambiguousColumns.push(column);
      }
    }

    // Phase 2: Use AI for ambiguous columns (Req 8.1 — AI for ambiguities)
    let tokensUsed = 0;

    if (ambiguousColumns.length > 0) {
      try {
        // Build sample data context for AI
        const sampleRows = rows.slice(0, 3);
        const sampleContext = ambiguousColumns.map((col) => {
          const samples = sampleRows
            .map((row) => String(row[col] ?? ''))
            .filter(Boolean)
            .slice(0, 3);
          return `"${col}": [${samples.map((s) => `"${s}"`).join(', ')}]`;
        });

        const alreadyMapped = mappings
          .map((m) => `"${m.sourceColumn}" → ${m.targetField} (${m.category})`)
          .join('\n');

        const localeContext = localeHints
          ? `\nContexto de locale (país: ${context.countryCode}):
- Separador decimal: "${localeHints.decimalSeparator}"
- Separador de miles: "${localeHints.thousandsSeparator}"
- Moneda: ${localeHints.currencyCode}
- Formato de fecha: ${localeHints.dateFormat}
Usa esta información para interpretar datos de muestra correctamente.\n`
          : '';

        const languageContext = detectedLanguage !== 'unknown'
          ? `\nIdioma detectado en las columnas: ${detectedLanguage}. Mapea los términos de este idioma a los campos estándar del sistema.\n`
          : '';

        const prompt = `Analiza las siguientes columnas ambiguas de un archivo de nómina y sugiere el mapeo a campos estándar.
${languageContext}${localeContext}
Columnas ya mapeadas por diccionario:
${alreadyMapped || '(ninguna)'}

Columnas ambiguas a mapear:
${sampleContext.join('\n')}

Para cada columna:
1. Si reconoces el campo, mapéalo al campo estándar correspondiente
2. Si no lo reconoces, crea un nombre en snake_case descriptivo y clasifica como "informational"
3. No repitas campos destino ya usados: ${Array.from(usedTargets).join(', ')}`;

        const { object, usage } = await generateObject({
          model,
          system: MAPPER_SYSTEM_PROMPT,
          prompt,
          schema: AiMappingSuggestionSchema,
        });

        tokensUsed = usage?.totalTokens ?? 0;

        const aiResult: AiMappingSuggestion = object;

        // Merge AI suggestions for ambiguous columns
        for (const column of ambiguousColumns) {
          const aiMapping = aiResult.mappings.find(
            (m) => m.sourceColumn === column,
          );

          if (aiMapping && !usedTargets.has(aiMapping.targetField)) {
            mappings.push({
              sourceColumn: column,
              targetField: aiMapping.targetField,
              category: aiMapping.category,
              confidence: aiMapping.confidence,
              matchMethod: 'ai',
            });
            usedTargets.add(aiMapping.targetField);
          } else {
            // Fallback: create snake_case field, classify as informational (Req 8.3)
            const snakeField = toSnakeCase(column);
            mappings.push({
              sourceColumn: column,
              targetField: usedTargets.has(snakeField) ? `${snakeField}_extra` : snakeField,
              category: 'informational',
              confidence: 'low',
              matchMethod: 'created',
            });
            usedTargets.add(snakeField);
          }
        }
      } catch {
        // If AI fails, fall back to creating snake_case fields for all ambiguous columns (Req 8.3)
        for (const column of ambiguousColumns) {
          const snakeField = toSnakeCase(column);
          mappings.push({
            sourceColumn: column,
            targetField: usedTargets.has(snakeField) ? `${snakeField}_extra` : snakeField,
            category: 'informational',
            confidence: 'low',
            matchMethod: 'created',
          });
          usedTargets.add(snakeField);
        }
      }
    }

    const report: MappingReport = {
      mappings,
      totalColumns: columns.length,
      synonymMatches: mappings.filter((m) => m.matchMethod === 'synonym').length,
      aiMatches: mappings.filter((m) => m.matchMethod === 'ai').length,
      createdFields: mappings.filter((m) => m.matchMethod === 'created').length,
      detectedLanguage: detectedLanguage !== 'unknown' ? detectedLanguage : undefined,
      localeHints,
    };

    return {
      agentName: 'mapper',
      success: true,
      data: report,
      tokensUsed,
      providerUsed: model.modelId ?? 'unknown',
      latencyMs: Date.now() - startTime,
    };
  }

  return {
    name: 'mapper',
    systemPrompt: MAPPER_SYSTEM_PROMPT,
    tools,
    execute,
  };
}
