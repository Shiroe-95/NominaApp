/**
 * Detalle de riesgo individual de un empleado.
 *
 * Contiene los totales monetarios agregados de todas las matrices
 * procesadas y el puntaje de riesgo calculado (0–100) con los
 * hallazgos específicos que contribuyeron al puntaje.
 */
export interface EmployeeRiskDetail {
    /** Número de documento del empleado (cédula, CPF, RUT, CURP, CUIL, SSN). */
    document: string;
    /** Nombre completo del empleado. */
    name: string;
    /** Suma total de conceptos salariales base. */
    salaryTotal: number;
    /** Suma total de pagos no salariales (auxilios, bonificaciones no salariales). */
    nonSalaryTotal: number;
    /** Suma total de la base de cotización (IBC/IBL). */
    iblTotal: number;
    /** Suma total de aportes a seguridad social y contribuciones. */
    aporteTotal: number;
    /** Puntaje de riesgo (0–100). Mayor puntaje indica mayor riesgo. */
    score: number;
    /** Hallazgos que contribuyeron al puntaje de riesgo. */
    findings: string[];
}

/**
 * Resumen agregado de riesgo para todos los empleados analizados.
 *
 * Incluye métricas globales (promedio, máximo) y el top de empleados
 * con mayor puntaje de riesgo para priorización de auditoría.
 */
export interface EmployeeRiskSummary {
    /** Total de empleados únicos analizados (por documento). */
    employeesAnalyzed: number;
    /** Empleados con puntaje de riesgo >= 20. */
    employeesWithRisk: number;
    /** Puntaje promedio de riesgo (redondeado a 2 decimales). */
    averageScore: number;
    /** Puntaje máximo de riesgo encontrado. */
    maxScore: number;
    /** Top 25 empleados con mayor riesgo, ordenados descendentemente. */
    topEmployees: EmployeeRiskDetail[];
}

/**
 * Hallazgo de auditoría con severidad para cálculo de score ponderado.
 */
export interface SeverityFinding {
    severity: 'high' | 'medium' | 'low';
    description: string;
}

/** Weights for severity-based risk score calculation (Req 5.5) */
export const SEVERITY_WEIGHTS: Record<'high' | 'medium' | 'low', number> = {
    high: 40,
    medium: 20,
    low: 10,
};

/**
 * Calcula el score de riesgo de un empleado basado en la suma ponderada
 * de hallazgos por severidad: high × 40 + medium × 20 + low × 10.
 *
 * @param findings - Hallazgos con severidad asignada.
 * @returns Score de riesgo (sin tope).
 */
export function calculateSeverityRiskScore(findings: SeverityFinding[]): number {
    return findings.reduce((score, f) => score + (SEVERITY_WEIGHTS[f.severity] ?? 0), 0);
}

/**
 * Fila agregada interna para acumular valores monetarios por empleado.
 * Los hallazgos se almacenan en un Set para evitar duplicados al
 * procesar múltiples matrices del mismo empleado.
 */
interface AggregateRow {
    document: string;
    name: string;
    salaryTotal: number;
    nonSalaryTotal: number;
    iblTotal: number;
    aporteTotal: number;
    findings: Set<string>;
}

/** Categorías de análisis usadas para clasificar columnas de nómina. */
type AnalysisCategory = 'identity' | 'salary_base' | 'non_salary' | 'ibc' | 'contribution' | 'contract' | 'informational';

/**
 * Normaliza un encabezado: minúsculas, sin acentos, espacios colapsados.
 * @param value - Texto del encabezado a normalizar.
 * @returns Texto normalizado para comparación.
 */
