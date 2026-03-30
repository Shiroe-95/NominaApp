export type MappingAnalysisCategory =
    | 'identity'
    | 'salary_base'
    | 'non_salary'
    | 'ibc'
    | 'contribution'
    | 'contract'
    | 'informational';

export interface MappingRelationInput {
    source: string;
    target: string;
    analysisCategory: MappingAnalysisCategory;
    isCreated: boolean;
    requiredByRule: boolean;
}

export interface MatrixInput {
    headers: string[];
    rows: unknown[][];
    formulas?: (string | null)[][];
    fileName?: string;
    sheetName?: string;
}

import {
    getHardcodedConstants,
    loadRulesForCountry,
    parseChecksToConstants,
    type CountryYearRuleRow,
} from '@/lib/ai/rule-engine';
import { COUNTRY_CURRENCY_MAP } from '@/lib/i18n/currency';

/**
 * Constantes normativas extraídas de las reglas de un país/año.
 *
 * Se obtienen desde la tabla `country_year_rules` (parseando los checks)
 * o desde las constantes hardcodeadas como fallback. Los campos opcionales
 * permiten que el motor de validación adapte las verificaciones según el
 * país: por ejemplo, cesantías y prima solo aplican en Colombia, mientras
 * que otros países pueden tener tasas de salud/pensión distintas.
 *
 * @see parseConstantsFromDbRule — extrae smmlv e ibcMaxSmmlv de los checks.
 * @see parseChecksToConstants — extrae tasas porcentuales detalladas (rule-engine).
 */
interface RuleConstants {
    /** Salario mínimo mensual legal vigente del país/año. */
    smmlv: number;
    /** Múltiplo máximo de SMMLV para el tope del IBC (típicamente 25). */
    ibcMaxSmmlv: number;
    /** Tasas parseadas de los checks de BD — undefined indica "usar valor por defecto". */
    healthEmployee?: number;
    healthEmployer?: number;
    pensionEmployee?: number;
    pensionEmployer?: number;
    /** Conceptos específicos del país que pueden no existir en todas las legislaciones. */
    hasCesantias?: boolean;
    hasPrima?: boolean;
    hasParafiscales?: boolean;
    hasTransportAllowance?: boolean;
    hasArl?: boolean;
}

export interface CheckResult {
    id: string;
    label: string;
    passedRows: number;
    failedRows: number;
    sampleFindings: string[];
    missingDependencies?: string[];
    potentialMatches?: Record<string, string>;
    /** Severity of the check: high = critical compliance, medium = calculation error, low = informational */
    severity?: 'high' | 'medium' | 'low';
}

export interface ValidationReport {
    countryCode: string;
    year: number;
    rowsAnalyzed: number;
    rowsWithFindings: number;
    criticalFindings: number;
    checks: CheckResult[];
    coverage: {
        totalHeaders: number;
        mappedHeaders: number;
        unmappedHeaders: string[];
        createdFieldsMapped: string[];
    };
}

export const CURRENCY_TARGET_FIELDS = [
    'base_salary',
    'gross_pay',
    'non_salary_payments',
    'transport_allowance',
    'ibc_total',
    'ibc_salud',
    'ibc_pension',
    'ibc_arl',
    'tope_40_no_salarial',
    'health_employee_deduction',
    'pension_employee_deduction',
    'salud_empleador',
    'pension_empleador',
    'arl_value',
    'parafiscales_total',
    'cesantias_provision',
    'prima_provision',
    'vacation_provision',
];

/**
 * Normaliza un texto para comparación: minúsculas, sin acentos, espacios colapsados.
 * @param value - Texto a normalizar.
 * @returns Texto normalizado.
 */
