'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, AlertCircle, Bot, Sparkles, PlusCircle, Zap } from 'lucide-react';
import { Button } from './Button';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// ── Standard target fields ─────────────────────────────────────────────────────

const DEFAULT_TARGET_FIELDS = [
    'document_number', 'first_name', 'last_name', 'hire_date', 'contributor_type', 'worked_days',
    'base_salary', 'overtime_hours_day', 'overtime_hours_night', 'gross_pay',
    'non_salary_payments', 'transport_allowance',
    'ibc_total', 'ibc_salud', 'ibc_pension', 'ibc_arl', 'tope_40_no_salarial',
    'health_employee_deduction', 'pension_employee_deduction',
    'salud_empleador', 'pension_empleador', 'arl_value', 'parafiscales_total',
    'cesantias_provision', 'prima_provision', 'vacation_provision',
];

// ── Local instant matcher (no API call) ────────────────────────────────────────
// Each entry: [pattern, target_field]
// Covers ~90% of typical Spanish payroll column names

const LOCAL_FIELD_MAP: [RegExp, string][] = [
    // Identidad
    [/cedula|^cc$|nro\.?\s*doc|num\.?\s*doc|identificaci[oó]n|id\.?\s*emp/i, 'document_number'],
    [/nombre|^nombres?$|nombre\s*1|first\s*name|empleado|trabajador/i, 'first_name'],
    [/apellido|^apellidos?$|apellido\s*1|last\s*name/i, 'last_name'],
    [/fecha\s*(de\s*)?(ingreso|inicio|vinculaci[oó]n|contrat)|hire\s*date/i, 'hire_date'],
    [/tipo\s*(de\s*)?cotizante|cod\.?\s*cotizante|contributor\s*type|tipo/i, 'contributor_type'],
    [/d[ií]as|tiempo|trabajados?|laborados?|cotizados?|pagados?|worked\s*days/i, 'worked_days'],
    // Salario base
    [/salario\s*(b[aá]sico?|base)|sueldo\s*(b[aá]sico?|base)|devengado\s*b[aá]sico?|base\s*salary/i, 'base_salary'],
    [/hora\s*extra\s*diurna?|h\.?e\.?\s*diur|overtime\s*(hours?\s*)?day/i, 'overtime_hours_day'],
    [/hora\s*extra\s*nocturna?|h\.?e\.?\s*noc|overtime\s*(hours?\s*)?night/i, 'overtime_hours_night'],
    [/total\s*devengado|bruto\s*(total)?|gross\s*pay|devengado\s*total/i, 'gross_pay'],
    // No salariales — orden importante: transporte antes del patrón general
    [/auxilio\s*(de\s*)?transp|transp(orte)?(?!\s*no\s*sal)|transport/i, 'transport_allowance'],
    [/no\s*salarial|pagos?\s*no\s*sal|no\s*constitutiv|bono|auxili(?!o\s*(de\s*)?transp)|rodamiento|movilidad|conectividad|gasto\s*rep|viatico/i, 'non_salary_payments'],
    // IBC
    [/ibc\s*total|ingreso\s*base\s*(de\s*cotizaci[oó]n\s*)?total/i, 'ibc_total'],
    [/ibc\s*(de\s*)?salud|base\s*cotiz\w*\s*salud/i, 'ibc_salud'],
    [/ibc\s*(de\s*)?pensi[oó]n|base\s*cotiz\w*\s*pens/i, 'ibc_pension'],
    [/ibc\s*(de\s*)?arl/i, 'ibc_arl'],
    [/tope\s*40|l[ií]mite\s*no\s*sal|exceso\s*no\s*sal|ley\s*1393/i, 'tope_40_no_salarial'],
    // Aportes empleado
    [/desc\w*\s*salud|deducci[oó]n\s*salud|salud\s*empleado|aporte\s*salud\s*emp[l]?|cotiz\w*\s*salud/i, 'health_employee_deduction'],
    [/desc\w*\s*pensi[oó]n|deducci[oó]n\s*pens|pensi[oó]n\s*empleado|aporte\s*pensi[oó]n\s*emp[l]?|cotiz\w*\s*pens/i, 'pension_employee_deduction'],
    // Aportes empleador
    [/salud\s*empres\w*|aporte\s*salud\s*empres\w*|salud\s*empleador/i, 'salud_empleador'],
    [/pensi[oó]n\s*empres\w*|aporte\s*pensi[oó]n\s*empres\w*|pensi[oó]n\s*empleador/i, 'pension_empleador'],
    [/^arl$|valor\s*arl|aporte\s*arl|riesgo\s*lab/i, 'arl_value'],
    // Parafiscales
    [/parafiscal|sena\s*\+?\s*icbf|caja\s*comp/i, 'parafiscales_total'],
    // Prestaciones
    [/cesant[ií]a/i, 'cesantias_provision'],
    [/^prima$|prima\s*(de\s*)?(servicio|auxili)|provisi[oó]n\s*prima/i, 'prima_provision'],
    [/vacaci[oó]n|vacation/i, 'vacation_provision'],
];

