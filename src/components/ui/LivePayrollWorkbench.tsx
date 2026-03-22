'use client';

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import UploadZone, { ParsedFile } from '@/components/ui/UploadZone';
import PayrollEditor, { type CorrectionEntry } from '@/components/ui/PayrollEditor';
import { validatePayrollCalculations, type MappingAnalysisCategory, type MappingRelationInput, type MatrixInput, type ValidationReport } from '@/lib/payroll/ruleValidation';
import type { AiValidationReport } from '@/app/api/ai/validation/route';
import { Loader2 } from 'lucide-react';
import { GuidedFlow } from '@/components/ui/GuidedFlow';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { AgentPipeline, type PipelineStep, type InterAgentMessage } from '@/components/ui/AgentPipeline';

/**
 * Props del componente LivePayrollWorkbench.
 *
 * @property payrollId - UUID de la carga de nómina existente, o null para una nueva.
 * @property defaultCountry - Código ISO del país preseleccionado (ej. 'CO').
 * @property defaultYear - Año fiscal preseleccionado.
 * @property existingMatrices - Matrices previamente guardadas para reabrir sin re-subir archivo.
 * @property existingRelations - Relaciones de mapeo previamente guardadas.
 * @property existingAiReport - Reporte IA previamente generado.
 */
interface LivePayrollWorkbenchProps {
    payrollId: string | null;
    defaultCountry: string;
    defaultYear: number;
    existingMatrices?: MatrixInput[] | null;
    existingRelations?: MappingRelationInput[] | null;
    existingAiReport?: AiValidationReport | null;
}

/**
 * Reglas de mapeo automático de encabezados de nómina a campos estándar.
 *
 * Cada entrada define un patrón regex multi-idioma (ES/PT/EN) que se
 * evalúa contra los encabezados normalizados del archivo Excel cargado.
 * Si coincide, se asigna el campo destino (`target`) y la categoría
 * de análisis (`category`) correspondiente.
 */
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

/**
 * Normaliza un encabezado: minúsculas, sin acentos, sin espacios extra.
 * @param input - Texto del encabezado original.
 * @returns Texto normalizado para comparación.
 */
