'use client';

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { MatrixInput, MappingRelationInput, ValidationReport } from '@/lib/payroll/ruleValidation';
import type { AiValidationReport } from '@/app/api/ai/validation/route';
import type { AiCorrectionSuggestion } from '@/app/api/ai/corrections/route';
import { CURRENCY_TARGET_FIELDS } from '@/lib/payroll/ruleValidation';
import { Calculator, Check, X, Sparkles } from 'lucide-react';

/** Wil correction suggestion with formula (from corrector agent) */
export interface WilCorrection {
    rowIndex: number;
    fieldName: string;
    currentValue: number;
    suggestedValue: number;
    justification: string;
    formula?: string;
}

export interface CorrectionEntry {
    sheetIndex: number;
    rowIndex: number;
    colIndex: number;
    originalValue: unknown;
    newValue: unknown;
    source: 'manual' | 'ai';
}

interface Props {
    matrices: MatrixInput[];
    relations: MappingRelationInput[];
    validationReport: ValidationReport | null;
    aiReport: AiValidationReport | null;
    payrollId: string | null;
    countryCode: string;
    year: number;
    onCorrectionsChange: (corrections: CorrectionEntry[]) => void;
    /** Corrections from Wil corrector agent (Req 6.4) */
    wilCorrections?: WilCorrection[];
}

const PAGE = 20;

const n = (x: unknown) => {
    if (typeof x === 'number') return Number.isFinite(x) ? x : 0;
    if (typeof x === 'string') {
        const v = Number(x.replace(/[^0-9,.-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.'));
        return Number.isFinite(v) ? v : 0;
    }
    return 0;
};
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const r = (x: number) => Math.round(x);

function getVal(m: MatrixInput[], c: CorrectionEntry[], si: number, ri: number, ci: number) {
    const corr = c.find((x) => x.sheetIndex === si && x.rowIndex === ri && x.colIndex === ci);
    if (corr) return corr.newValue;
    return m[si]?.rows[ri]?.[ci] ?? '';
}

function applyCorr(m: MatrixInput[], corr: CorrectionEntry[]) {
    return m.map((sheet, si) => {
        const rows = sheet.rows.map((row, ri) => {
            const rowCorr = corr.filter((x) => x.sheetIndex === si && x.rowIndex === ri);
            if (!rowCorr.length) return row;
            const out = [...row];
            for (const c of rowCorr) out[c.colIndex] = c.newValue;
            return out;
        });
        return { ...sheet, rows };
    });
}

const CURRENCY_FIELDS = new Set(CURRENCY_TARGET_FIELDS);

const formatValue = (v: unknown, target: string | undefined) => {
    if (v instanceof Date) return v.toLocaleDateString('es-CO');
    if (v === null || v === undefined) return '';

    if (typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v.trim() !== '')) {
        const num = Number(v);
        if (target && CURRENCY_FIELDS.has(target)) {
            return new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP',
                maximumFractionDigits: 0
            }).format(num);
        }
    }
    return String(v);
};