function normalizeHeader(value: string) {
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
 * @param value - Valor a convertir.
 * @returns Número finito, o 0 si la conversión falla.
 */
function asNumber(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9,.-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.');
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function isPositive(n: number) {
    return Number.isFinite(n) && n > 0;
}

/**
 * Detecta índices de columna por categoría usando patrones regex multi-país.
 *
 * Busca encabezados que coincidan con patrones de documento, nombre,
 * salario base, pagos no salariales, base de cotización y aportes
 * para los 7 países soportados (CO, MX, PE, CL, BR, AR, US).
 *
 * @param headers - Encabezados originales de la matriz de nómina.
 * @returns Objeto con índices de columna por categoría.
 */
function getCategoryIndexes(headers: string[]) {
    const normalized = headers.map((h) => normalizeHeader(h));

    const findFirst = (patterns: RegExp[]) => normalized.findIndex((h) => patterns.some((p) => p.test(h)));

    const documentIdx = findFirst([/numero de documento|no\. documento|document_number|identificacion|cpf|rut|curp|cuil|ssn|cedula/]);
    const nameIdx = findFirst([/nombre completo|full name|first_name|nombres|nome completo|nome/]);

    const salaryIdxs = normalized
        .map((h, idx) => ({ h, idx }))
        .filter(({ h }) => /sueldo|salario basico|salario\b|base salary|remuneracao|vencimento/.test(h) && !/retroactivo/.test(h))
        .map(({ idx }) => idx);

    const nonSalaryIdxs = normalized
        .map((h, idx) => ({ h, idx }))
        .filter(({ h }) => /auxilio|rodamiento|movilidad|recreacion|educacion|vivienda|bonificacion no salarial|no salarial|allowance|vale.?transporte|cesta basica/.test(h))
        .map(({ idx }) => idx);

    const iblIdxs = normalized
        .map((h, idx) => ({ h, idx }))
        .filter(({ h }) => /ibl|ibc|base.?cotizacion|contribution.?base/.test(h))
        .map(({ idx }) => idx);

    const aporteIdxs = normalized
        .map((h, idx) => ({ h, idx }))
        .filter(({ h }) => /aporte|salud|pension|arl|parafiscal|inss|fgts|imss|afp|fica|social.?security|seguridad.?social/.test(h))
        .map(({ idx }) => idx);

    return {
        documentIdx,
        nameIdx,
        salaryIdxs,
        nonSalaryIdxs,
        iblIdxs,
        aporteIdxs,
    };
}

/**
 * Detecta índices de columna usando hints de relación del mapeo IA.
 *
 * Cuando el agente mapeador (Gyoru) ya clasificó las columnas, se usan
 * esas categorías en lugar de los patrones regex genéricos.
 *
 * @param headers - Encabezados originales de la matriz.
 * @param relationHints - Mapa encabezado → categoría de análisis (del mapeo IA).
 * @returns Objeto con índices de columna por categoría.
 */
function getCategoryIndexesFromRelations(headers: string[], relationHints: Record<string, string>) {
    const normalizedHeaders = headers.map((h) => normalizeHeader(h));
    const hintMap = new Map<string, AnalysisCategory>();

    for (const [header, category] of Object.entries(relationHints)) {
        const normalizedHeader = normalizeHeader(header);
        const normalizedCategory = String(category).trim() as AnalysisCategory;
        hintMap.set(normalizedHeader, normalizedCategory);
    }

    const indexByCategory: Record<AnalysisCategory, number[]> = {
        identity: [],
        salary_base: [],
        non_salary: [],
        ibc: [],
        contribution: [],
        contract: [],
        informational: [],
    };

    normalizedHeaders.forEach((header, index) => {
        const category = hintMap.get(header);
        if (category) {
            indexByCategory[category].push(index);
        }
    });

    const documentIdx = indexByCategory.identity.find((idx) => /document|identificacion|cedula|nit/.test(normalizedHeaders[idx])) ?? -1;
    const nameIdx = indexByCategory.identity.find((idx) => /nombre|name|apellido/.test(normalizedHeaders[idx])) ?? -1;

    return {
        documentIdx,
        nameIdx,
        salaryIdxs: indexByCategory.salary_base,
        nonSalaryIdxs: indexByCategory.non_salary,
        iblIdxs: indexByCategory.ibc,
        aporteIdxs: indexByCategory.contribution,
    };
}

/**
 * Evalúa el riesgo de un empleado basándose en sus valores agregados.
 *
 * Reglas de puntuación (multi-país):
 * - Pagos no salariales > 40% del ingreso total: hasta +35 puntos.
 * - Salario reportado sin aportes/contribuciones: +25 puntos.
 * - Base de cotización < 80% del salario base: +20 puntos.
 * - Sin valores monetarios detectados: +10 puntos.
 *
 * El puntaje se acota a un máximo de 100.
 *
 * @param row - Fila agregada del empleado con totales y hallazgos previos.
 * @returns Puntaje de riesgo (0–100) y lista de hallazgos.
 */
function evaluateRisk(row: AggregateRow) {
    const findings = new Set<string>(row.findings);
    let score = 0;

    const totalIncome = row.salaryTotal + row.nonSalaryTotal;
    if (isPositive(totalIncome)) {
        const nonSalaryRatio = row.nonSalaryTotal / totalIncome;
        if (nonSalaryRatio > 0.4) {
            score += Math.min(35, Math.round((nonSalaryRatio - 0.4) * 100));
            findings.add(`Pagos no salariales sobre umbral permitido (${(nonSalaryRatio * 100).toFixed(1)}%)`);
        }
    }

    if (isPositive(row.salaryTotal) && row.aporteTotal <= 0) {
        score += 25;
        findings.add('Tiene salario reportado sin aportes/contribuciones detectados');
    }

    if (isPositive(row.iblTotal) && isPositive(row.salaryTotal)) {
        if (row.iblTotal < row.salaryTotal * 0.8) {
            score += 20;
            findings.add('Base de cotización significativamente menor al salario base');
        }
    }

    if (!isPositive(row.salaryTotal) && !isPositive(row.nonSalaryTotal) && !isPositive(row.aporteTotal)) {
        score += 10;
        findings.add('Empleado sin valores monetarios detectados');
    }

    const bounded = Math.min(100, score);
    return {
        score: bounded,
        findings: Array.from(findings),
    };
}

/**
 * Agrega datos de riesgo por empleado desde una matriz de nómina.
 *
 * Itera las filas de la matriz, identifica al empleado por documento,
 * y acumula los totales de salario, pagos no salariales, base de
 * cotización y aportes en el mapa `aggregates`. Soporta múltiples
 * matrices (archivos) para el mismo empleado.
 *
 * Usa `relationHints` del mapeo IA cuando están disponibles; de lo
 * contrario, recurre a detección por patrones regex multi-país.
 *
 * @param input - Datos de entrada.
 * @param input.headers - Encabezados de la matriz.
 * @param input.rows - Filas de datos de la matriz.
 * @param input.aggregates - Mapa mutable documento → fila agregada (se modifica in-place).
 * @param input.relationHints - Mapa encabezado → categoría del mapeo IA (opcional).
 */
export function summarizeEmployeeRiskFromMatrix(input: {
    headers: string[];
    rows: unknown[][];
    aggregates: Map<string, AggregateRow>;
    relationHints?: Record<string, string>;
}) {
    const fallback = getCategoryIndexes(input.headers);
    const related = input.relationHints && Object.keys(input.relationHints).length > 0
        ? getCategoryIndexesFromRelations(input.headers, input.relationHints)
        : null;

    const documentIdx = related && related.documentIdx >= 0 ? related.documentIdx : fallback.documentIdx;
    const nameIdx = related && related.nameIdx >= 0 ? related.nameIdx : fallback.nameIdx;
    const salaryIdxs = related && related.salaryIdxs.length > 0 ? related.salaryIdxs : fallback.salaryIdxs;
    const nonSalaryIdxs = related && related.nonSalaryIdxs.length > 0 ? related.nonSalaryIdxs : fallback.nonSalaryIdxs;
    const iblIdxs = related && related.iblIdxs.length > 0 ? related.iblIdxs : fallback.iblIdxs;
    const aporteIdxs = related && related.aporteIdxs.length > 0 ? related.aporteIdxs : fallback.aporteIdxs;

    if (documentIdx < 0) return;

    for (const row of input.rows) {
        const documentRaw = row[documentIdx];
        if (documentRaw === null || documentRaw === undefined || String(documentRaw).trim() === '') continue;

        const document = String(documentRaw).trim();
        const name = nameIdx >= 0 && row[nameIdx] ? String(row[nameIdx]).trim() : 'Sin nombre';

        const current = input.aggregates.get(document) ?? {
            document,
            name,
            salaryTotal: 0,
            nonSalaryTotal: 0,
            iblTotal: 0,
            aporteTotal: 0,
            findings: new Set<string>(),
        };

        const salary = salaryIdxs.reduce((acc, idx) => acc + asNumber(row[idx]), 0);
        const nonSalary = nonSalaryIdxs.reduce((acc, idx) => acc + asNumber(row[idx]), 0);
        const ibl = iblIdxs.reduce((acc, idx) => acc + asNumber(row[idx]), 0);
        const aporte = aporteIdxs.reduce((acc, idx) => acc + asNumber(row[idx]), 0);

        current.salaryTotal += salary;
        current.nonSalaryTotal += nonSalary;
        current.iblTotal += ibl;
        current.aporteTotal += aporte;

        input.aggregates.set(document, current);
    }
}

/**
 * Genera el resumen final de riesgo a partir de los datos agregados.
 *
 * Evalúa el riesgo de cada empleado, calcula métricas globales
 * (promedio, máximo, cantidad con riesgo) y retorna el top 25
 * de empleados con mayor puntaje para priorización de auditoría.
 *
 * Un empleado se considera "con riesgo" si su puntaje es >= 20.
 *
 * @param aggregates - Mapa documento → fila agregada (resultado de {@link summarizeEmployeeRiskFromMatrix}).
 * @returns Resumen con métricas globales y top de empleados de mayor riesgo.
 */
export function finalizeEmployeeRiskSummary(aggregates: Map<string, AggregateRow>): EmployeeRiskSummary {
    const evaluated: EmployeeRiskDetail[] = Array.from(aggregates.values()).map((row) => {
        const result = evaluateRisk(row);
        return {
            document: row.document,
            name: row.name,
            salaryTotal: row.salaryTotal,
            nonSalaryTotal: row.nonSalaryTotal,
            iblTotal: row.iblTotal,
            aporteTotal: row.aporteTotal,
            score: result.score,
            findings: result.findings,
        };
    });

    const employeesAnalyzed = evaluated.length;
    const employeesWithRisk = evaluated.filter((row) => row.score >= 20).length;
    const averageScore = employeesAnalyzed > 0 ? evaluated.reduce((acc, row) => acc + row.score, 0) / employeesAnalyzed : 0;
    const maxScore = employeesAnalyzed > 0 ? Math.max(...evaluated.map((row) => row.score)) : 0;

    const topEmployees = evaluated
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 25);

    return {
        employeesAnalyzed,
        employeesWithRisk,
        averageScore: Number(averageScore.toFixed(2)),
        maxScore,
        topEmployees,
    };
}


/**
 * Requests proactive auto-corrections from Wil via AgentBus after audit completes (Req 5.7).
 *
 * This function is called after the audit engine finishes processing. It sends
 * the audit findings to the corrector agent (Wil) through the AgentBus for
 * automatic correction suggestions.
 *
 * @param bus - AgentBus instance for inter-agent communication.
 * @param auditFindings - Findings from the audit engine.
 * @param countryCode - ISO country code.
 * @param year - Fiscal year.
 * @returns The corrector agent result, or null if the bus is unavailable or the request fails.
 */
export async function requestAutoCorrections(
    bus: { hasAgent: (name: string) => boolean; send: (msg: { fromAgent: string; toAgent: string; queryType: string; payload: unknown }) => Promise<{ success: boolean; data: unknown }> },
    auditFindings: unknown[],
    countryCode: string,
    year: number,
): Promise<{ success: boolean; data: unknown } | null> {
    if (!bus.hasAgent('corrector')) return null;

    try {
        const result = await bus.send({
            fromAgent: 'auditor',
            toAgent: 'corrector',
            queryType: 'auto-corrections',
            payload: {
                findings: auditFindings,
                countryCode,
                year,
            },
        });
        return result;
    } catch {
        // Non-critical: auto-corrections are proactive, not blocking
        return null;
    }
}
