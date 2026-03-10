'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileCheck2, AlertTriangle, CheckCircle2, Building2, CalendarClock, ListChecks, Trash2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { cn } from '@/lib/utils';
import { summarizeActions } from '@/lib/payroll/actions';

interface PayrollReport {
    id: string;
    company_name: string | null;
    company_nit: string | null;
    country_code: string;
    period_year: number;
    period_month: number;
    rule_label: string | null;
    certification_ready: boolean;
    file_count: number;
    mapped_fields: string[];
    created_fields: string[];
    missing_required_fields: string[];
    missing_required_calculations: string[];
    sheet_summary: Array<{ fileName: string; sheetName: string; rowCount: number; headerCount: number }>;
    detected_variables: string[];
    concept_summary?: {
        totalVariables?: number;
        byCategory?: Record<string, number>;
        unknownVariables?: string[];
    };
    risk_report?: {
        score?: number;
        level?: 'low' | 'medium' | 'high';
        factors?: Array<{ name: string; points: number; detail: string }>;
    };
    employee_risk_summary?: {
        employeesAnalyzed?: number;
        employeesWithRisk?: number;
        averageScore?: number;
        maxScore?: number;
        topEmployees?: Array<{
            document: string;
            name: string;
            score: number;
            findings: string[];
        }>;
    };
    calculation_validation_report?: {
        countryCode?: string;
        year?: number;
        rowsAnalyzed?: number;
        rowsWithFindings?: number;
        criticalFindings?: number;
        checks?: Array<{
            id: string;
            label: string;
            passedRows: number;
            failedRows: number;
            sampleFindings: string[];
        }>;
        coverage?: {
            totalHeaders?: number;
            mappedHeaders?: number;
            unmappedHeaders?: string[];
            createdFieldsMapped?: string[];
        };
    };
    ai_validation_report?: any;
    created_at: string;
}

interface CheckResult {
    id: string;
    label: string;
    passedRows: number;
    failedRows: number;
    sampleFindings: string[];
    missingDependencies?: string[];
    potentialMatches?: Record<string, string>;
}