function normalizeHeader(h: string) {
    return h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function localMatch(header: string): string | null {
    const h = normalizeHeader(header);
    for (const [pattern, target] of LOCAL_FIELD_MAP) {
        if (pattern.test(h)) return target;
    }
    return null;
}

function toSnakeCase(v: string) {
    return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// ── Types ──────────────────────────────────────────────────────────────────────

type MappingStatus = 'matched' | 'review';
type AnalysisCategory = 'identity' | 'salary_base' | 'non_salary' | 'ibc' | 'contribution' | 'contract' | 'informational';

interface MappingRow {
    source: string;
    target: string;
    confidence: number;
    status: MappingStatus;
    analysisCategory: AnalysisCategory;
    requiredByRule: boolean;
}

export interface MappingRelation {
    source: string;
    target: string;
    analysisCategory: AnalysisCategory;
    isCreated: boolean;
    requiredByRule: boolean;
}

export interface MappingResult {
    mappedTargets: string[];
    createdTargets: string[];
    mappingDetails: MappingRelation[];
}

export interface MappingAIProps {
    dynamicHeaders?: string[];
    fileName?: string;
    countryCode?: string;
    year?: number;
    requiredFields?: string[];
    requiredCalculations?: string[];
    onConfirm?: (result: MappingResult) => void;
}

function inferCategory(source: string, target: string): AnalysisCategory {
    const m = `${source} ${target}`.toLowerCase();
    if (/document|cedula|nombre|apellido|name/.test(m)) return 'identity';
    if (/salario|base_salary|devengado_b/.test(m) && !/no_sal|auxilio/.test(m)) return 'salary_base';
    if (/non_salary|no_salarial|auxilio|bono|rodamiento|transport/.test(m)) return 'non_salary';
    if (/ibc|tope_40/.test(m)) return 'ibc';
    if (/salud|pension|arl|parafiscal|deduccion|empleador/.test(m)) return 'contribution';
    if (/fecha|dias|worked|hire|cotizante|contributor/.test(m)) return 'contract';
    return 'informational';
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function MappingAI({
    dynamicHeaders = [],
    fileName = 'Dataset',
    countryCode = 'CO',
    year,
    requiredFields = [],
    requiredCalculations = [],
    onConfirm,
}: MappingAIProps) {
    const t = useTranslations('Upload');
    const [targetFields, setTargetFields] = useState<string[]>(DEFAULT_TARGET_FIELDS);
    const [data, setData] = useState<MappingRow[]>([]);
    const [phase, setPhase] = useState<'idle' | 'local' | 'ai' | 'done' | 'error'>('idle');
    const [newFieldName, setNewFieldName] = useState('');
    const autoConfirmRef = useRef(false);

    const requiredSet = useMemo(() => new Set([...requiredFields, ...requiredCalculations]), [requiredFields, requiredCalculations]);

    function addTargetField(fieldName: string): string {
        const normalized = toSnakeCase(fieldName.trim());
        if (!normalized) return '';
        setTargetFields((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
        return normalized;
    }

    function buildRow(source: string, target: string, confidence: number): MappingRow {
        return {
            source,
            target,
            confidence,
            status: target ? 'matched' : 'review',
            analysisCategory: inferCategory(source, target),
            requiredByRule: requiredSet.has(target),
        };
    }

    // ── Main pipeline: runs when headers change ──────────────────────────────
    useEffect(() => {
        if (dynamicHeaders.length === 0) return;

        autoConfirmRef.current = false;
        setPhase('local');

        // Step 1 — instant local matching
        const initialRows: MappingRow[] = dynamicHeaders.map((header) => {
            const matched = localMatch(header);
            if (matched) {
                addTargetField(matched);
                return buildRow(header, matched, 99);
            }
            return buildRow(header, '', 0);
        });

        setData(initialRows);

        const unresolved = initialRows.filter((r) => !r.target).map((r) => r.source);

        if (unresolved.length === 0) {
            // All matched locally — auto-confirm
            setPhase('done');
            autoConfirmRef.current = true;
            return;
        }

        // Step 2 — AI only for unresolved columns
        setPhase('ai');
        void (async () => {
            try {
                const res = await fetch('/api/ai/mapping', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uploadedColumns: unresolved,
                        countryCode,
                        year,
                        requiredFields,
                        requiredCalculations,
                    }),
                });

                if (res.ok) {
                    const result = await res.json() as { mapping?: Record<string, string>; relations?: Record<string, { analysisCategory?: AnalysisCategory; requiredByRule?: boolean }> };
                    setData((prev) => {
                        const updated = prev.map((row) => {
                            if (row.target) return row; // already matched locally
                            const suggestion = result.mapping?.[row.source];
                            if (!suggestion?.trim()) return row;
                            const normalized = toSnakeCase(suggestion);
                            addTargetField(normalized);
                            return buildRow(row.source, normalized, 90);
                        });
                        const stillUnresolved = updated.filter((r) => !r.target).length;
                        if (stillUnresolved === 0) autoConfirmRef.current = true;
                        return updated;
                    });
                }
            } catch (err) {
                console.error('AI mapping failed:', err);
            } finally {
                setPhase('done');
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dynamicHeaders]);

    // ── Auto-confirm when all resolved ────────────────────────────────────────
    useEffect(() => {
        if (phase === 'done' && autoConfirmRef.current) {
            const allResolved = data.length > 0 && data.every((r) => r.target);
            if (allResolved) handleConfirm(data);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, data]);

    const unresolvedCount = useMemo(() => data.filter((r) => !r.target).length, [data]);
    const isProcessing = phase === 'local' || phase === 'ai';

    const updateRow = (idx: number, target: string) => {
        setData((prev) => {
            const updated = [...prev];
            updated[idx] = buildRow(updated[idx].source, target, target ? 90 : 0);
            return updated;
        });
    };

    const handleFieldSelection = (idx: number, value: string) => {
        if (value === '__create__') {
            const customField = window.prompt('Nombre del nuevo campo destino (ej: bono_no_salarial):');
            if (!customField) return;
            const created = addTargetField(customField);
            if (created) updateRow(idx, created);
            return;
        }
        updateRow(idx, value);
    };

    const handleCreateFieldButton = () => {
        const created = addTargetField(newFieldName);
        if (created) setNewFieldName('');
    };

    function handleConfirm(rows: MappingRow[] = data) {
        const mappedTargets = Array.from(new Set(rows.map((r) => r.target).filter(Boolean)));
        const createdTargets = mappedTargets.filter((f) => !DEFAULT_TARGET_FIELDS.includes(f));
        const mappingDetails = rows
            .filter((r) => r.target)
            .map((r) => ({
                source: r.source,
                target: r.target,
                analysisCategory: r.analysisCategory,
                isCreated: !DEFAULT_TARGET_FIELDS.includes(r.target),
                requiredByRule: r.requiredByRule,
            }));
        onConfirm?.({ mappedTargets, createdTargets, mappingDetails });
    }

    const reAnalyze = async () => {
        const unresolved = data.filter((r) => !r.target).map((r) => r.source);
        if (unresolved.length === 0) return;
        setPhase('ai');
        try {
            const res = await fetch('/api/ai/mapping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uploadedColumns: unresolved, countryCode, year, requiredFields, requiredCalculations }),
            });
            if (res.ok) {
                const result = await res.json() as { mapping?: Record<string, string> };
                setData((prev) =>
                    prev.map((row) => {
                        if (row.target) return row;
                        const suggestion = result.mapping?.[row.source];
                        if (!suggestion?.trim()) return row;
                        const normalized = toSnakeCase(suggestion);
                        addTargetField(normalized);
                        return buildRow(row.source, normalized, 90);
                    })
                );
            }
        } catch (e) {
            console.error('Re-analysis failed:', e);
        } finally {
            setPhase('done');
        }
    };

    // ── Loading screen ─────────────────────────────────────────────────────────
    if (phase === 'local' || (phase === 'ai' && unresolvedCount === data.length)) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-900/40 border border-violet-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                    <Zap className="w-6 h-6 text-violet-light animate-pulse-glow" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-semibold text-white drop-shadow-sm">
                        {phase === 'local' ? 'Analizando columnas...' : 'Consultando IA para columnas no reconocidas...'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        {phase === 'local' ? 'Aplicando reglas de mapeo locales' : `${data.filter(r => !r.target).length} columna(s) enviadas a la IA`}
                    </p>
                </div>
                <div className="flex gap-1.5">
                    {[0, 150, 300].map((d) => (
                        <span key={d} className="w-2 h-2 bg-violet/40 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                </div>
            </div>
        );
    }

    // ── Auto-confirming screen ─────────────────────────────────────────────────
    if (phase === 'done' && unresolvedCount === 0 && autoConfirmRef.current) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 animate-in fade-in duration-500">
                <div className="w-12 h-12 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                    <Check className="w-6 h-6 text-emerald-light drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-semibold text-white drop-shadow-sm">Mapeo completado automáticamente</p>
                    <p className="text-xs text-slate-400 mt-1">{data.length} columnas mapeadas · Continuando...</p>
                </div>
            </div>
        );
    }

    // ── Manual correction UI (only shown when there are unresolved columns) ────
    return (
        <div className="w-full max-w-5xl mx-auto mt-4 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                    <h3 className="text-base font-semibold text-white drop-shadow-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-light drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
                        {t('mappingTitle')}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-200">{fileName}</span> · {data.length} columnas ·{' '}
                        {phase === 'ai' ? (
                            <span className="text-violet-light drop-shadow-[0_0_2px_rgba(139,92,246,0.5)]">Consultando IA para {unresolvedCount} columna(s)...</span>
                        ) : (
                            <span className={unresolvedCount > 0 ? 'text-amber-400 font-medium' : 'text-emerald-400 font-medium'}>
                                {unresolvedCount > 0 ? `${unresolvedCount} requieren mapeo manual` : 'Todas mapeadas'}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {phase === 'ai' && (
                        <span className="px-2.5 py-1 bg-violet-900/30 text-violet-light rounded-full text-xs font-semibold flex items-center gap-1.5 border border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.3)] animate-pulse-glow">
                            <Bot className="w-3.5 h-3.5" /> IA procesando...
                        </span>
                    )}
                </div>
            </div>

            {/* Target fields panel */}
            <div className="glass-panel border border-white/10 rounded-xl p-3 mb-4 shadow-xl shadow-black/20">
                <p className="text-xs font-semibold text-slate-300 mb-2">Campos destino disponibles</p>
                <div className="flex gap-1.5 flex-wrap mb-3 max-h-20 overflow-y-auto custom-scrollbar">
                    {targetFields.map((field) => (
                        <span key={field} className="text-[10px] bg-black/40 border border-white/10 shadow-inner rounded-full px-2.5 py-1 text-slate-300 font-mono">
                            {field}
                        </span>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <input
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        placeholder="Crear campo personalizado (ej: bono_extralegal)"
                        className="flex-1 h-8 rounded-md border border-white/20 bg-black/30 px-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-light focus:border-violet-light shadow-inner"
                    />
                    <Button type="button" variant="outline" onClick={handleCreateFieldButton} className="gap-1.5 h-8 text-xs px-3 border-white/20 hover:border-white/40 glass-panel">
                        <PlusCircle className="w-3.5 h-3.5" /> Crear
                    </Button>
                </div>
            </div>

            {/* Mapping table */}
            <div className="glass-panel rounded-xl border border-white/10 shadow-xl shadow-black/30 overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-white/10 bg-black/40 text-xs font-semibold text-slate-300 uppercase tracking-wide">
                    <div className="col-span-5">Columna en planilla</div>
                    <div className="col-span-1 flex justify-center"><ArrowRight className="w-3.5 h-3.5" /></div>
                    <div className="col-span-5">Campo UGPP / sistema</div>
                    <div className="col-span-1 text-right">OK</div>
                </div>
                <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {data.map((row, idx) => (
                        <div
                            key={`${row.source}-${idx}`}
                            className={cn(
                                'grid grid-cols-12 gap-4 px-5 py-3 items-center transition-colors',
                                row.status === 'review' ? 'bg-amber-950/20' : 'hover:bg-white/5'
                            )}
                        >
                            <div className="col-span-5">
                                <span className="bg-black/40 px-2.5 py-1 rounded text-xs text-slate-300 font-mono border border-white/10 shadow-inner inline-block truncate max-w-full">
                                    {row.source}
                                </span>
                            </div>
                            <div className="col-span-1 flex justify-center">
                                {phase === 'ai' && !row.target ? (
                                    <div className="w-4 h-4 border-2 border-violet-light border-t-transparent rounded-full animate-spin shadow-[0_0_5px_rgba(139,92,246,0.5)]" />
                                ) : (
                                    <ArrowRight className={cn('w-4 h-4 transition-colors', row.status === 'review' ? 'text-amber-500' : 'text-emerald-400 drop-shadow-[0_0_2px_rgba(52,211,153,0.5)]')} />
                                )}
                            </div>
                            <div className="col-span-5">
                                <select
                                    className={cn(
                                        'w-full text-xs rounded-md border py-2 px-2 focus:ring-1 focus:ring-violet-light transition-shadow outline-none shadow-inner',
                                        row.status === 'review'
                                            ? 'border-amber-500/50 bg-amber-950/40 text-amber-200 focus:border-amber-400 focus:ring-amber-400'
                                            : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-100 font-medium focus:border-emerald-400'
                                    )}
                                    value={row.target}
                                    onChange={(e) => handleFieldSelection(idx, e.target.value)}
                                >
                                    <option value="" className="bg-slate-900 text-slate-300">— Seleccionar campo —</option>
                                    {targetFields.map((field) => (
                                        <option key={field} value={field} className="bg-slate-900 text-slate-300">{field}</option>
                                    ))}
                                    <option value="__create__" className="bg-slate-800 text-violet-300 font-semibold">+ Crear campo nuevo...</option>
                                </select>
                                {row.status === 'review' && phase !== 'ai' && (
                                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-400 font-medium animate-pulse">
                                        <AlertCircle className="w-3 h-3" /> Requiere mapeo
                                    </p>
                                )}
                            </div>
                            <div className="col-span-1 flex justify-end">
                                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center transition-all',
                                    row.status === 'matched' ? 'bg-emerald-900/50 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'bg-amber-900/50 text-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                                )}>
                                    {row.status === 'matched' ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-4 flex justify-between items-center gap-3 flex-wrap">
                <Button variant="outline" onClick={reAnalyze} disabled={isProcessing || unresolvedCount === 0} className="gap-2 text-xs">
                    <Bot className="w-3.5 h-3.5" /> Re-analizar sin mapear ({unresolvedCount})
                </Button>
                <Button size="lg" onClick={() => handleConfirm()} disabled={unresolvedCount > 0 || isProcessing}>
                    Confirmar y continuar
                </Button>
            </div>
        </div>
    );
}
