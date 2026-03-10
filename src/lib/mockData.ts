// Mock data for the Triple Match reconciler

export interface PayrollRecord {
    id: string;
    employeeName: string;
    baseSalary: number;
    nonSalaryPayments: number;
    healthDays: number;
    pensionDays: number;
    // Rule 1393: Non-salary payments > 40% of total remuneration -> excess goes to IBC
}

export interface PilaRecord {
    id: string;
    ibcHealth: number;
    ibcPension: number;
    ibcRisk: number;
    healthDays: number;
    pensionDays: number;
}

export interface MatchResult {
    id: string;
    employeeName: string;

    // Payroll (Source of Truth)
    baseSalary: number;
    nonSalary: number;
    totalRemuneration: number;
    maxNonSalaryAllowed: number; // 40% rule

    // Standard (What it should be)
    expectedIbc: number;
    expectedHealthDays: number;

    // PILA (What was paid)
    reportedIbc: number;
    reportedHealthDays: number;

    // Differences
    ibcDiff: number;
    daysDiff: number;
    hasErrors: boolean;
    errorTypes: string[];
}

// Generate some sample data
export const generateMockData = (): MatchResult[] => {
    return [
        {
            id: "EMP-001",
            employeeName: "Ana Maria Gomez Perez",
            baseSalary: 3500000,
            nonSalary: 500000,
            totalRemuneration: 4000000,
            maxNonSalaryAllowed: 1600000,
            expectedIbc: 3500000,
            expectedHealthDays: 30,
            reportedIbc: 3500000,
            reportedHealthDays: 30,
            ibcDiff: 0,
            daysDiff: 0,
            hasErrors: false,
            errorTypes: []
        },
        {
            id: "EMP-002",
            employeeName: "Carlos Rodriguez Silva",
            baseSalary: 4000000,
            nonSalary: 3500000, // 3.5M non-salary, 4M salary. Total 7.5M
            totalRemuneration: 7500000,
            maxNonSalaryAllowed: 3000000, // 40% of 7.5M is 3M. Exception of 500k.
            expectedIbc: 4500000, // Salary (4M) + Excess (500k)
            expectedHealthDays: 30,
            reportedIbc: 4000000, // They only reported base salary
            reportedHealthDays: 30,
            ibcDiff: -500000,
            daysDiff: 0,
            hasErrors: true,
            errorTypes: ["IBC_UNDERPAID", "LAW_1393_VIOLATION"]
        },
        {
            id: "EMP-003",
            employeeName: "Laura Martinez",
            baseSalary: 1300000,
            nonSalary: 0,
            totalRemuneration: 1300000,
            maxNonSalaryAllowed: 520000,
            expectedIbc: 1300000,
            expectedHealthDays: 15, // Started mid-month
            reportedIbc: 1300000,
            reportedHealthDays: 30, // Paid full month
            ibcDiff: 0,
            daysDiff: 15,
            hasErrors: true,
            errorTypes: ["DAYS_MISMATCH"]
        },
        {
            id: "EMP-004",
            employeeName: "Juan David Castro",
            baseSalary: 8500000,
            nonSalary: 1000000,
            totalRemuneration: 9500000,
            maxNonSalaryAllowed: 3800000,
            expectedIbc: 8500000,
            expectedHealthDays: 30,
            reportedIbc: 8000000, // Underreported manually
            reportedHealthDays: 30,
            ibcDiff: -500000,
            daysDiff: 0,
            hasErrors: true,
            errorTypes: ["IBC_UNDERPAID"]
        }
    ];
};

export const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(value);
};
