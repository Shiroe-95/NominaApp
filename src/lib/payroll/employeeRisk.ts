export interface EmployeeRiskDetail {
    document: string;
    name: string;
    salaryTotal: number;
    nonSalaryTotal: number;
    iblTotal: number;
    aporteTotal: number;
    score: number;
    findings: string[];
}

export interface EmployeeRiskSummary {
    employeesAnalyzed: number;
    employeesWithRisk: number;
    averageScore: number;
    maxScore: number;
    topEmployees: EmployeeRiskDetail[];
}

interface AggregateRow {
    document: string;
    name: string;
    salaryTotal: number;
    nonSalaryTotal: number;
    iblTotal: number;
    aporteTotal: number;
    findings: Set<string>;
}

type AnalysisCategory = 'identity' | 'salary_base' | 'non_salary' | 'ibc' | 'contribution' | 'contract' | 'informational';

function normalizeHeader(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

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

function getCategoryIndexes(headers: string[]) {
    const normalized = headers.map((h) => normalizeHeader(h));

    const findFirst = (patterns: RegExp[]) => normalized.findIndex((h) => patterns.some((p) => p.test(h)));

    const documentIdx = findFirst([/numero de documento|no\. documento|document_number|identificacion/]);
    const nameIdx = findFirst([/nombre completo|full name|first_name|nombres/]);

    const salaryIdxs = normalized
        .map((h, idx) => ({ h, idx }))
        .filter(({ h }) => /sueldo|salario basico|salario\b|base salary/.test(h) && !/retroactivo/.test(h))
        .map(({ idx }) => idx);

    const nonSalaryIdxs = normalized
        .map((h, idx) => ({ h, idx }))
        .filter(({ h }) => /auxilio|rodamiento|movilidad|recreacion|educacion|vivienda|bonificacion no salarial|no salarial/.test(h))
        .map(({ idx }) => idx);

    const iblIdxs = normalized
        .map((h, idx) => ({ h, idx }))
        .filter(({ h }) => /ibl|ibc/.test(h))
        .map(({ idx }) => idx);

    const aporteIdxs = normalized
        .map((h, idx) => ({ h, idx }))
        .filter(({ h }) => /aporte|salud|pension|arl|parafiscal/.test(h))
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

function evaluateRisk(row: AggregateRow) {
    const findings = new Set<string>(row.findings);
    let score = 0;

    const totalIncome = row.salaryTotal + row.nonSalaryTotal;
    if (isPositive(totalIncome)) {
        const nonSalaryRatio = row.nonSalaryTotal / totalIncome;
        if (nonSalaryRatio > 0.4) {
            score += Math.min(35, Math.round((nonSalaryRatio - 0.4) * 100));
            findings.add(`Pagos no salariales sobre 40% (${(nonSalaryRatio * 100).toFixed(1)}%)`);
        }
    }

    if (isPositive(row.salaryTotal) && row.aporteTotal <= 0) {
        score += 25;
        findings.add('Tiene salario reportado sin aportes detectados');
    }

    if (isPositive(row.iblTotal) && isPositive(row.salaryTotal)) {
        if (row.iblTotal < row.salaryTotal * 0.8) {
            score += 20;
            findings.add('IBL/IBC significativamente menor al salario base');
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