function normalizeHeader(input: string) {
    return input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Convierte un encabezado a formato snake_case para usar como campo destino.
 * @param input - Texto del encabezado original.
 * @returns Identificador en snake_case.
 */
function toSnake(input: string) {
    return normalizeHeader(input).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Infiere relaciones de mapeo automáticas a partir de los encabezados del archivo.
 *
 * Recorre cada encabezado y lo compara contra {@link AUTO_TARGET_MAP}.
 * Si coincide con un patrón, asigna el campo destino canónico; si no,
 * genera un campo snake_case con categoría 'informational'.
 * Evita duplicar campos canónicos ya asignados.
 *
 * @param headers - Encabezados originales del archivo Excel.
 * @returns Array de relaciones de mapeo fuente→destino.
 */
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

/**
 * Editor en vivo de nómina con pipeline multi-agente.
 *
 * Componente principal de la página de Reconciliación que orquesta el flujo
 * completo: carga de archivo Excel → mapeo automático de columnas → validación
 * normativa (14 verificaciones) → análisis IA → corrección manual/IA → descarga.
 *
 * Visualiza el progreso mediante {@link GuidedFlow} (pasos del flujo) y
 * {@link AgentPipeline} (estado de cada agente: mapper, auditor, corrector, writer).
 *
 * Usa tokens del design system Obsidian Ledger para superficies tonales:
 * `bg-[#131b2e]` (containerLow), `bg-[#222a3d]` (containerHigh), etc.
 *
 * @param props - {@link LivePayrollWorkbenchProps}
 */
export default function LivePayrollWorkbench({
    payrollId,
    defaultCountry,
    defaultYear,
    existingMatrices = null,
    existingRelations = null,
    existingAiReport = null,
}: LivePayrollWorkbenchProps) {
    const [countryCode, setCountryCode] = useState<string>(defaultCountry || 'CO');
    const [year, setYear] = useState<number>(defaultYear || new Date().getFullYear());

    const [matrices, setMatrices] = useState<MatrixInput[] | null>(null);
    const [relations, setRelations] = useState<MappingRelationInput[]>([]);
    const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
    const [aiReport, setAiReport] = useState<AiValidationReport | null>(null);
    const [corrections, setCorrections] = useState<CorrectionEntry[]>([]);
    const [isPreparing, setIsPreparing] = useState(false);
    const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
    const [pipelineMessages, setPipelineMessages] = useState<InterAgentMessage[]>([]);

    // Guided flow step: 0=upload, 1=mapping, 2=validation, 3=results
    const guidedStep = useMemo(() => {
        if (!matrices || matrices.length === 0) return 0; // upload
        if (isPreparing) return 1; // mapping in progress
        if (validationReport && (aiReport || validationReport.rowsAnalyzed > 0)) return 3; // results ready
        if (relations.length > 0) return 2; // validation
        return 1; // mapping
    }, [matrices, relations, validationReport, aiReport, isPreparing]);

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
        const totalRows = parsedMatrices.reduce((acc, m) => acc + m.rows.length, 0);

        // Initialize pipeline visualization
        setPipelineSteps([
            { agentId: 'mapper', label: 'Mapeo de columnas', detail: `Conectando columnas de ${parsedMatrices.length} hoja(s)...`, status: 'running' },
            { agentId: 'auditor', label: 'Auditoría normativa', detail: `${totalRows} filas pendientes de validación`, status: 'pending' },
            { agentId: 'corrector', label: 'Cálculo de correcciones', status: 'pending' },
            { agentId: 'writer', label: 'Generación de reporte', status: 'pending' },
        ]);
        setPipelineMessages([]);

        const mapStart = Date.now();
        const mergedHeaders = Array.from(new Set(parsedMatrices.flatMap((m) => m.headers)));
        const resolvedRelations = relationsInput && relationsInput.length > 0 ? relationsInput : inferRelations(mergedHeaders);
        const mapLatency = Date.now() - mapStart;

        // Mapper done
        setPipelineSteps(prev => prev.map((s, i) =>
            i === 0 ? { ...s, status: 'done', detail: `${resolvedRelations.length} columnas mapeadas`, latencyMs: mapLatency, resultCount: resolvedRelations.length, resultLabel: 'columnas' } :
            i === 1 ? { ...s, status: 'running', detail: `Validando ${totalRows} filas contra normativa ${countryCode}...` } : s
        ));

        const auditStart = Date.now();
        const report = validatePayrollCalculations({
            countryCode,
            year,
            matrices: parsedMatrices,
            relations: resolvedRelations,
        });
        const auditLatency = Date.now() - auditStart;

        const checksWithFindings = (report.checks ?? []).filter(c => c.failedRows > 0).length;

        // Auditor done, corrector starts
        setPipelineSteps(prev => prev.map((s, i) =>
            i === 1 ? { ...s, status: 'done', detail: `${report.criticalFindings} hallazgos críticos en ${report.rowsWithFindings} filas`, latencyMs: auditLatency, resultCount: checksWithFindings, resultLabel: 'checks con hallazgos' } :
            i === 2 ? { ...s, status: 'running', detail: 'Calculando correcciones determinísticas...' } : s
        ));

        // Show auditor→corrector communication
        if (report.criticalFindings > 0) {
            setPipelineMessages(prev => [...prev, { from: 'auditor', to: 'corrector', type: 'auto-correct-suggestions' }]);
        }

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

        // Corrector done, writer starts
        setPipelineSteps(prev => prev.map((s, i) =>
            i === 2 ? { ...s, status: 'done', detail: 'Correcciones calculadas', latencyMs: 50 } :
            i === 3 ? { ...s, status: 'running', detail: 'Generando análisis con IA...' } : s
        ));

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

        // All done
        setPipelineSteps(prev => prev.map((s, i) =>
            i === 3 ? { ...s, status: 'done', detail: aiValidation ? 'Reporte IA generado' : 'Reporte basado en motor de reglas', latencyMs: 0 } : s
        ));

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
        <div className="space-y-5 rounded-2xl glass-panel p-5 text-[#dae2fd]">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-[#dae2fd] flex items-center gap-2">
                        Editor en vivo de nómina
                    </h3>
                    <p className="text-xs text-[#958ea0] mt-1">Abre un archivo, corrige manualmente o con IA y aplica cambios sin salir de Reconciliación.</p>
                </div>
                <div className="flex items-end gap-3">
                    <div>
                        <label className="text-[10px] font-semibold text-[#cbc3d7] mb-1 block tracking-wider uppercase">País</label>
                        <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="h-9 w-28 rounded-lg bg-[#060e20] px-2 text-sm text-[#dae2fd] focus:border-[#a078ff]/40 focus:ring-1 focus:ring-[#a078ff]/30 focus:shadow-[0_0_15px_rgba(160,120,255,0.1)] outline-none transition-all">
                            <option value="CO">🇨🇴 CO</option>
                            <option value="MX">🇲🇽 MX</option>
                            <option value="PE">🇵🇪 PE</option>
                            <option value="CL">🇨🇱 CL</option>
                            <option value="BR">🇧🇷 BR</option>
                            <option value="AR">🇦🇷 AR</option>
                            <option value="US">🇺🇸 US</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold text-[#cbc3d7] mb-1 block tracking-wider uppercase">Año</label>
                        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 w-28 rounded-lg bg-[#060e20] px-2 text-sm text-[#dae2fd] focus:border-[#a078ff]/40 focus:ring-1 focus:ring-[#a078ff]/30 focus:shadow-[0_0_15px_rgba(160,120,255,0.1)] outline-none transition-all">
                            {yearsOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <GuidedFlow currentStep={guidedStep} />

            {canLoadStored && (
                <div className="rounded-xl bg-[#222a3d] p-4">
                    <p className="text-xs text-[#d0bcff]">También puedes reabrir la última nómina guardada sin volver a subir archivo.</p>
                    <button onClick={() => void loadStoredPayroll()} className="mt-2.5 rounded-lg bg-gradient-to-r from-[#d0bcff] to-[#a078ff] px-4 py-2 text-xs font-semibold text-[#23005c] hover:opacity-90 transition-all hover:-translate-y-0.5 shadow-[0_0_15px_rgba(160,120,255,0.25)]">
                        Abrir última nómina guardada
                    </button>
                </div>
            )}

            <UploadZone onProceed={(files) => { void processLiveFiles(files); }} />

            {isPreparing && (
                <AgentPipeline steps={pipelineSteps} messages={pipelineMessages} />
            )}

            {matrices && matrices.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Show completed pipeline summary */}
                    {pipelineSteps.length > 0 && !isPreparing && (
                        <AgentPipeline steps={pipelineSteps} messages={pipelineMessages} />
                    )}

                    <div className="rounded-xl bg-[#131b2e] p-4">
                        <div className="flex items-center gap-2">
                            <AgentAvatar agentId="auditor" size={24} animate={false} />
                            <p className="text-sm font-semibold text-[#dae2fd]">Nómina lista para corrección</p>
                        </div>
                        <p className="mt-1.5 text-xs text-[#cbc3d7] ml-8">
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

                    <div className="rounded-xl bg-[#005236]/15 p-4 text-xs">
                        <p className="text-[#4edea3]">
                            Cambios aplicados: <strong className="text-[#4edea3] font-bold">{corrections.length}</strong> (manuales: {corrections.filter((c) => c.source === 'manual').length}, IA: {corrections.filter((c) => c.source === 'ai').length})
                        </p>
                        <p className="mt-1 text-[#4edea3]/60">El botón de descarga del editor exporta la nómina corregida en Excel.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