export default function PayrollEditor({
    matrices,
    relations,
    validationReport,
    countryCode,
    year,
    onCorrectionsChange,
    wilCorrections = [],
}: Props) {
    const [sheet, setSheet] = useState(0);
    const [page, setPage] = useState(0);
    const [editing, setEditing] = useState<{ ri: number; ci: number } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [corr, setCorr] = useState<CorrectionEntry[]>([]);
    const [loadingAllAi, setLoadingAllAi] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<Record<string, AiCorrectionSuggestion[]>>({});
    /** Track which Wil corrections have been accepted/rejected */
    const [wilDecisions, setWilDecisions] = useState<Record<string, 'accepted' | 'rejected'>>({});

    const headers = useMemo(() => matrices[sheet]?.headers ?? [], [matrices, sheet]);
    const rows = useMemo(() => matrices[sheet]?.rows ?? [], [matrices, sheet]);

    const checkBadDocs = useMemo(() => {
        const s = new Set<string>();
        if (!validationReport) return s;
        for (const check of validationReport.checks) for (const f of check.sampleFindings) {
            const m = f.match(/^([^:]+):/);
            if (m?.[1]) s.add(m[1].trim());
        }
        return s;
    }, [validationReport]);

    const docCol = useMemo(() => {
        const rel = relations.find((x) => x.target === 'document_number');
        if (!rel) return -1;
        return headers.findIndex((h) => norm(h) === norm(rel.source));
    }, [headers, relations]);

    const isBadRow = (row: unknown[]) => {
        const doc = docCol >= 0 ? String(row[docCol] ?? '').trim() : '';
        return doc ? checkBadDocs.has(doc) : false;
    };

    const viewRows = useMemo(() => rows.map((row, i) => ({ row, i })), [rows]);
    const pageRows = viewRows.slice(page * PAGE, (page + 1) * PAGE);
    const totalPages = Math.max(1, Math.ceil(viewRows.length / PAGE));

    const setAllCorr = (next: CorrectionEntry[]) => {
        setCorr(next);
        onCorrectionsChange(next);
    };

    const upsertCorr = (next: CorrectionEntry[], c: CorrectionEntry) => {
        const rest = next.filter((x) => !(x.sheetIndex === c.sheetIndex && x.rowIndex === c.rowIndex && x.colIndex === c.colIndex));
        rest.push(c);
        return rest;
    };

    const commitEdit = () => {
        if (!editing) return;
        const ov = matrices[sheet]?.rows[editing.ri]?.[editing.ci] ?? '';
        if (String(ov) === String(editValue)) {
            setEditing(null);
            return;
        }
        setAllCorr(upsertCorr(corr, { sheetIndex: sheet, rowIndex: editing.ri, colIndex: editing.ci, originalValue: ov, newValue: editValue, source: 'manual' }));
        setEditing(null);
    };

    const colByTarget = useMemo(() => {
        const m = new Map<string, number>();
        for (const rel of relations) {
            const idx = headers.findIndex((h) => norm(h) === norm(rel.source));
            if (idx >= 0 && !m.has(rel.target)) m.set(rel.target, idx);
        }
        return m;
    }, [headers, relations]);

    const targetByCol = useMemo(() => {
        const m = new Map<number, string>();
        for (const rel of relations) {
            const idx = headers.findIndex((h) => norm(h) === norm(rel.source));
            if (idx >= 0) m.set(idx, rel.target);
        }
        return m;
    }, [headers, relations]);

    /** Index Wil corrections by cell key for quick lookup (Req 6.4) */
    const wilCorrByCell = useMemo(() => {
        const m = new Map<string, WilCorrection>();
        for (const wc of wilCorrections) {
            const ci = colByTarget.get(wc.fieldName);
            if (ci !== undefined) {
                m.set(`${sheet}-${wc.rowIndex}-${ci}`, wc);
            }
        }
        return m;
    }, [wilCorrections, colByTarget, sheet]);

    /** Accept a Wil correction: apply value and register in history (Req 6.5) */
    const acceptWilCorrection = (wc: WilCorrection) => {
        const ci = colByTarget.get(wc.fieldName);
        if (ci === undefined) return;
        const key = `${sheet}-${wc.rowIndex}-${ci}`;
        const ov = getVal(matrices, corr, sheet, wc.rowIndex, ci);
        setAllCorr(upsertCorr(corr, {
            sheetIndex: sheet,
            rowIndex: wc.rowIndex,
            colIndex: ci,
            originalValue: ov,
            newValue: wc.suggestedValue,
            source: 'ai',
        }));
        setWilDecisions(prev => ({ ...prev, [key]: 'accepted' }));
    };

    /** Reject a Wil correction (Req 6.4) */
    const rejectWilCorrection = (wc: WilCorrection) => {
        const ci = colByTarget.get(wc.fieldName);
        if (ci === undefined) return;
        const key = `${sheet}-${wc.rowIndex}-${ci}`;
        setWilDecisions(prev => ({ ...prev, [key]: 'rejected' }));
    };

    const applyFormulaAll = () => {
        let next = [...corr];
        const idx = {
            salary: colByTarget.get('base_salary') ?? -1,
            nonSalary: colByTarget.get('non_salary_payments') ?? -1,
            gross: colByTarget.get('gross_pay') ?? -1,
            tope: colByTarget.get('tope_40_no_salarial') ?? -1,
            ibc: colByTarget.get('ibc_total') ?? -1,
            ibcS: colByTarget.get('ibc_salud') ?? -1,
            ibcP: colByTarget.get('ibc_pension') ?? -1,
            ibcA: colByTarget.get('ibc_arl') ?? -1,
            dSalud: colByTarget.get('health_employee_deduction') ?? -1,
            dPens: colByTarget.get('pension_employee_deduction') ?? -1,
            eSalud: colByTarget.get('salud_empleador') ?? -1,
            ePens: colByTarget.get('pension_empleador') ?? -1,
            para: colByTarget.get('parafiscales_total') ?? -1,
            ces: colByTarget.get('cesantias_provision') ?? -1,
            pri: colByTarget.get('prima_provision') ?? -1,
            vac: colByTarget.get('vacation_provision') ?? -1,
        };

        const setIf = (ri: number, ci: number, expected: number) => {
            if (ci < 0 || expected <= 0) return;
            const cur = n(getVal(matrices, next, sheet, ri, ci));
            if (Math.abs(cur - expected) <= Math.max(100, expected * 0.01)) return;
            const ov = getVal(matrices, next, sheet, ri, ci);
            next = upsertCorr(next, { sheetIndex: sheet, rowIndex: ri, colIndex: ci, originalValue: ov, newValue: expected, source: 'ai' });
        };

        for (let ri = 0; ri < rows.length; ri += 1) {
            const salary = idx.salary >= 0 ? n(getVal(matrices, next, sheet, ri, idx.salary)) : 0;
            const nonSalary = idx.nonSalary >= 0 ? n(getVal(matrices, next, sheet, ri, idx.nonSalary)) : 0;
            const gross = idx.gross >= 0 ? n(getVal(matrices, next, sheet, ri, idx.gross)) : salary + nonSalary;
            if (salary <= 0 && gross <= 0) continue;

            const excess = Math.max(0, nonSalary - gross * 0.4);
            const ibc = r(salary + excess);
            setIf(ri, idx.tope, r(excess));
            setIf(ri, idx.ibc, ibc);
            setIf(ri, idx.ibcS, ibc);
            setIf(ri, idx.ibcP, ibc);
            setIf(ri, idx.ibcA, ibc);
            setIf(ri, idx.dSalud, r(ibc * 0.04));
            setIf(ri, idx.dPens, r(ibc * 0.04));
            setIf(ri, idx.eSalud, r(ibc * 0.085));
            setIf(ri, idx.ePens, r(ibc * 0.12));
            setIf(ri, idx.para, r(ibc * 0.09));
            setIf(ri, idx.ces, r(gross * 0.0833));
            setIf(ri, idx.pri, r(gross * 0.0833));
            setIf(ri, idx.vac, r(salary * 0.0417));
        }
        setAllCorr(next);
    };

    const suggestAiAll = async () => {
        if (!validationReport) return;
        const bad = rows.map((row, i) => ({ row, i })).filter((x) => isBadRow(x.row)).slice(0, 80);
        if (!bad.length) return;
        setLoadingAllAi(true);
        try {
            const payloadRows = bad.map(({ i }) => {
                const obj: Record<string, unknown> = {};
                headers.forEach((h, ci) => { obj[h] = getVal(matrices, corr, sheet, i, ci); });
                return obj;
            });
            const findings = validationReport.checks.flatMap((x) => x.sampleFindings).slice(0, 120);
            const res = await fetch('/api/ai/corrections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: payloadRows, findings, headers, countryCode, year }),
            });
            if (!res.ok) return;
            const data = await res.json() as { suggestions?: AiCorrectionSuggestion[] };
            const grouped: Record<string, AiCorrectionSuggestion[]> = {};
            for (const s of (data.suggestions ?? [])) {
                const globalRow = bad[s.rowIndex]?.i;
                if (globalRow === undefined) continue;
                const key = `${sheet}-${globalRow}`;
                grouped[key] = [...(grouped[key] ?? []), { ...s, rowIndex: globalRow }];
            }
            setAiSuggestions((prev) => ({ ...prev, ...grouped }));
        } finally {
            setLoadingAllAi(false);
        }
    };

    const applyAllAi = () => {
        let next = [...corr];
        for (const [key, list] of Object.entries(aiSuggestions)) {
            if (!key.startsWith(`${sheet}-`)) continue;
            for (const s of list) {
                const ci = headers.findIndex((h) => norm(h) === norm(s.field));
                if (ci < 0) continue;
                const ov = getVal(matrices, next, sheet, s.rowIndex, ci);
                next = upsertCorr(next, { sheetIndex: sheet, rowIndex: s.rowIndex, colIndex: ci, originalValue: ov, newValue: s.suggestedValue, source: 'ai' });
            }
        }
        setAllCorr(next);
    };

    const exportXlsx = () => {
        const corrected = applyCorr(matrices, corr);
        const wb = XLSX.utils.book_new();
        corrected.forEach((m, i) => {
            const ws = XLSX.utils.aoa_to_sheet([m.headers, ...m.rows]);
            XLSX.utils.book_append_sheet(wb, ws, m.sheetName ?? `Hoja${i + 1}`);
        });
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nomina_corregida_${Date.now()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-white/10 glass-panel p-4 shadow-lg shadow-black/20">
                <div className="flex flex-wrap gap-3">
                    <Button onClick={exportXlsx} className="shadow-[0_0_15px_rgba(139,92,246,0.5)]">Descargar nómina corregida</Button>
                    <Button variant="outline" className="border-violet-500/50 text-violet-light hover:bg-violet-950/50 hover:text-white glass-panel shadow-[0_0_10px_rgba(139,92,246,0.2)] transition-all" onClick={applyFormulaAll}>
                        ✨ Autocompletar Cálculos Legales (CO)
                    </Button>
                    <Button variant="outline" className="border-white/20 glass-panel hover:bg-white/10 text-slate-200" onClick={() => void suggestAiAll()} disabled={loadingAllAi}>{loadingAllAi ? 'IA en lote...' : 'IA en lote'}</Button>
                    <Button variant="outline" className="border-white/20 glass-panel hover:bg-white/10 text-slate-200" onClick={applyAllAi}>Aplicar sugerencias IA</Button>
                </div>
            </div>

            {validationReport && (
                <div className="rounded-xl border border-white/10 glass-panel p-4 shadow-lg shadow-black/20">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Cálculos correctos vs incorrectos</p>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {validationReport.checks.slice(0, 10).map((c) => {
                            const ok = c.failedRows === 0;
                            return (
                                <div key={c.id} className={cn('rounded-lg border p-2 text-xs transition-colors', ok ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-100 shadow-[0_0_5px_rgba(52,211,153,0.1)]' : 'border-amber-500/30 bg-amber-950/40 text-amber-100 shadow-[0_0_5px_rgba(251,191,36,0.1)]')}>
                                    <p className="font-semibold text-white drop-shadow-sm">{c.label}</p>
                                    <p className="opacity-80">Correctos {c.passedRows} · Incorrectos {c.failedRows}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {matrices.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {matrices.map((m, i) => (
                        <button key={i} onClick={() => { setSheet(i); setPage(0); }} className={cn('rounded-md px-3 py-1 text-xs transition-all', sheet === i ? 'bg-violet-600 text-white shadow-[0_0_10px_rgba(139,92,246,0.5)]' : 'bg-black/30 text-slate-400 border border-white/10 hover:bg-white/5')}>
                            {m.sheetName ?? `Hoja ${i + 1}`}
                        </button>
                    ))}
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-white/10 shadow-xl shadow-black/30 glass-panel custom-scrollbar">
                <table className="w-full text-xs">
                    <thead className="bg-black/40 text-slate-300 backdrop-blur-md">
                        <tr>
                            <th className="px-2 py-2 text-left font-semibold">#</th>
                            {headers.map((h, i) => <th key={i} className="px-2 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {pageRows.map(({ row, i }) => (
                            <tr key={i} className={cn('transition-colors hover:bg-white/5 text-slate-200', isBadRow(row) && 'bg-amber-950/20')}>
                                <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                                {headers.map((_, ci) => {
                                    const v = getVal(matrices, corr, sheet, i, ci);
                                    const isEdit = editing?.ri === i && editing?.ci === ci;
                                    const changed = corr.some((x) => x.sheetIndex === sheet && x.rowIndex === i && x.colIndex === ci);
                                    const wilKey = `${sheet}-${i}-${ci}`;
                                    const wilCorr = wilCorrByCell.get(wilKey);
                                    const wilDecision = wilDecisions[wilKey];
                                    const hasWilPending = wilCorr && !wilDecision;
                                    return (
                                        <td key={ci} className={cn('px-1 py-1 whitespace-nowrap relative', changed && 'bg-blue-900/40 text-blue-100', hasWilPending && 'bg-violet-900/20')}>
                                            {isEdit ? (
                                                <input
                                                    autoFocus
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={commitEdit}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') commitEdit();
                                                        if (e.key === 'Escape') setEditing(null);
                                                    }}
                                                    className="w-full rounded border border-blue-500 bg-black/50 text-white shadow-inner focus:ring-1 focus:ring-blue-500 focus:outline-none px-1 py-0.5"
                                                />
                                            ) : (
                                                <div>
                                                    <button
                                                        className="w-full text-left p-1 rounded hover:bg-white/10 transition-colors"
                                                        onClick={() => {
                                                            setEditing({ ri: i, ci });
                                                            setEditValue(String(v ?? ''));
                                                        }}
                                                    >
                                                        <div className="flex items-center justify-between gap-1">
                                                            <span>{formatValue(v, targetByCol.get(ci))}</span>
                                                            {matrices[sheet]?.formulas?.[i]?.[ci] && (
                                                                <span title={`Fórmula original: ${matrices[sheet].formulas![i][ci]}`}>
                                                                    <Calculator className="w-3 h-3 text-violet-400 drop-shadow-[0_0_2px_rgba(139,92,246,0.8)] flex-shrink-0" />
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                    {/* Wil correction suggestion (Req 6.4) */}
                                                    {hasWilPending && (
                                                        <div className="mt-1 rounded border border-violet-500/40 bg-violet-950/50 p-1.5 text-[10px]">
                                                            <div className="flex items-center gap-1 text-violet-300 mb-1">
                                                                <Sparkles className="w-3 h-3" />
                                                                <span className="font-semibold">Wil sugiere: {formatValue(wilCorr.suggestedValue, targetByCol.get(ci))}</span>
                                                            </div>
                                                            {wilCorr.formula && (
                                                                <p className="text-violet-400/80 mb-1">{wilCorr.formula}</p>
                                                            )}
                                                            <div className="flex gap-1">
                                                                <button
                                                                    onClick={() => acceptWilCorrection(wilCorr)}
                                                                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300 hover:bg-emerald-800/60 transition-colors border border-emerald-500/30"
                                                                    title="Aceptar corrección"
                                                                >
                                                                    <Check className="w-3 h-3" /> Aceptar
                                                                </button>
                                                                <button
                                                                    onClick={() => rejectWilCorrection(wilCorr)}
                                                                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-900/50 text-red-300 hover:bg-red-800/60 transition-colors border border-red-500/30"
                                                                    title="Rechazar corrección"
                                                                >
                                                                    <X className="w-3 h-3" /> Rechazar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {wilDecision === 'accepted' && (
                                                        <span className="text-[9px] text-emerald-400 flex items-center gap-0.5 mt-0.5"><Check className="w-2.5 h-2.5" /> Aceptada</span>
                                                    )}
                                                    {wilDecision === 'rejected' && (
                                                        <span className="text-[9px] text-red-400 flex items-center gap-0.5 mt-0.5"><X className="w-2.5 h-2.5" /> Rechazada</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} className="hover:text-white transition-colors">Anterior</button>
                <span>Página {page + 1} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="hover:text-white transition-colors">Siguiente</button>
            </div>

            {
                corr.length > 0 && (
                    <div className="rounded-xl border border-blue-500/30 glass-panel bg-blue-950/30 p-4 shadow-inner">
                        <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-blue-300">Correcciones ({corr.length})</h4>
                            <button onClick={() => setAllCorr([])} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Deshacer todo</button>
                        </div>
                        <div className="max-h-40 space-y-1 overflow-y-auto text-xs text-slate-300 custom-scrollbar pr-2">
                            {corr.slice(0, 30).map((c, i) => (
                                <div key={i} className="border-b border-white/5 pb-1">
                                    {`Fila ${c.rowIndex + 1} - ${matrices[c.sheetIndex]?.headers[c.colIndex] ?? `Col ${c.colIndex + 1}`} - ${String(c.originalValue)} -> `}
                                    <strong className="text-blue-200">{String(c.newValue)}</strong> <span className="text-slate-500">({c.source})</span>
                                </div>
                            ))}
                            {corr.length > 30 && <div className="pt-1 text-slate-500 italic">...y {corr.length - 30} más</div>}
                        </div>
                    </div>
                )
            }
        </div>
    );

}