export default function ReportsPage() {
    const t = useTranslations('Reports');
    const [rows, setRows] = useState<PayrollReport[]>([]);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [actions, setActions] = useState<Array<{ id: string; status: 'open' | 'assigned' | 'resolved'; employee_name: string; title: string; priority: 'high' | 'medium' | 'low'; assigned_to: string | null }>>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/payrolls');
                const data = await res.json();
                if (res.ok && Array.isArray(data.payrolls)) {
                    setRows(data.payrolls);
                }
            } catch (error) {
                console.error('Failed to load payroll reports:', error);
            }
        };
        void load();
    }, []);

    const latest = rows[0];

    useEffect(() => {
        const loadActions = async () => {
            if (!latest?.id) {
                setActions([]);
                return;
            }
            try {
                const res = await fetch(`/api/actions?payrollId=${latest.id}`);
                const data = await res.json();
                if (res.ok && Array.isArray(data.actions)) {
                    setActions(data.actions);
                }
            } catch (error) {
                console.error('Failed to load actions queue:', error);
            }
        };
        void loadActions();
    }, [latest?.id]);

    const findNameInMatrices = (doc: string, report: PayrollReport) => {
        const aiReport = report.ai_validation_report as any;
        if (!aiReport?.sourceMatrices) return 'Sin nombre';
        const normDoc = String(doc).trim();
        for (const m of aiReport.sourceMatrices) {
            const docColIdx = m.headers.findIndex((h: string) =>
                ['documento', 'cedula', 'id', 'document', 'doc'].includes(h.toLowerCase().trim())
            );
            const nameColIdx = m.headers.findIndex((h: string) =>
                ['nombre', 'empleado', 'name', 'employee'].includes(h.toLowerCase().trim())
            );

            if (docColIdx >= 0 && nameColIdx >= 0) {
                const foundRow = (m.rows as any[]).find(row => String(row[docColIdx] ?? '').trim() === normDoc);
                if (foundRow && foundRow[nameColIdx]) return String(foundRow[nameColIdx]);
            }
        }
        return 'Sin nombre';
    };

    const summary = useMemo(() => {
        const total = rows.length;
        const certifiable = rows.filter((r) => r.certification_ready).length;
        const nonCertifiable = total - certifiable;
        const missingFields = rows.reduce((acc, r) => acc + (r.missing_required_fields?.length ?? 0), 0);
        const missingCalcs = rows.reduce((acc, r) => acc + (r.missing_required_calculations?.length ?? 0), 0);
        return { total, certifiable, nonCertifiable, missingFields, missingCalcs };
    }, [rows]);

    const actionsOverview = useMemo(() => {
        const top = latest?.employee_risk_summary?.topEmployees ?? [];
        return summarizeActions(
            top.map((emp) => ({
                employee: `${emp.name} (${emp.document})`,
                findings: emp.findings ?? [],
            }))
        );
    }, [latest]);

    const handleDeletePayroll = async (id: string) => {
        if (!window.confirm('¿Eliminar esta planilla? Esta acción no se puede deshacer.')) return;
        setDeletingId(id);
        try {
            const res = await fetch(`/api/payrolls?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setRows((prev) => prev.filter((r) => r.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete payroll:', error);
        } finally {
            setDeletingId(null);
        }
    };

    const actionsQueue = useMemo(
        () => ({
            total: actions.length,
            open: actions.filter((a) => a.status === 'open').length,
            assigned: actions.filter((a) => a.status === 'assigned').length,
            resolved: actions.filter((a) => a.status === 'resolved').length,
        }),
        [actions]
    );

    return (
        <div className="space-y-5 pb-16">
            <div>
                <h1 className="text-xl font-bold text-slate-900 inline-flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-violet" />
                    {t('title')}
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">{t('subtitle')}</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('payrollCount')}</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{summary.total}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('certifiableCount')}</p>
                    <p className="text-2xl font-black text-emerald-600 mt-1">{summary.certifiable}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('criticalFailures')}</p>
                    <p className="text-2xl font-black text-rose-600 mt-1">{summary.nonCertifiable}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('openQueue')}</p>
                    <p className="text-2xl font-black text-amber-600 mt-1">{actionsQueue.open + actionsQueue.assigned}</p>
                </div>
            </div>

            {latest ? (
                <>
                    <Card className="border-indigo-100 shadow-indigo-100/20 shadow-lg">
                        <CardHeader className="bg-indigo-50/30">
                            <CardTitle className="text-base flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <ListChecks className="w-4 h-4 text-indigo-600" />
                                    {t('generalDetail')}: {latest.company_name}
                                </div>
                                <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter', latest.certification_ready ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                                    {latest.certification_ready ? `✓ ${t('certifiable')}` : `✗ ${t('notCertifiable')}`}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identificación</p>
                                    <p className="text-sm font-semibold text-slate-700">{latest.company_name} <span className="text-slate-400 font-normal">({latest.company_nit})</span></p>
                                    <p className="text-xs text-slate-500">{latest.period_month}/{latest.period_year} · {latest.country_code}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Riesgo Global</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-slate-900">{latest.risk_report?.score ?? 0}<span className="text-sm font-normal text-slate-400">/100</span></span>
                                        <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded border', (latest.risk_report?.level ?? 'low') === 'high' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100')}>
                                            Nivel {latest.risk_report?.level ?? 'bajo'}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('coverage')}</p>
                                    <p className="text-sm font-semibold text-slate-700">{latest.detected_variables?.length ?? 0} Variables</p>
                                    <p className="text-xs text-slate-500">{latest.mapped_fields?.length ?? 0} Mapeadas · {latest.file_count} Archivos</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('detectedVariables')}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(latest.detected_variables ?? []).slice(0, 40).map((v) => (
                                        <span key={v} className="text-[10px] font-medium bg-slate-50 border border-slate-100 text-slate-600 rounded px-2 py-0.5">{v}</span>
                                    ))}
                                    {(latest.detected_variables?.length ?? 0) > 40 && <span className="text-[10px] text-slate-400">+{latest.detected_variables!.length - 40} más</span>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                                    <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Riesgo por Empleado</p>
                                    <div className="space-y-2">
                                        {(latest.employee_risk_summary?.topEmployees ?? []).slice(0, 5).map((emp) => {
                                            const realName = emp.name && emp.name !== 'Sin nombre' ? emp.name : findNameInMatrices(emp.document, latest);
                                            return (
                                                <div key={`${emp.document}-${emp.name}`} className="flex items-center justify-between text-xs p-2 bg-white border border-slate-100 rounded-lg">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 truncate max-w-[150px]">{realName}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">CC {emp.document}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-slate-500 italic max-w-[180px] truncate">{emp.findings[0]}</span>
                                                        <span className={cn('font-black min-w-[24px] text-right', emp.score > 30 ? 'text-rose-600' : 'text-slate-400')}>{emp.score}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {(!latest.employee_risk_summary?.topEmployees || latest.employee_risk_summary.topEmployees.length === 0) && (
                                            <p className="text-xs text-slate-400 italic text-center py-4">{t('noIndividualRisk')}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                                    <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Validación Matemática</p>
                                    <div className="space-y-2">
                                        {(latest.calculation_validation_report?.checks as CheckResult[] ?? []).slice(0, 8).map((check) => {
                                            const totalAnalyzed = check.passedRows + check.failedRows;
                                            const hasMissing = check.missingDependencies && check.missingDependencies.length > 0;
                                            return (
                                                <div key={check.id} className="text-xs p-2 bg-white border border-slate-100 rounded-lg">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-semibold text-slate-800 truncate max-w-[200px]">{check.label}</span>
                                                        <span className={cn('text-[10px] font-bold uppercase', check.failedRows > 0 ? 'text-rose-600' : hasMissing ? 'text-amber-600' : 'text-emerald-600')}>
                                                            {check.failedRows > 0 ? `${check.failedRows} fallas` : hasMissing ? 'Incompleto' : 'Perfecto'}
                                                        </span>
                                                    </div>
                                                    {totalAnalyzed > 0 ? (
                                                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden flex">
                                                            <div className="bg-emerald-500 h-full" style={{ width: `${(check.passedRows / totalAnalyzed) * 100}%` }} />
                                                            <div className="bg-rose-500 h-full" style={{ width: `${(check.failedRows / totalAnalyzed) * 100}%` }} />
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] text-amber-600 font-medium italic flex items-center gap-1">
                                                                <AlertTriangle className="w-3 h-3" /> {t('missingMapping')}: {check.missingDependencies?.join(', ')}
                                                            </p>
                                                            {check.potentialMatches && Object.keys(check.potentialMatches).length > 0 && (
                                                                <p className="text-[9px] text-slate-400 bg-slate-50 p-1 rounded border border-dashed border-slate-200">
                                                                    Sugerencia: {Object.entries(check.potentialMatches).map(([t, h]) => `${h} → ${t}`).join(' | ')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <Card>
                    <CardContent className="py-20 text-center text-slate-400 text-sm">
                        <FileCheck2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        {t('noSavedReports')}
                    </CardContent>
                </Card>
            )}

            <Card className="border-slate-200">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-slate-500" />
                        {t('auditLog')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="font-bold py-4">Fecha</TableHead>
                                <TableHead className="font-bold">Empresa</TableHead>
                                <TableHead className="font-bold">Periodo</TableHead>
                                <TableHead className="text-center font-bold">Riesgo</TableHead>
                                <TableHead className="font-bold">Estado</TableHead>
                                <TableHead className="text-right font-bold pr-6">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-slate-400 py-12">
                                        No hay registros.
                                    </TableCell>
                                </TableRow>
                            )}
                            {rows.map((r) => {
                                const isDeleting = deletingId === r.id;
                                return (
                                    <TableRow key={r.id} className={cn('group transition-colors', isDeleting && 'opacity-50')}>
                                        <TableCell className="py-4 text-xs font-medium text-slate-600">
                                            {new Date(r.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-900">{r.company_name}</span>
                                                <span className="text-[10px] text-slate-400">{r.company_nit}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-600">{String(r.period_month).padStart(2, '0')}/{r.period_year}</TableCell>
                                        <TableCell className="text-center">
                                            <span className={cn('text-xs font-black', (r.risk_report?.score ?? 0) > 30 ? 'text-rose-600' : 'text-slate-600')}>
                                                {r.risk_report?.score ?? 0}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', r.certification_ready ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                                                {r.certification_ready ? 'Certificable' : 'Faltantes'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <button
                                                onClick={() => void handleDeletePayroll(r.id)}
                                                disabled={isDeleting}
                                                className="p-2 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
