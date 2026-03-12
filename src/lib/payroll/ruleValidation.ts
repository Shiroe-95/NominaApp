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

interface RuleConstants {
    smmlv: number;
    ibcMaxSmmlv: number;
}

export interface CheckResult {
    id: string;
    label: string;
    passedRows: number;
    failedRows: number;
    sampleFindings: string[];
    missingDependencies?: string[];
    potentialMatches?: Record<string, string>;
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

function normalize(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

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

function getRuleConstants(countryCode: string, year: number): RuleConstants | null {
    if (countryCode === 'CO' && year === 2025) return { smmlv: 1423500, ibcMaxSmmlv: 25 };
    if (countryCode === 'CO' && year === 2026) return { smmlv: 1750905, ibcMaxSmmlv: 25 };
    return null;
}

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

function anyIndexForTarget(
    headerIndexByNormalized: Map<string, number>,
    relations: MappingRelationInput[],
    target: string
) {
    const indexes = allIndexesForTarget(headerIndexByNormalized, relations, target);
    return indexes.length > 0 ? indexes[0] : -1;
}

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

const fmt = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
});

const f = (val: number) => fmt.format(val);

export function validatePayrollCalculations(input: {
    countryCode: string;
    year: number;
    matrices: MatrixInput[];
    relations: MappingRelationInput[];
}): ValidationReport {
    const rule = getRuleConstants(input.countryCode, input.year);

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

    const checks: Record<string, CheckResult> = {
        ibc_rule_1393: {
            id: 'ibc_rule_1393',
            label: 'Ley 1393: IBC debe incluir exceso no salarial sobre 40%',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        tope_40_value: {
            id: 'tope_40_value',
            label: 'Campo tope_40_no_salarial consistente con exceso calculado',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        ibc_min_max: {
            id: 'ibc_min_max',
            label: 'IBC dentro de rango legal por dias trabajados y tope 25 SMMLV',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        ibc_consistency_subsystems: {
            id: 'ibc_consistency_subsystems',
            label: 'Consistencia entre IBC total y subsistemas (salud/pension/arl)',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        transport_eligibility: {
            id: 'transport_eligibility',
            label: 'Auxilio de transporte: solo aplica si salario <= 2 SMMLV',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        health_deduction_4pct: {
            id: 'health_deduction_4pct',
            label: 'Descuento salud empleado: debe ser 4% del IBC',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        pension_deduction_4pct: {
            id: 'pension_deduction_4pct',
            label: 'Descuento pension empleado: debe ser 4% del IBC',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        cesantias_rate: {
            id: 'cesantias_rate',
            label: 'Cesantias: provision debe ser ~8.33% del total devengado',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        prima_rate: {
            id: 'prima_rate',
            label: 'Prima de servicios: provision debe ser ~8.33% del total devengado',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        vacation_rate: {
            id: 'vacation_rate',
            label: 'Vacaciones: provision debe ser ~4.17% del salario basico',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        salud_empleador_rate: {
            id: 'salud_empleador_rate',
            label: 'Aporte salud empleador: debe ser 8.5% del IBC',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        pension_empleador_rate: {
            id: 'pension_empleador_rate',
            label: 'Aporte pension empleador: debe ser 12% del IBC',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        parafiscales_rate: {
            id: 'parafiscales_rate',
            label: 'Parafiscales totales: deben ser ~9% del IBC (SENA 2% + ICBF 3% + Caja 4%)',
            passedRows: 0,
            failedRows: 0,
            sampleFindings: [],
        },
        arl_bounds: {
            id: 'arl_bounds',
            label: 'ARL: valor debe estar entre 0.522% y 8.7% del IBC',
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

            if (rule && transportIdxs.length > 0) {
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
                const expectedHealth = ibcEfectivo * 0.04;
                
                if (healthDeductionIdxs.length === 0) {
                    // No hay campo de descuento salud mapeado
                    checks.health_deduction_4pct.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(
                        checks.health_deduction_4pct.sampleFindings,
                        `${displayName}: SIN descuento salud. Esperado 4% de IBC: ${f(expectedHealth)}`
                    );
                } else if (Math.abs(healthDeduction - expectedHealth) > Math.max(100, expectedHealth * 0.01)) {
                    checks.health_deduction_4pct.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(
                        checks.health_deduction_4pct.sampleFindings,
                        `${displayName}: descuento salud ${f(healthDeduction)} vs esperado 4% de IBC ${f(expectedHealth)}`
                    );
                } else {
                    checks.health_deduction_4pct.passedRows += 1;
                }

                const pensionDeduction = pensionDeductionIdxs.length > 0
                    ? pensionDeductionIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0)
                    : 0;
                const expectedPension = ibcEfectivo * 0.04;
                
                if (pensionDeductionIdxs.length === 0) {
                    // No hay campo de descuento pensión mapeado
                    checks.pension_deduction_4pct.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(
                        checks.pension_deduction_4pct.sampleFindings,
                        `${displayName}: SIN descuento pension. Esperado 4% de IBC: ${f(expectedPension)}`
                    );
                } else if (Math.abs(pensionDeduction - expectedPension) > Math.max(100, expectedPension * 0.01)) {
                    checks.pension_deduction_4pct.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(
                        checks.pension_deduction_4pct.sampleFindings,
                        `${displayName}: descuento pension ${f(pensionDeduction)} vs esperado 4% de IBC ${f(expectedPension)}`
                    );
                } else {
                    checks.pension_deduction_4pct.passedRows += 1;
                }
            }

            const devengadoTotal = grossPayIdxs.length > 0 ? grossPayIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0) : totalIncome;

            if (cesantiasIdxs.length > 0 && devengadoTotal > 0) {
                const cesantias = cesantiasIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                const expected = devengadoTotal * 0.0833;
                if (Math.abs(cesantias - expected) > Math.max(500, expected * 0.05)) {
                    checks.cesantias_rate.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(checks.cesantias_rate.sampleFindings,
                        `${displayName}: cesantias ${cesantias.toFixed(0)} vs esperado 8.33% de devengado ${expected.toFixed(0)}`);
                } else {
                    checks.cesantias_rate.passedRows += 1;
                }
            }

            if (primaIdxs.length > 0 && devengadoTotal > 0) {
                const prima = primaIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                const expected = devengadoTotal * 0.0833;
                if (Math.abs(prima - expected) > Math.max(500, expected * 0.05)) {
                    checks.prima_rate.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(checks.prima_rate.sampleFindings,
                        `${displayName}: prima ${prima.toFixed(0)} vs esperado 8.33% de devengado ${expected.toFixed(0)}`);
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
                const expected = ibcValue * 0.085;
                if (Math.abs(saludEmp - expected) > Math.max(100, expected * 0.01)) {
                    checks.salud_empleador_rate.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(checks.salud_empleador_rate.sampleFindings,
                        `${displayName}: salud empleador ${saludEmp.toFixed(0)} vs esperado 8.5% de IBC ${expected.toFixed(0)}`);
                } else {
                    checks.salud_empleador_rate.passedRows += 1;
                }
            }

            if (pensionEmpleadorIdxs.length > 0 && ibcValue > 0) {
                const pensionEmp = pensionEmpleadorIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                const expected = ibcValue * 0.12;
                if (Math.abs(pensionEmp - expected) > Math.max(100, expected * 0.01)) {
                    checks.pension_empleador_rate.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(checks.pension_empleador_rate.sampleFindings,
                        `${displayName}: pension empleador ${f(pensionEmp)} vs esperado 12% de IBC ${f(expected)}`);
                } else {
                    checks.pension_empleador_rate.passedRows += 1;
                }
            }

            if (parafiscalesTotalIdxs.length > 0 && ibcValue > 0) {
                const parafiscales = parafiscalesTotalIdxs.reduce((sum, idx) => sum + toNumber(row[idx]), 0);
                const expected = ibcValue * 0.09;
                if (Math.abs(parafiscales - expected) > Math.max(100, expected * 0.02)) {
                    checks.parafiscales_rate.failedRows += 1;
                    rowHasFinding = true;
                    pushSample(checks.parafiscales_rate.sampleFindings,
                        `${displayName}: parafiscales ${parafiscales.toFixed(0)} vs esperado 9% de IBC ${expected.toFixed(0)}`);
                } else {
                    checks.parafiscales_rate.passedRows += 1;
                }
            }

            if (arlValueIdxs.length > 0 && ibcValue > 0) {
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
        if (check.passedRows > 0 || check.failedRows > 0) return check;

        const deps = dependencies[check.id] ?? [];
        const missing = deps.filter(d => !mappedTargets.has(d));
        if (missing.length > 0) {
            const matches: Record<string, string> = {};
            for (const m of missing) {
                const found = fuzzyMatch(m, unmappedHeaders);
                if (found) matches[m] = found;
            }
            return { ...check, missingDependencies: missing, potentialMatches: matches };
        }
        return check;
    });

    return {
        ...report,
        checks: finalChecks.filter(c => c.passedRows > 0 || c.failedRows > 0 || (c.missingDependencies && c.missingDependencies.length > 0)),
    };
}
