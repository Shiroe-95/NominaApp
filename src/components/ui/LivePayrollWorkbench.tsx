'use client';

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import UploadZone, { ParsedFile } from '@/components/ui/UploadZone';
import PayrollEditor, { type CorrectionEntry } from '@/components/ui/PayrollEditor';
import { validatePayrollCalculations, type MappingAnalysisCategory, type MappingRelationInput, type MatrixInput, type ValidationReport } from '@/lib/payroll/ruleValidation';
import type { AiValidationReport } from '@/app/api/ai/validation/route';
import { Loader2 } from 'lucide-react';

interface LivePayrollWorkbenchProps {
    payrollId: string | null;
    defaultCountry: string;
    defaultYear: number;
    existingMatrices?: MatrixInput[] | null;
    existingRelations?: MappingRelationInput[] | null;
    existingAiReport?: AiValidationReport | null;
}

const AUTO_TARGET_MAP: Array<{ pattern: RegExp; target: string; category: MappingAnalysisCategory }> = [
    { pattern: /cedula|nro\.?\s*doc|num\.?\s*doc|identificaci|document/i, target: 'document_number', category: 'identity' },
    { pattern: /primer\s*nombre|^nombres?$|first\s*name/i, target: 'first_name', category: 'identity' },
    { pattern: /primer\s*apellido|^apellidos?$|last\s*name/i, target: 'last_name', category: 'identity' },
    { pattern: /fecha\s*(de\s*)?(ingreso|inicio|vinculacion|contrat)|hire\s*date/i, target: 'hire_date', category: 'contract' },
    { pattern: /tipo\s*(de\s*)?cotizante|contributor\s*type/i, target: 'contributor_type', category: 'contract' },
    { pattern: /dias?\s*(trabajados?|laborados?|cotizados?|pagados?)|worked\s*days/i, target: 'worked_days', category: 'contract' },
    { pattern: /salario\s*(basico|base)|sueldo\s*(basico|base)|base\s*salary/i, target: 'base_salary', category: 'salary_base' },
    { pattern: /hora\s*extra\s*diurna|overtime.*day/i, target: 'overtime_hours_day', category: 'salary_base' },
    { pattern: /hora\s*extra\s*nocturna|overtime.*night/i, target: 'overtime_hours_night', category: 'salary_base' },
    { pattern: /total\s*devengado|gross\s*pay|devengado\s*total/i, target: 'gross_pay', category: 'salary_base' },
    { pattern: /auxilio\s*(de\s*)?transp|transport/i, target: 'transport_allowance', category: 'non_salary' },
    { pattern: /no\s*salarial|pagos?\s*no\s*sal|bono|rodamiento|movilidad/i, target: 'non_salary_payments', category: 'non_salary' },
    { pattern: /ibc\s*total|ingreso\s*base.*total/i, target: 'ibc_total', category: 'ibc' },
    { pattern: /ibc.*salud/i, target: 'ibc_salud', category: 'ibc' },
    { pattern: /ibc.*pensi/i, target: 'ibc_pension', category: 'ibc' },
    { pattern: /ibc.*arl/i, target: 'ibc_arl', category: 'ibc' },
    { pattern: /tope\s*40|ley\s*1393|exceso\s*no\s*sal/i, target: 'tope_40_no_salarial', category: 'ibc' },
    { pattern: /desc.*salud|deducc.*salud|salud\s*empleado/i, target: 'health_employee_deduction', category: 'contribution' },
    { pattern: /desc.*pensi|deducc.*pensi|pension\s*empleado/i, target: 'pension_employee_deduction', category: 'contribution' },
    { pattern: /salud\s*empleador|salud\s*empres/i, target: 'salud_empleador', category: 'contribution' },
    { pattern: /pension\s*empleador|pension\s*empres/i, target: 'pension_empleador', category: 'contribution' },
    { pattern: /^arl$|valor\s*arl|aporte\s*arl/i, target: 'arl_value', category: 'contribution' },
    { pattern: /parafiscal|sena\s*\+?\s*icbf|caja\s*comp/i, target: 'parafiscales_total', category: 'contribution' },
    { pattern: /cesantia/i, target: 'cesantias_provision', category: 'salary_base' },
    { pattern: /^prima$|prima\s*(de\s*)?(servicio|auxili)/i, target: 'prima_provision', category: 'salary_base' },
    { pattern: /vacaci|vacation/i, target: 'vacation_provision', category: 'salary_base' },
];