function normalize(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Convierte un valor arbitrario a número finito.
 * Soporta strings con formato monetario (puntos de miles, comas decimales).
 * @param value - Valor a convertir (number, string, Date u otro).
 * @returns Número finito, o 0 si la conversión falla.
 */
function toNumber(value: unknown) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9,.-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.');
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

/**
 * Countries that have specific payroll concepts.
 * Used to gracefully skip checks that don't apply to a country.
 */
const COUNTRY_CONCEPTS: Record<string, { cesantias: boolean; prima: boolean; parafiscales: boolean; transportAllowance: boolean; arl: boolean }> = {
    CO: { cesantias: true, prima: true, parafiscales: true, transportAllowance: true, arl: true },
    MX: { cesantias: true, prima: true, parafiscales: true, transportAllowance: false, arl: true }, // Aguinaldo, PTU, IMSS
    PE: { cesantias: true, prima: true, parafiscales: true, transportAllowance: false, arl: true }, // CTS, Gratificación, EsSalud
    CL: { cesantias: false, prima: false, parafiscales: false, transportAllowance: false, arl: true }, // AFP, Fonasa/Isapre
    BR: { cesantias: true, prima: true, parafiscales: true, transportAllowance: true, arl: true }, // FGTS, 13º, INSS
    AR: { cesantias: false, prima: true, parafiscales: true, transportAllowance: false, arl: true }, // SAC, contribuciones patronales
    US: { cesantias: false, prima: false, parafiscales: true, transportAllowance: false, arl: false }, // FICA, FUTA
};

/**
 * Extract numeric constants from a DB rule row's checks array.
 * Uses parseChecksToConstants for robust multi-format parsing.
 */
function parseConstantsFromDbRule(rule: CountryYearRuleRow, countryCode: string): RuleConstants | null {
    const parsed = parseChecksToConstants(rule.checks);

    if (!parsed.smmlv || parsed.smmlv <= 0) return null;

    const concepts = COUNTRY_CONCEPTS[countryCode] ?? { cesantias: false, prima: false, parafiscales: false, transportAllowance: false, arl: false };

    return {
        smmlv: parsed.smmlv,
        ibcMaxSmmlv: parsed.ibcMax ?? 25,
        healthEmployee: parsed.healthEmployee,
        healthEmployer: parsed.healthEmployer,
        pensionEmployee: parsed.pensionEmployee,
        pensionEmployer: parsed.pensionEmployer,
        hasCesantias: concepts.cesantias,
        hasPrima: concepts.prima,
        hasParafiscales: concepts.parafiscales,
        hasTransportAllowance: concepts.transportAllowance,
        hasArl: concepts.arl,
    };
}

/**
 * Resuelve las constantes normativas para un país/año.
 *
 * Prioriza la extracción desde la regla de BD (`dbRule`). Si no se puede
 * parsear, recurre a las constantes hardcodeadas del rule-engine.
 *
 * @param countryCode - Código ISO del país (ej. 'CO', 'MX').
 * @param year - Año fiscal.
 * @param dbRule - Fila de regla de BD pre-cargada (opcional).
 * @returns Constantes normativas o null si no se encuentran para ese país/año.
 */
function getRuleConstants(countryCode: string, year: number, dbRule?: CountryYearRuleRow | null): RuleConstants | null {
    // 1. Try to extract from DB rule if provided
    if (dbRule) {
        const parsed = parseConstantsFromDbRule(dbRule, countryCode);
        if (parsed) return parsed;
    }
    // 2. Fall back to hardcoded constants + country concepts
    const hc = getHardcodedConstants(countryCode, year);
    if (!hc) return null;
    const concepts = COUNTRY_CONCEPTS[countryCode] ?? { cesantias: false, prima: false, parafiscales: false, transportAllowance: false, arl: false };
    return {
        ...hc,
        hasCesantias: concepts.cesantias,
        hasPrima: concepts.prima,
        hasParafiscales: concepts.parafiscales,
        hasTransportAllowance: concepts.transportAllowance,
        hasArl: concepts.arl,
    };
}

/**
 * Retorna todos los índices de columna mapeados a un campo destino.
 * @param headerIndexByNormalized - Mapa de encabezado normalizado → índice de columna.
 * @param relations - Relaciones de mapeo fuente→destino.
 * @param target - Campo destino estándar (ej. 'ibc_total').
 * @returns Array de índices de columna (puede estar vacío).
 */
function allIndexesForTarget(
    headerIndexByNormalized: Map<string, number>,
    relations: MappingRelationInput[],
    target: string
) {
    const matches = relations.filter((r) => r.target === target);
    if (matches.length === 0) return [];
    return matches
        .map((r) => headerIndexByNormalized.get(normalize(r.source)))
        .filter((idx): idx is number => typeof idx === 'number' && idx >= 0);
}

/**
 * Retorna el primer índice de columna mapeado a un campo destino, o -1.
 * @param headerIndexByNormalized - Mapa de encabezado normalizado → índice.
 * @param relations - Relaciones de mapeo.
 * @param target - Campo destino estándar.
 * @returns Índice de columna o -1 si no hay mapeo.
 */
function anyIndexForTarget(
    headerIndexByNormalized: Map<string, number>,
    relations: MappingRelationInput[],
    target: string
) {
    const indexes = allIndexesForTarget(headerIndexByNormalized, relations, target);
    return indexes.length > 0 ? indexes[0] : -1;
}

/**
 * Retorna índices de columna para todas las relaciones de una categoría de análisis.
 * @param headerIndexByNormalized - Mapa de encabezado normalizado → índice.
 * @param relations - Relaciones de mapeo.
 * @param category - Categoría de análisis (ej. 'salary_base', 'non_salary').
 * @returns Array de índices únicos.
 */
function indexesForCategory(
    headerIndexByNormalized: Map<string, number>,
    relations: MappingRelationInput[],
    category: MappingAnalysisCategory
) {
    const indexes = relations
        .filter((r) => r.analysisCategory === category)
        .map((r) => headerIndexByNormalized.get(normalize(r.source)))
        .filter((idx): idx is number => typeof idx === 'number' && idx >= 0);
    return Array.from(new Set(indexes));
}

function pushSample(samples: string[], message: string) {
    if (samples.length < 8) samples.push(message);
}

function createCurrencyFormatter(countryCode: string) {
    const info = COUNTRY_CURRENCY_MAP[countryCode] ?? COUNTRY_CURRENCY_MAP['CO'];
    return new Intl.NumberFormat(info.localeFormat, {
        style: 'currency',
        currency: info.currencyCode,
        maximumFractionDigits: 0,
    });
}

// Default formatter — overridden per-call in validatePayrollCalculations
let _fmt = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
});

