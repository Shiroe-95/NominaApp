export type PayrollConceptCategory =
    | 'identity'
    | 'contract'
    | 'salary_base'
    | 'salary_earnings'
    | 'non_salary_earnings'
    | 'overtime'
    | 'leave_disability'
    | 'deductions'
    | 'contributions'
    | 'provisions'
    | 'net_payment'
    | 'unknown';

export interface ConceptSummary {
    totalVariables: number;
    byCategory: Record<PayrollConceptCategory, number>;
    unknownVariables: string[];
}

export interface RiskReport {
    score: number;
    level: 'low' | 'medium' | 'high';
    factors: Array<{ name: string; points: number; detail: string }>;
}

const CATEGORY_RULES: Array<{ category: PayrollConceptCategory; patterns: RegExp[] }> = [
    { category: 'identity', patterns: [/documento|empleado|nombre|identificacion|codigo empleado|employee|cpf|rut|curp|cuil|ssn|worker/i] },
    { category: 'contract', patterns: [/contrato|cargo|fecha de ingreso|fecha de retiro|area|contract|position|hire date|termination|admissao|demissao/i] },
    { category: 'salary_base', patterns: [/sueldo|salario basico|base salarial|apoyo sostenimiento|base salary|salario base|remuneracao|vencimento basico|sueldo base/i] },
    { category: 'overtime', patterns: [/hora extra|recargo|dominical|festiva|nocturna|overtime|horas extras|adicional noturno|dsr/i] },
    { category: 'leave_disability', patterns: [/incapacidad|licencia|vacaciones|ausencia|atep|disability|leave|vacation|ferias|afastamento|licenca/i] },
    { category: 'salary_earnings', patterns: [/comision|bonificacion|prima|incentivo|retroactivo|dias no habiles|dias habiles|commission|bonus|gratificacion|aguinaldo|13.? salario|decimo terceiro/i] },
    { category: 'non_salary_earnings', patterns: [/auxilio|rodamiento|movilidad|educacion|recreacion|vivienda|transporte|allowance|vale.?transporte|vale.?refeicao|cesta basica/i] },
    { category: 'deductions', patterns: [/descuento|dcto|retencion|prestamo|libranza|embargo|deduction|withholding|imposto de renda|irrf|isr|ganancias/i] },
    { category: 'contributions', patterns: [/ibc|ibl|aporte|salud|pension|arl|parafiscal|pila|inss|fgts|imss|afp|fonasa|isapre|fica|social security|seguridad social|previdencia/i] },
    { category: 'provisions', patterns: [/cesantia|interes cesantia|prima servicios|provision|severance|cts|gratificacao|aguinaldo|sac|13.? salario/i] },
    { category: 'net_payment', patterns: [/neto|pago fuera|pagos|devengado|net pay|total earnings|liquido|salario liquido|percepciones/i] },
];

export function normalizeHeader(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function classifyHeader(header: string): PayrollConceptCategory {
    const normalized = normalizeHeader(header);
    for (const rule of CATEGORY_RULES) {
        if (rule.patterns.some((pattern) => pattern.test(normalized))) {
            return rule.category;
        }
    }
    return 'unknown';
}

export function summarizeConcepts(headers: string[]): ConceptSummary {
    const byCategory: Record<PayrollConceptCategory, number> = {
        identity: 0,
        contract: 0,
        salary_base: 0,
        salary_earnings: 0,
        non_salary_earnings: 0,
        overtime: 0,
        leave_disability: 0,
        deductions: 0,
        contributions: 0,
        provisions: 0,
        net_payment: 0,
        unknown: 0,
    };

    const uniqueHeaders = Array.from(new Set(headers.map((h) => h.trim()).filter(Boolean)));
    const unknownVariables: string[] = [];

    for (const header of uniqueHeaders) {
        const category = classifyHeader(header);
        byCategory[category] += 1;
        if (category === 'unknown') {
            unknownVariables.push(header);
        }
    }

    return {
        totalVariables: uniqueHeaders.length,
        byCategory,
        unknownVariables,
    };
}

export function buildRiskReport(input: {
    conceptSummary: ConceptSummary;
    missingRequiredFields: string[];
    missingRequiredCalculations: string[];
    certificationReady: boolean;
}) {
    const factors: Array<{ name: string; points: number; detail: string }> = [];

    if (input.missingRequiredFields.length > 0) {
        const points = Math.min(45, input.missingRequiredFields.length * 8);
        factors.push({
            name: 'Missing required fields',
            points,
            detail: `${input.missingRequiredFields.length} field(s) missing`,
        });
    }

    if (input.missingRequiredCalculations.length > 0) {
        const points = Math.min(35, input.missingRequiredCalculations.length * 10);
        factors.push({
            name: 'Missing required calculations',
            points,
            detail: `${input.missingRequiredCalculations.length} calculation(s) missing`,
        });
    }

    if (input.conceptSummary.totalVariables > 0) {
        const unknownRatio = input.conceptSummary.unknownVariables.length / input.conceptSummary.totalVariables;
        const points = Math.round(unknownRatio * 20);
        if (points > 0) {
            factors.push({
                name: 'Unknown concept ratio',
                points,
                detail: `${input.conceptSummary.unknownVariables.length}/${input.conceptSummary.totalVariables} unknown variables`,
            });
        }
    }

    if (!input.certificationReady) {
        factors.push({
            name: 'Certification status',
            points: 10,
            detail: 'Current payload is not certifiable',
        });
    }

    const score = Math.min(100, factors.reduce((acc, item) => acc + item.points, 0));
    const level: 'low' | 'medium' | 'high' = score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low';

    const report: RiskReport = {
        score,
        level,
        factors,
    };

    return report;
}