function normalizeHeader(input: string) {
    return input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function toSnake(input: string) {
    return normalizeHeader(input).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function inferRelations(headers: string[]): MappingRelationInput[] {
    const usedCanonicalTargets = new Set<string>();
    const relations: MappingRelationInput[] = [];

    for (const header of headers) {
        const normalized = normalizeHeader(header);
        const match = AUTO_TARGET_MAP.find((m) => m.pattern.test(normalized));
        let target = match?.target ?? toSnake(header);
        let category: MappingAnalysisCategory = match?.category ?? 'informational';

        if (match && usedCanonicalTargets.has(match.target)) {
            target = toSnake(header);
            category = 'informational';
        }
        if (match) usedCanonicalTargets.add(match.target);

        relations.push({
            source: header,
            target,
            analysisCategory: category,
            isCreated: !Boolean(match),
            requiredByRule: false,
        });
    }
    return relations;
}

export default function LivePayrollWorkbench({
    payrollId,
    defaultCountry,
    defaultYear,
    existingMatrices = null,
    existingRelations = null,
    existingAiReport = null,
}: LivePayrollWorkbenchProps) {
    const [countryCode, setCountryCode] = useState<'CO' | 'MX'>(defaultCountry === 'MX' ? 'MX' : 'CO');
    const [year, setYear] = useState<number>(defaultYear || new Date().getFullYear());

    const [matrices, setMatrices] = useState<MatrixInput[] | null>(null);
    const [relations, setRelations] = useState<MappingRelationInput[]>([]);
    const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
    const [aiReport, setAiReport] = useState<AiValidationReport | null>(null);
    const [corrections, setCorrections] = useState<CorrectionEntry[]>([]);
    const [isPreparing, setIsPreparing] = useState(false);

    const yearsOptions = useMemo(() => {
        const current = new Date().getFullYear();
        return [current - 1, current, current + 1];
    }, []);

    const canLoadStored = Boolean(existingMatrices && existingMatrices.length > 0);

    async function extractMatrices(files: ParsedFile[]) {
        const out: MatrixInput[] = [];
        for (const file of files) {
            const selected = new Set(file.selectedSheets);
            const data = await file.rawFile.arrayBuffer();
            const workbook = XLSX.read(data, { raw: true });
            for (const sheetName of workbook.SheetNames) {
                if (!selected.has(sheetName)) continue;
                const worksheet = workbook.Sheets[sheetName];
                const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null });
                if (!matrix || matrix.length < 2) continue;
                const headers = (matrix[0] ?? []).map((h) => String(h ?? '').trim());
                const rows = matrix.slice(1);
                out.push({ headers, rows, fileName: file.name, sheetName });
            }
        }
        return out;
    }

    async function processMatrices(parsedMatrices: MatrixInput[], relationsInput?: MappingRelationInput[]) {
        const mergedHeaders = Array.from(new Set(parsedMatrices.flatMap((m) => m.headers)));
        const resolvedRelations = relationsInput && relationsInput.length > 0 ? relationsInput : inferRelations(mergedHeaders);

        const report = validatePayrollCalculations({
            countryCode,
            year,
            matrices: parsedMatrices,
            relations: resolvedRelations,
        });

        const targetBySource = new Map(resolvedRelations.map((r) => [normalizeHeader(r.source), r.target]));
        const allRows = parsedMatrices.flatMap((matrix) =>
            matrix.rows.map((row) => {
                const obj: Record<string, unknown> = {};
                matrix.headers.forEach((h, i) => {
                    const key = targetBySource.get(normalizeHeader(h)) ?? h;
                    obj[key] = row[i];
                });
                return obj;
            })
        );

        let aiValidation: AiValidationReport | null = null;
        try {
            const aiRes = await fetch('/api/ai/validation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ allRows, countryCode, year, ruleChecks: [] }),
            });
            if (aiRes.ok) {
                const aiData = await aiRes.json();
                if (aiData.report) aiValidation = aiData.report as AiValidationReport;
            }
        } catch {
            aiValidation = existingAiReport;
        }

        setMatrices(parsedMatrices);
        setRelations(resolvedRelations);
        setValidationReport(report);
        setAiReport(aiValidation ?? existingAiReport);
        setCorrections([]);
    }

    async function processLiveFiles(files: ParsedFile[]) {
        setIsPreparing(true);
        try {
            const parsedMatrices = await extractMatrices(files);
            await processMatrices(parsedMatrices);
        } finally {
            setIsPreparing(false);
        }
    }

    async function loadStoredPayroll() {
        if (!existingMatrices || existingMatrices.length === 0) return;
        setIsPreparing(true);
        try {
            await processMatrices(existingMatrices, existingRelations ?? undefined);
        } finally {
            setIsPreparing(false);
        }
    }

    return (
        <div className="space-y-4 rounded-2xl border border-white/10 glass-panel p-4 shadow-xl shadow-black/20 text-white">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h3 className="text-xl font-bold text-white drop-shadow-sm flex items-center gap-2">
                        Editor en vivo de nómina
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Abre un archivo, corrige manualmente o con IA y aplica cambios sin salir de Reconciliación.</p>
                </div>
                <div className="flex items-end gap-2">
                    <div>
                        <label className="text-xs font-semibold text-slate-300 mb-1 block">País</label>
                        <select value={countryCode} onChange={(e) => setCountryCode(e.target.value as 'CO' | 'MX')} className="h-9 w-28 rounded-lg border border-white/20 bg-black/30 px-2 text-sm text-white shadow-inner focus:border-violet-light focus:ring-1 focus:ring-violet-light outline-none transition-shadow">
                            <option value="CO">CO</option>
                            <option value="MX">MX</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-300 mb-1 block">Año</label>
                        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 w-28 rounded-lg border border-white/20 bg-black/30 px-2 text-sm text-white shadow-inner focus:border-violet-light focus:ring-1 focus:ring-violet-light outline-none transition-shadow">
                            {yearsOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {canLoadStored && (
                <div className="rounded-xl border border-violet-500/30 glass-panel bg-violet-950/30 p-3 shadow-inner">
                    <p className="text-xs text-violet-100">También puedes reabrir la última nómina guardada sin volver a subir archivo.</p>
                    <button onClick={() => void loadStoredPayroll()} className="mt-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)] transition-all hover:-translate-y-0.5">
                        Abrir última nómina guardada
                    </button>
                </div>
            )}

            <UploadZone onProceed={(files) => { void processLiveFiles(files); }} />

            {isPreparing && (
                <div className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-950/40 p-3 text-sm text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.3)] animate-pulse-glow">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando nómina y preparando sugerencias IA...
                </div>
            )}

            {matrices && matrices.length > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="rounded-xl border border-white/10 glass-panel bg-black/20 p-3 shadow-sm">
                        <p className="text-sm font-semibold text-white drop-shadow-sm">Nómina lista para corrección</p>
                        <p className="mt-1 text-xs text-slate-300">
                            {validationReport?.rowsAnalyzed ?? 0} filas analizadas · {validationReport?.rowsWithFindings ?? 0} con hallazgos · {validationReport?.criticalFindings ?? 0} críticos
                            {aiReport?.hallazgosPorEmpleado?.length ? ` · ${aiReport.hallazgosPorEmpleado.length} empleados con hallazgos IA` : ''}
                        </p>
                    </div>

                    <PayrollEditor
                        matrices={matrices}
                        relations={relations}
                        validationReport={validationReport}
                        aiReport={aiReport}
                        payrollId={payrollId}
                        countryCode={countryCode}
                        year={year}
                        onCorrectionsChange={setCorrections}
                    />

                    <div className="rounded-xl border border-emerald-500/30 glass-panel bg-emerald-950/30 p-3 text-xs shadow-inner">
                        <p className="text-emerald-100">
                            Cambios aplicados: <strong className="text-emerald-300 drop-shadow-[0_0_2px_rgba(52,211,153,0.8)]">{corrections.length}</strong> (manuales: {corrections.filter((c) => c.source === 'manual').length}, IA: {corrections.filter((c) => c.source === 'ai').length})
                        </p>
                        <p className="mt-1 text-emerald-200/70">El botón de descarga del editor exporta la nómina corregida en Excel.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