const f = (val: number) => _fmt.format(val);

/**
 * Ejecuta las 14 verificaciones matemáticas y normativas sobre datos de nómina.
 *
 * Valida registros de nómina contra las reglas del país/año, incluyendo:
 * Ley 1393 (tope 40% no salarial), rangos IBC, consistencia de subsistemas,
 * elegibilidad de auxilio de transporte, tasas de aportes (salud, pensión,
 * parafiscales, ARL) y provisiones de prestaciones (cesantías, prima, vacaciones).
 *
 * Las constantes normativas (SMMLV, tasas) se extraen dinámicamente de la regla
 * de BD cuando está disponible, con fallback a valores hardcodeados.
 *
 * @param input - Datos de entrada para la validación.
 * @param input.countryCode - Código ISO del país (ej. 'CO').
 * @param input.year - Año fiscal de la nómina.
 * @param input.matrices - Matrices de datos (encabezados + filas) de los archivos cargados.
 * @param input.relations - Relaciones de mapeo columna fuente → campo estándar.
 * @param input.dbRule - Regla de BD pre-cargada (opcional). Evita consultas adicionales.
 * @returns Reporte de validación con hallazgos por verificación, cobertura y métricas.
 */
export function validatePayrollCalculations(input: {
    countryCode: string;
    year: number;
    matrices: MatrixInput[];
    relations: MappingRelationInput[];
    /** Pre-loaded DB rule row. When provided, constants are extracted from it. */
    dbRule?: CountryYearRuleRow | null;
}): ValidationReport {
    const rule = getRuleConstants(input.countryCode, input.year, input.dbRule);

    // Set currency formatter for this country
    _fmt = createCurrencyFormatter(input.countryCode);

    // Determine rates: prefer DB-parsed values, fall back to defaults
    const healthEmpRate = rule?.healthEmployee != null ? rule.healthEmployee / 100 : 0.04;
    const pensionEmpRate = rule?.pensionEmployee != null ? rule.pensionEmployee / 100 : 0.04;
    const healthEmployerRate = rule?.healthEmployer != null ? rule.healthEmployer / 100 : 0.085;
    const pensionEmployerRate = rule?.pensionEmployer != null ? rule.pensionEmployer / 100 : 0.12;

    // Country-specific concept flags
    const hasCesantias = rule?.hasCesantias ?? true;
    const hasPrima = rule?.hasPrima ?? true;
    const hasParafiscales = rule?.hasParafiscales ?? true;
    const hasTransportAllowance = rule?.hasTransportAllowance ?? true;
    const hasArl = rule?.hasArl ?? true;

    const dependencies: Record<string, string[]> = {
        ibc_rule_1393: ['base_salary', 'non_salary_payments', 'ibc_total'],
        tope_40_value: ['base_salary', 'non_salary_payments', 'tope_40_no_salarial'],
        ibc_min_max: ['ibc_total'],
        ibc_consistency_subsystems: ['ibc_total', 'ibc_salud', 'ibc_pension', 'ibc_arl'],
        transport_eligibility: ['base_salary', 'transport_allowance'],
        health_deduction_4pct: ['ibc_total', 'health_employee_deduction'],
        pension_deduction_4pct: ['ibc_total', 'pension_employee_deduction'],
        cesantias_rate: ['gross_pay', 'cesantias_provision'],
        prima_rate: ['gross_pay', 'prima_provision'],
        vacation_rate: ['base_salary', 'vacation_provision'],
        salud_empleador_rate: ['ibc_total', 'salud_empleador'],
        pension_empleador_rate: ['ibc_total', 'pension_empleador'],
        parafiscales_rate: ['ibc_total', 'parafiscales_total'],
        arl_bounds: ['ibc_total', 'arl_value'],
    };

    /** Severity map: high = critical compliance, medium = calculation, low = informational */
    const CHECK_SEVERITY: Record<string, 'high' | 'medium' | 'low'> = {
        ibc_rule_1393: 'high',
        tope_40_value: 'medium',
        ibc_min_max: 'high',
        ibc_consistency_subsystems: 'medium',
        transport_eligibility: 'low',
        health_deduction_4pct: 'high',
        pension_deduction_4pct: 'high',
        cesantias_rate: 'medium',
        prima_rate: 'medium',
        vacation_rate: 'medium',
        salud_empleador_rate: 'high',
        pension_empleador_rate: 'high',
        parafiscales_rate: 'medium',
        arl_bounds: 'medium',
    };

    const checks: Record<string, CheckResult> = {
        ibc_rule_1393: {
            id: 'ibc_rule_1393',
            label: 'Base de cotización: debe incluir exceso no salarial sobre tope permitido',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        tope_40_value: {
            id: 'tope_40_value',
            label: 'Tope de pagos no salariales consistente con exceso calculado',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        ibc_min_max: {
            id: 'ibc_min_max',
            label: 'Base de cotización dentro de rango legal por días trabajados',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        ibc_consistency_subsystems: {
            id: 'ibc_consistency_subsystems',
            label: 'Consistencia entre base de cotización total y subsistemas',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        transport_eligibility: {
            id: 'transport_eligibility',
            label: 'Auxilio de transporte: solo aplica si salario <= umbral legal',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        health_deduction_4pct: {
            id: 'health_deduction_4pct',
            label: `Descuento salud empleado: debe ser ${(healthEmpRate * 100).toFixed(1)}% de la base`,
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        pension_deduction_4pct: {
            id: 'pension_deduction_4pct',
            label: `Descuento pensión empleado: debe ser ${(pensionEmpRate * 100).toFixed(1)}% de la base`,
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        cesantias_rate: {
            id: 'cesantias_rate',
            label: 'Cesantías/Aguinaldo/13º: provisión según normativa local',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        prima_rate: {
            id: 'prima_rate',
            label: 'Prima/Gratificación: provisión según normativa local',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        vacation_rate: {
            id: 'vacation_rate',
            label: 'Vacaciones: provisión según normativa local',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        salud_empleador_rate: {
            id: 'salud_empleador_rate',
            label: `Aporte salud empleador: debe ser ${(healthEmployerRate * 100).toFixed(1)}% de la base`,
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        pension_empleador_rate: {
            id: 'pension_empleador_rate',
            label: `Aporte pensión empleador: debe ser ${(pensionEmployerRate * 100).toFixed(1)}% de la base`,
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        parafiscales_rate: {
            id: 'parafiscales_rate',
            label: 'Contribuciones patronales según normativa local',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        arl_bounds: {
            id: 'arl_bounds',
            label: 'Seguro de riesgos laborales dentro de rango normativo',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
    };

    let rowsAnalyzed = 0;
    let rowsWithFindings = 0;
    let criticalFindings = 0;

    const normalizedRelationSources = new Set(input.relations.map((r) => normalize(r.source)));
    const unmappedHeadersGlobal = new Set<string>();

    for (const matrix of input.matrices) {
        const normalizedHeaders = matrix.headers.map((h) => normalize(String(h ?? '')));
        const headerIndexByNormalized = new Map<string, number>();
        normalizedHeaders.forEach((h, idx) => {
            if (h && !headerIndexByNormalized.has(h)) {
                headerIndexByNormalized.set(h, idx);
            }
        });

        for (const header of matrix.headers) {
            const normalizedHeader = normalize(header);
            if (normalizedHeader && !normalizedRelationSources.has(normalizedHeader)) {
                unmappedHeadersGlobal.add(String(header));
            }
        }

        const salaryIdxs = indexesForCategory(headerIndexByNormalized, input.relations, 'salary_base');
        const nonSalaryIdxs = indexesForCategory(headerIndexByNormalized, input.relations, 'non_salary');
        const ibcTotalIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'ibc_total');
        const tope40Idxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'tope_40_no_salarial');
        const ibcSaludIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'ibc_salud');
        const ibcPensionIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'ibc_pension');
        const ibcArlIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'ibc_arl');
        const workedDaysIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'worked_days');
        const docIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'document_number');
        const transportIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'transport_allowance');
        const healthDeductionIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'health_employee_deduction');
        const pensionDeductionIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'pension_employee_deduction');
        const grossPayIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'gross_pay');
        const cesantiasIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'cesantias_provision');
        const primaIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'prima_provision');
        const vacationIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'vacation_provision');
        const saludEmpleadorIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'salud_empleador');
        const pensionEmpleadorIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'pension_empleador');
        const parafiscalesTotalIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'parafiscales_total');
        const arlValueIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'arl_value');
        const firstNameIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'first_name');
        const lastNameIdxs = allIndexesForTarget(headerIndexByNormalized, input.relations, 'last_name');

        for (const row of matrix.rows) {
            rowsAnalyzed += 1;
            let rowHasFinding = false;

            const document = docIdxs.length > 0 ? docIdxs.map(idx => String(row[idx] ?? '').trim()).filter(Boolean).join('-') : `fila_${rowsAnalyzed}`;
            const ibcValue = ibcTotalIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
            const firstName = firstNameIdxs.map(idx => String(row[idx] ?? '').trim()).filter(Boolean).join(' ');
            const lastName = lastNameIdxs.map(idx => String(row[idx] ?? '').trim()).filter(Boolean).join(' ');
            const fullName = `${firstName} ${lastName}`.trim();
            const displayName = fullName || document;

            const salaryTotal = salaryIdxs.reduce((acc, idx) => acc + toNumber(row[idx]), 0);
            const nonSalaryTotal = nonSalaryIdxs.reduce((acc, idx) => acc + toNumber(row[idx]), 0);
            const totalIncome = salaryTotal + nonSalaryTotal;

            if (totalIncome > 0) {
                const nonSalaryCap = totalIncome * 0.4;
                const expectedExcess = Math.max(0, nonSalaryTotal - nonSalaryCap);
                const expectedIbc = salaryTotal + expectedExcess;
                
                // Si no hay IBC reportado pero hay ingresos, calcular el esperado
                if (ibcTotalIdxs.length === 0 || ibcValue === 0) {
                    // No hay campo IBC mapeado - reportar el IBC que debería tener
                    if (expectedIbc > 0) {
                        checks.ibc_rule_1393.failedRows += 1;
                        rowHasFinding = true;
                        criticalFindings += 1;
                        pushSample(
                            checks.ibc_rule_1393.sampleFindings,
                            `${displayName}: SIN IBC reportado. IBC esperado ${f(expectedIbc)} (Salario: ${f(salaryTotal)}, No Salarial: ${f(nonSalaryTotal)}, Exceso 40%: ${f(expectedExcess)})`
                        );
                    }
                } else {
                    const diff = Math.abs(ibcValue - expectedIbc);
                    if (diff > 100) {
                        checks.ibc_rule_1393.failedRows += 1;
                        rowHasFinding = true;
                        criticalFindings += 1;
                        pushSample(
                            checks.ibc_rule_1393.sampleFindings,
                            `${displayName}: IBC reportado ${f(ibcValue)} vs esperado ${f(expectedIbc)} (Exceso 40%: ${f(expectedExcess)})`
                        );
                    } else {
                        checks.ibc_rule_1393.passedRows += 1;
                    }
                }

                if (tope40Idxs.length > 0) {
                    const tope40Value = tope40Idxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                    const topeDiff = Math.abs(tope40Value - expectedExcess);
                    if (topeDiff > 100) {
                        checks.tope_40_value.failedRows += 1;
                        rowHasFinding = true;
                        pushSample(
                            checks.tope_40_value.sampleFindings,
                            `${displayName}: tope_40 ${f(tope40Value)} vs esperado ${f(expectedExcess)}`
                        );
                    } else {
                        checks.tope_40_value.passedRows += 1;
                    }
                }
            }

            if (rule && ibcValue > 0) {
                const workedDaysValue = workedDaysIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                const workedDays = workedDaysIdxs.length > 0 ? Math.max(0, workedDaysValue) : 30;
                const proportionalMinIbc = rule.smmlv * (workedDays > 0 ? Math.min(workedDays, 30) / 30 : 1);
                const maxIbc = rule.smmlv * rule.ibcMaxSmmlv;

                if (ibcValue + 100 < proportionalMinIbc || ibcValue - 100 > maxIbc) {
                    checks.ibc_min_max.failedRows += 1;
                    rowHasFinding = true;
                    criticalFindings += 1;
                    pushSample(
                        checks.ibc_min_max.sampleFindings,
                        `${displayName}: IBC ${f(ibcValue)} fuera de rango [${f(proportionalMinIbc)} - ${f(maxIbc)}]`
                    );
                } else {
                    checks.ibc_min_max.passedRows += 1;
                }
            }

            const subsystemValues = [...ibcSaludIdxs, ...ibcPensionIdxs, ...ibcArlIdxs]
                .map((idx) => toNumber(row[idx]));

            if (subsystemValues.length > 0 && ibcValue > 0) {
                const inconsistent = subsystemValues.some((value) => Math.abs(value - ibcValue) > 100);
                if (inconsistent) {
                    checks.ibc_consistency_subsystems.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(
                        checks.ibc_consistency_subsystems.sampleFindings,
                        `${displayName}: IBC subsistemas no consistente con IBC total ${f(ibcValue)}`
                    );
                } else {
                    checks.ibc_consistency_subsystems.passedRows += 1;
                }
            }

            if (rule && transportIdxs.length > 0 && hasTransportAllowance) {
                const transportValue = transportIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                const twoSmmlv = rule.smmlv * 2;
                if (transportValue > 0 && salaryTotal > twoSmmlv + 100) {
                    checks.transport_eligibility.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(
                        checks.transport_eligibility.sampleFindings,
                        `${displayName}: auxilio transporte ${transportValue.toFixed(0)} pero salario ${salaryTotal.toFixed(0)} > 2 SMMLV (${twoSmmlv.toFixed(0)})`
                    );
                } else if (salaryTotal > 0) {
                    checks.transport_eligibility.passedRows += 1;
                }
            }

            // Calcular IBC efectivo para validaciones de aportes
            const ibcEfectivo = ibcValue > 0 ? ibcValue : (salaryTotal + Math.max(0, nonSalaryTotal - totalIncome * 0.4));
            
            if (ibcEfectivo > 0) {
                const healthDeduction = healthDeductionIdxs.length > 0 
                    ? healthDeductionIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0)
                    : 0;
                const expectedHealth = ibcEfectivo * healthEmpRate;
                
                if (healthDeductionIdxs.length === 0) {
                    checks.health_deduction_4pct.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(
                        checks.health_deduction_4pct.sampleFindings,
                        `${displayName}: SIN descuento salud. Esperado ${(healthEmpRate * 100).toFixed(1)}% de base: ${f(expectedHealth)}`
                    );
                } else if (Math.abs(healthDeduction - expectedHealth) > Math.max(100, expectedHealth * 0.01)) {
                    checks.health_deduction_4pct.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(
                        checks.health_deduction_4pct.sampleFindings,
                        `${displayName}: descuento salud ${f(healthDeduction)} vs esperado ${(healthEmpRate * 100).toFixed(1)}% de base ${f(expectedHealth)}`
                    );
                } else {
                    checks.health_deduction_4pct.passedRows += 1;
                }

                const pensionDeduction = pensionDeductionIdxs.length > 0
                    ? pensionDeductionIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0)
                    : 0;
                const expectedPension = ibcEfectivo * pensionEmpRate;
                
                if (pensionDeductionIdxs.length === 0) {
                    checks.pension_deduction_4pct.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(
                        checks.pension_deduction_4pct.sampleFindings,
                        `${displayName}: SIN descuento pensión. Esperado ${(pensionEmpRate * 100).toFixed(1)}% de base: ${f(expectedPension)}`
                    );
                } else if (Math.abs(pensionDeduction - expectedPension) > Math.max(100, expectedPension * 0.01)) {
                    checks.pension_deduction_4pct.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(
                        checks.pension_deduction_4pct.sampleFindings,
                        `${displayName}: descuento pensión ${f(pensionDeduction)} vs esperado ${(pensionEmpRate * 100).toFixed(1)}% de base ${f(expectedPension)}`
                    );
                } else {
                    checks.pension_deduction_4pct.passedRows += 1;
                }
            }

            const devengadoTotal = grossPayIdxs.length > 0 ? grossPayIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0) : totalIncome;

            if (hasCesantias && cesantiasIdxs.length > 0 && devengadoTotal > 0) {
                const cesantias = cesantiasIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                const expected = devengadoTotal * 0.0833;
                if (Math.abs(cesantias - expected) > Math.max(500, expected * 0.05)) {
                    checks.cesantias_rate.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(checks.cesantias_rate.sampleFindings,
                        `${displayName}: cesantías/aguinaldo ${cesantias.toFixed(0)} vs esperado ~8.33% de devengado ${expected.toFixed(0)}`);
                } else {
                    checks.cesantias_rate.passedRows += 1;
                }
            }

            if (hasPrima && primaIdxs.length > 0 && devengadoTotal > 0) {
                const prima = primaIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                const expected = devengadoTotal * 0.0833;
                if (Math.abs(prima - expected) > Math.max(500, expected * 0.05)) {
                    checks.prima_rate.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(checks.prima_rate.sampleFindings,
                        `${displayName}: prima/gratificación ${prima.toFixed(0)} vs esperado ~8.33% de devengado ${expected.toFixed(0)}`);
                } else {
                    checks.prima_rate.passedRows += 1;
                }
            }

            if (vacationIdxs.length > 0 && salaryTotal > 0) {
                const vacation = vacationIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                const expected = salaryTotal * 0.0417;
                if (Math.abs(vacation - expected) > Math.max(500, expected * 0.05)) {
                    checks.vacation_rate.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(checks.vacation_rate.sampleFindings,
                        `${displayName}: vacaciones ${vacation.toFixed(0)} vs esperado 4.17% de salario ${expected.toFixed(0)}`);
                } else {
                    checks.vacation_rate.passedRows += 1;
                }
            }

            if (saludEmpleadorIdxs.length > 0 && ibcValue > 0) {
                const saludEmp = saludEmpleadorIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                const expected = ibcValue * healthEmployerRate;
                if (Math.abs(saludEmp - expected) > Math.max(100, expected * 0.01)) {
                    checks.salud_empleador_rate.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(checks.salud_empleador_rate.sampleFindings,
                        `${displayName}: salud empleador ${saludEmp.toFixed(0)} vs esperado ${(healthEmployerRate * 100).toFixed(1)}% de base ${expected.toFixed(0)}`);
                } else {
                    checks.salud_empleador_rate.passedRows += 1;
                }
            }

            if (pensionEmpleadorIdxs.length > 0 && ibcValue > 0) {
                const pensionEmp = pensionEmpleadorIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                const expected = ibcValue * pensionEmployerRate;
                if (Math.abs(pensionEmp - expected) > Math.max(100, expected * 0.01)) {
                    checks.pension_empleador_rate.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(checks.pension_empleador_rate.sampleFindings,
                        `${displayName}: pensión empleador ${f(pensionEmp)} vs esperado ${(pensionEmployerRate * 100).toFixed(1)}% de base ${f(expected)}`);
                } else {
                    checks.pension_empleador_rate.passedRows += 1;
                }
            }

            if (hasParafiscales && parafiscalesTotalIdxs.length > 0 && ibcValue > 0) {
                const parafiscales = parafiscalesTotalIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                const expected = ibcValue * 0.09;
                if (Math.abs(parafiscales - expected) > Math.max(100, expected * 0.02)) {
                    checks.parafiscales_rate.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(checks.parafiscales_rate.sampleFindings,
                        `${displayName}: contribuciones patronales ${parafiscales.toFixed(0)} vs esperado ~9% de base ${expected.toFixed(0)}`);
                } else {
                    checks.parafiscales_rate.passedRows += 1;
                }
            }

            if (hasArl && arlValueIdxs.length > 0 && ibcValue > 0) {
                const arlValue = arlValueIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                const minArl = ibcValue * 0.00522;
                const maxArl = ibcValue * 0.087;
                if (arlValue < minArl - 100 || arlValue > maxArl + 100) {
                    checks.arl_bounds.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(checks.arl_bounds.sampleFindings,
                        `${displayName}: ARL ${arlValue.toFixed(0)} fuera de rango legal [${minArl.toFixed(0)} - ${maxArl.toFixed(0)}]`);
                } else {
                    checks.arl_bounds.passedRows += 1;
                }
            }

            if (rowHasFinding) rowsWithFindings += 1;
        }
    }

    const report: ValidationReport = {
        countryCode: input.countryCode,
        year: input.year,
        rowsAnalyzed,
        rowsWithFindings,
        criticalFindings,
        checks: [], // placeholder, will be overridden below
        coverage: {
            totalHeaders: new Set(input.matrices.flatMap((m) => m.headers.map((h) => normalize(h)).filter(Boolean))).size,
            mappedHeaders: normalizedRelationSources.size,
            unmappedHeaders: Array.from(unmappedHeadersGlobal),
            createdFieldsMapped: input.relations.filter((r) => r.isCreated).map((r) => r.target),
        },
    };

    // Second pass: identify missing dependencies for checks that didn't run
    const mappedTargets = new Set(input.relations.map(r => r.target));
    const unmappedHeaders = Array.from(unmappedHeadersGlobal);

    const fuzzyMatch = (target: string, headers: string[]) => {
        const t = normalize(target).replace(/_/g, ' ');
        return headers.find(h => {
            const normalizedH = normalize(h);
            return normalizedH.includes(t) || t.includes(normalizedH) ||
                (t.includes('salary') && (normalizedH.includes('sueldo') || normalizedH.includes('salario'))) ||
                (t.includes('document') && (normalizedH.includes('cedula') || normalizedH.includes('documento')));
        });
    };

    const finalChecks = Object.values(checks).map(check => {
        const severity = CHECK_SEVERITY[check.id] ?? 'low';
        if (check.passedRows > 0 || check.failedRows > 0) return { ...check, severity };

        const deps = dependencies[check.id] ?? [];
        const missing = deps.filter(d => !mappedTargets.has(d));
        if (missing.length > 0) {
            const matches: Record<string, string> = {};
            for (const m of missing) {
                const found = fuzzyMatch(m, unmappedHeaders);
                if (found) matches[m] = found;
            }
            return { ...check, severity, missingDependencies: missing, potentialMatches: Object.keys(matches).length > 0 ? matches : undefined };
        }
        return { ...check, severity };
    });

    return {
        ...report,
        checks: finalChecks.filter(c => c.passedRows > 0 || c.failedRows > 0 || (c.missingDependencies && c.missingDependencies.length > 0)),
    };
}


/**
 * Async wrapper that loads rules from the DB for the given country/year,
 * then delegates to `validatePayrollCalculations`.
 * Falls back to hardcoded Colombian rules when the DB is unavailable.
 */
export async function validatePayrollWithDynamicRules(input: {
    countryCode: string;
    year: number;
    matrices: MatrixInput[];
    relations: MappingRelationInput[];
    baseUrl?: string;
}): Promise<ValidationReport> {
    const dbRule = await loadRulesForCountry(input.countryCode, input.year, input.baseUrl);
    return validatePayrollCalculations({ ...input, dbRule });
}
