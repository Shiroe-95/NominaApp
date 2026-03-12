'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Brain, CheckCircle2, FileSpreadsheet, ShieldCheck, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { cn } from '@/lib/utils';
import { buildSuggestedActions, summarizeActions } from '@/lib/payroll/actions';
import LivePayrollWorkbench from '@/components/ui/LivePayrollWorkbench';
import { createClient } from '@/lib/supabase/client';

interface RuleApiRow {
    country_code: string;
    rule_year: number;
    label: string;
    required_fields: string[];
    required_calculations: string[];
    checks: string[];
}

interface PayrollReview {
    id: string;
    company_name: string | null;
    country_code: string;
    period_year: number;
    period_month: number;
    rule_label: string | null;
    certification_ready: boolean;
    mapped_fields: string[];
    created_fields: string[];
    missing_required_fields: string[];
    missing_required_calculations: string[];
    mapping_relations?: Array<{
        source: string;
        target: string;
        analysisCategory: 'identity' | 'salary_base' | 'non_salary' | 'ibc' | 'contribution' | 'contract' | 'informational';
        isCreated: boolean;
        requiredByRule: boolean;
    }>;
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
        rowsAnalyzed?: number;
        rowsWithFindings?: number;
        criticalFindings?: number;
        checks?: Array<{
            id: string;
            label: string;
            passedRows: number;
            failedRows: number;
            sampleFindings: string[];
            missingDependencies?: string[];
            potentialMatches?: Record<string, string>;
        }>;
    };
    ai_validation_report?: {
        summary?: string;
        overallRisk?: 'high' | 'medium' | 'low';
        narrativeAnalysis?: string;
        rowsAnalyzed?: number;
        batchesProcessed?: number;
        findings?: Array<{
            severity: 'high' | 'medium' | 'low';
            category: string;
            description: string;
            affectedEmployees: string[];
            recommendation: string;
        }>;
        employeeFindings?: Array<{
            document: string;
            name: string;
            issues: Array<{
                description: string;
                severity: 'high' | 'medium' | 'low';
                rule: string;
            }>;
        }>;
        sourceMatrices?: Array<{
            headers: string[];
            rows: unknown[][];
            fileName?: string;
            sheetName?: string;
        }>;
    };
    created_at: string;
}

interface ActionItem {
    id: string;
    payroll_id: string;
    employee_document: string;
    employee_name: string;
    priority: 'high' | 'medium' | 'low';
    area: string;
    title: string;
    description: string;
    recommended_fix: string;
    status: 'open' | 'assigned' | 'resolved';
    assigned_to: string | null;
    resolution_note: string | null;
}

function actionKey(employeeDocument: string, title: string) {
    return `${employeeDocument}::${title}`;
}

export default function ReconcilePage() {
    const t = useTranslations('Reconcile');
    const [rows, setRows] = useState<PayrollReview[]>([]);
    const [actionItems, setActionItems] = useState<ActionItem[]>([]);
    const [assignee, setAssignee] = useState('');
    const [isSavingAction, setIsSavingAction] = useState(false);
    const [allRules, setAllRules] = useState<RuleApiRow[]>([]);
    const [aiEmployeeFilter, setAiEmployeeFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
    const [aiEmployeeSearch, setAiEmployeeSearch] = useState('');

    // Pre-fill assignee with authenticated user
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user?.email) {
                setAssignee(data.user.email.split('@')[0]);
            } else {
                setAssignee('Analista Nómina');
            }
        });
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const [payrollsRes, rulesRes] = await Promise.all([fetch('/api/payrolls'), fetch('/api/rules')]);
                const payrollsData = await payrollsRes.json();
                if (payrollsRes.ok && Array.isArray(payrollsData.payrolls)) setRows(payrollsData.payrolls);
                const rulesData = await rulesRes.json();
                if (rulesRes.ok && Array.isArray(rulesData.rules)) setAllRules(rulesData.rules);
            } catch (error) {
                console.error('Failed to load data:', error);
            }
        };
        void load();
    }, []);

    const latest = rows[0];

    useEffect(() => {
        const loadActions = async () => {
            if (!latest?.id) {
                setActionItems([]);
                return;
            }
            try {
                const res = await fetch(`/api/actions?payrollId=${latest.id}`);
                const data = await res.json();
                if (res.ok && Array.isArray(data.actions)) {
                    setActionItems(data.actions);
                }
            } catch (error) {
                console.error('Failed to load actions:', error);
            }
        };
        void loadActions();
    }, [latest?.id]);

    const actionsMap = useMemo(() => {
        const map = new Map<string, ActionItem>();
        for (const item of actionItems) {
            map.set(actionKey(item.employee_document, item.title), item);
        }
        return map;
    }, [actionItems]);

    const sheetRowsTotal = useMemo(
        () => (latest?.sheet_summary ?? []).reduce((acc, s) => acc + (s.rowCount || 0), 0),
        [latest]
    );

    const employeeRiskItems = useMemo(() => {
        const fromEngine = (latest?.employee_risk_summary?.topEmployees ?? []).map((emp) => ({
            document: emp.document,
            name: emp.name,
            score: emp.score,
            findings: emp.findings ?? [],
        }));

        const fromAi = (latest?.ai_validation_report?.employeeFindings ?? []).map((emp) => {
            const findings = emp.issues.map((issue) => issue.description);
            const score = emp.issues.reduce((acc, issue) => {
                if (issue.severity === 'high') return acc + 40;
                if (issue.severity === 'medium') return acc + 20;
                return acc + 10;
            }, 0);
            return {
                document: emp.document,
                name: emp.name,
                score,
                findings,
            };
        });

        // Merge and deduplicate by document
        const merged = [...fromEngine];
        for (const ai of fromAi) {
            if (!merged.find(e => e.document === ai.document)) {
                merged.push(ai);
            }
        }

        return merged.sort((a, b) => b.score - a.score);
    }, [latest]);

    const employeeRiskSummaryComputed = useMemo(() => {
        const analyzed =
            latest?.employee_risk_summary?.employeesAnalyzed ??
            latest?.ai_validation_report?.rowsAnalyzed ??
            0;
        const withRisk =
            latest?.employee_risk_summary?.employeesWithRisk ??
            employeeRiskItems.filter((item) => item.findings.length > 0).length;
        return { analyzed, withRisk };
    }, [latest, employeeRiskItems]);

    const matchingRule = useMemo(
        () => allRules.find((r) => r.country_code === latest?.country_code && r.rule_year === latest?.period_year),
        [allRules, latest]
    );

    const upsertAction = async (params: {
        employeeDocument: string;
        employeeName: string;
        priority: 'high' | 'medium' | 'low';
        area: string;
        title: string;
        description: string;
        recommendedFix: string;
        assignedTo?: string;
    }) => {
        if (!latest?.id) return;
        setIsSavingAction(true);
        try {
            const res = await fetch('/api/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payrollId: latest.id,
                    ...params,
                    assignedTo: params.assignedTo ?? null,
                }),
            });
            const data = await res.json();
            if (res.ok && data.action) {
                setActionItems((prev) => {
                    const filtered = prev.filter((x) => x.id !== data.action.id && !(x.employee_document === data.action.employee_document && x.title === data.action.title));
                    return [data.action, ...filtered];
                });
            }
        } catch (error) {
            console.error('Failed to save action:', error);
        } finally {
            setIsSavingAction(false);
        }
    };

    const patchAction = async (id: string, payload: { status?: string; assignedTo?: string; resolutionNote?: string }) => {
        setIsSavingAction(true);
        try {
            const res = await fetch(`/api/actions/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok && data.action) {
                setActionItems((prev) => prev.map((x) => (x.id === data.action.id ? data.action : x)));
            }
        } catch (error) {
            console.error('Failed to update action:', error);
        } finally {
            setIsSavingAction(false);
        }
    };

    const findNameInMatrices = (doc: string) => {
        if (!latest?.ai_validation_report?.sourceMatrices) return t('noName');
        const normDoc = String(doc).trim();
        for (const m of latest.ai_validation_report.sourceMatrices) {
            const docColIdx = m.headers.findIndex(h =>
                ['documento', 'cedula', 'id', 'document', 'doc'].includes(h.toLowerCase().trim())
            );
            const nameColIdx = m.headers.findIndex(h =>
                ['nombre', 'empleado', 'name', 'employee'].includes(h.toLowerCase().trim())
            );

            if (docColIdx >= 0 && nameColIdx >= 0) {
                const foundRow = m.rows.find(row => String(row[docColIdx] ?? '').trim() === normDoc);
                if (foundRow && foundRow[nameColIdx]) return String(foundRow[nameColIdx]);
            }
        }
        return t('noName');
    };

    const StatusBadge = ({ status }: { status?: string }) => {
        switch (status) {
            case 'resolved':
                return <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-mono"><CheckCircle2 className="w-3 h-3" /> {t('resolved')}</span>;
            case 'assigned':
                return <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-mono">{t('assigned')}</span>;
            default:
                return <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 italic font-mono uppercase">{t('suggested')}</span>;
        }
    };

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">{t('reviewTitle')}</h1>
                <p className="text-sm text-slate-400 mt-0.5">{t('reviewSubtitle')}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">{t('step1Title')}</p>
                    <p className="mt-1 text-sm text-slate-600 leading-snug">{t('step1Description')}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">{t('step2Title')}</p>
                    <p className="mt-1 text-sm text-slate-600 leading-snug">{t('step2Description')}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">{t('step3Title')}</p>
                    <p className="mt-1 text-sm text-slate-600 leading-snug">{t('step3Description')}</p>
                </div>
            </div>

            <LivePayrollWorkbench
                payrollId={latest?.id ?? null}
                defaultCountry={latest?.country_code ?? 'CO'}
                defaultYear={latest?.period_year ?? new Date().getFullYear()}
                existingMatrices={latest?.ai_validation_report?.sourceMatrices ?? null}
                existingRelations={latest?.mapping_relations ?? null}
                existingAiReport={(latest?.ai_validation_report as any) ?? null}
            />

            {!latest ? (
                <Card>
                    <CardContent className="py-12 text-center text-slate-400 text-sm">
                        {t('noReviewLoaded')} <strong className="text-slate-600">{t('uploadPayroll')}</strong>.
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card><CardHeader className="pb-1"><CardTitle className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t('company')}</CardTitle></CardHeader><CardContent className="font-semibold text-slate-900 text-sm">{latest.company_name ?? t('noCompany')}</CardContent></Card>
                        <Card><CardHeader className="pb-1"><CardTitle className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t('period')}</CardTitle></CardHeader><CardContent className="font-semibold text-slate-900 text-sm">{latest.period_month}/{latest.period_year}</CardContent></Card>
                        <Card><CardHeader className="pb-1"><CardTitle className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t('records')}</CardTitle></CardHeader><CardContent className="font-semibold text-slate-900 text-sm">{sheetRowsTotal.toLocaleString('es-CO')}</CardContent></Card>
                        <Card><CardHeader className="pb-1"><CardTitle className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t('compliance')}</CardTitle></CardHeader><CardContent className={cn('font-semibold text-sm', latest.certification_ready ? 'text-emerald-600' : 'text-rose-600')}>{latest.risk_report?.score ?? 0}/100 · {latest.certification_ready ? t('certifiable') : t('missing')}</CardContent></Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                                    {t('normativePanel')} — {matchingRule?.label ?? latest.rule_label ?? `${latest.country_code} ${latest.period_year}`}
                                </CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('requiredFields')}</p>
                                    <div className="space-y-1">
                                        {(matchingRule?.required_fields ?? []).map((field) => {
                                            const missing = (latest.missing_required_fields ?? []).includes(field);
                                            return (
                                                <div key={field} className="flex items-center gap-1.5 text-xs">
                                                    {missing ? <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                                                    <span className={missing ? 'text-rose-700 font-medium' : 'text-slate-600'}>{field}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('requiredCalculations')}</p>
                                    <div className="space-y-1">
                                        {(matchingRule?.required_calculations ?? []).map((calc) => {
                                            const missing = (latest.missing_required_calculations ?? []).includes(calc);
                                            return (
                                                <div key={calc} className="flex items-center gap-1.5 text-xs">
                                                    {missing ? <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                                                    <span className={missing ? 'text-rose-700 font-medium' : 'text-slate-600'}>{calc}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-indigo-100 shadow-indigo-100/10 shadow-lg">
                        <CardHeader className="bg-indigo-50/50 pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Brain className="w-5 h-5 text-indigo-600" />
                                    {t('riskByEmployee')}
                                </CardTitle>
                                {isSavingAction && <div className="text-[10px] text-indigo-600 animate-pulse font-bold uppercase tracking-widest">{t('synchronizing')}</div>}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex flex-wrap gap-x-8 gap-y-3 items-center">
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('totalAnalyzed')}</span>
                                    <span className="text-sm font-bold text-slate-900">{employeeRiskSummaryComputed.analyzed}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('findingsCount')}</span>
                                    <span className="text-sm font-bold text-rose-600">{employeeRiskSummaryComputed.withRisk}</span>
                                </div>
                                <div className="ml-auto flex items-center gap-3">
                                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">{t('assignAutomaticallyTo')}:</span>
                                    <input
                                        value={assignee}
                                        onChange={(e) => setAssignee(e.target.value)}
                                        className="h-8 w-48 rounded-md border border-slate-200 px-3 text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none"
                                        placeholder={t('assigneePlaceholder')}
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader className="bg-slate-50/80">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[180px] font-bold text-slate-700 py-4">{t('employee')}</TableHead>
                                            <TableHead className="w-[80px] text-center font-bold text-slate-700">{t('risk')}</TableHead>
                                            <TableHead className="font-bold text-slate-700">{t('mainFindingAndSuggestedAction')}</TableHead>
                                            <TableHead className="w-[120px] text-center font-bold text-slate-700">{t('status')}</TableHead>
                                            <TableHead className="w-[160px] text-right font-bold text-slate-700 pr-4">{t('management')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {employeeRiskItems.slice(0, 15).map((emp) => {
                                            const firstAction = buildSuggestedActions(emp.findings ?? [])[0];
                                            const title = firstAction?.title ?? t('manualReviewRequired');
                                            const existing = actionsMap.get(actionKey(emp.document, title));
                                            const realName = emp.name && emp.name !== t('noName') ? emp.name : findNameInMatrices(emp.document);

                                            return (
                                                <TableRow key={`${emp.document}-${emp.name}`} className="group hover:bg-slate-50/40 transition-colors">
                                                    <TableCell className="py-4">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold text-slate-900 text-xs truncate max-w-[170px]" title={realName}>{realName}</span>
                                                            <span className="text-[10px] text-slate-400 font-mono tracking-tight">CC {emp.document}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className={cn(
                                                            "inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-extrabold",
                                                            emp.score > 30 ? "bg-rose-100 text-rose-700 border border-rose-200" :
                                                                emp.score > 15 ? "bg-amber-50 text-amber-700 border border-amber-100" :
                                                                    "bg-slate-50 text-slate-600 border border-slate-100"
                                                        )}>
                                                            {emp.score}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1 max-w-[500px]">
                                                            <span className="text-xs font-semibold text-slate-800 leading-snug">{emp.findings[0] ?? t('noFindingsDetected')}</span>
                                                            {firstAction && (
                                                                <div className="flex items-start gap-1 p-1.5 bg-indigo-50/30 rounded border border-indigo-50/50">
                                                                    <div className="shrink-0 mt-0.5 text-indigo-500 font-bold text-[10px]">✨</div>
                                                                    <span className="text-[10px] text-indigo-700 leading-tight">
                                                                        <span className="font-bold opacity-75">{t('suggestion')}:</span> {firstAction.recommendedFix}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <StatusBadge status={existing?.status} />
                                                    </TableCell>
                                                    <TableCell className="text-right pr-4">
                                                        {!existing ? (
                                                            <button
                                                                disabled={isSavingAction}
                                                                className="inline-flex items-center justify-center h-8 gap-1.5 text-[11px] px-4 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                                onClick={() => {
                                                                    if (!firstAction) return;
                                                                    void upsertAction({
                                                                        employeeDocument: emp.document,
                                                                        employeeName: realName,
                                                                        priority: firstAction.priority,
                                                                        area: firstAction.area,
                                                                        title: firstAction.title,
                                                                        description: firstAction.description,
                                                                        recommendedFix: firstAction.recommendedFix,
                                                                        assignedTo: assignee,
                                                                    });
                                                                }}
                                                            >
                                                                {t('assignTo')} {assignee.split(' ')[0]}
                                                            </button>
                                                        ) : existing.status === 'assigned' ? (
                                                            <button
                                                                disabled={isSavingAction}
                                                                className="inline-flex items-center justify-center h-8 gap-1.5 text-[11px] px-4 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                                onClick={() => {
                                                                    void patchAction(existing.id, { status: 'resolved', resolutionNote: 'Resuelto desde tablero de reconciliación' });
                                                                }}
                                                            >
                                                                <CheckCircle2 className="w-3.5 h-3.5" /> {t('resolve')}
                                                            </button>
                                                        ) : (
                                                            <div className="inline-flex items-center gap-1.5 text-emerald-600 font-black text-[10px] uppercase bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                                                <CheckCircle2 className="w-3 h-3" /> {t('completed')}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {employeeRiskItems.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="py-12 text-center text-slate-400">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <ShieldCheck className="w-8 h-8 opacity-20" />
                                                        <span className="text-sm font-medium">{t('noFindingsDetected')}</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader><CardTitle className="text-base">{t('coverageTitle')}</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <p>{t('detectedVariablesSmall')}: <strong>{latest.detected_variables?.length ?? 0}</strong></p>
                                <p>{t('mappedFields')}: <strong>{latest.mapped_fields?.length ?? 0}</strong></p>
                                <p>{t('createdFields')}: <strong>{latest.created_fields?.length ?? 0}</strong></p>
                                <p>{t('classifiedCategories')}: <strong>{Object.keys(latest.concept_summary?.byCategory ?? {}).length}</strong></p>
                                <div className="flex flex-wrap gap-2">
                                    {(latest.detected_variables ?? []).slice(0, 25).map((v) => (
                                        <span key={v} className="text-xs bg-slate-100 border border-slate-200 px-2 py-1 rounded-full">{v}</span>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(latest.concept_summary?.byCategory ?? {}).map(([k, v]) => (
                                        <span key={k} className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{k}: {v}</span>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-base">{t('normativeObservations')}</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {(latest.missing_required_fields?.length ?? 0) > 0 ? (
                                    <div>
                                        <p className="font-medium text-amber-700 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {t('missingRequiredFields')}</p>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {latest.missing_required_fields.map((f) => (
                                                <span key={f} className="text-xs bg-amber-100 border border-amber-300 text-amber-800 px-2 py-1 rounded-full">{f}</span>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {t('missingRequiredFields')} completos.</p>
                                )}

                                {(latest.missing_required_calculations?.length ?? 0) > 0 ? (
                                    <div>
                                        <p className="font-medium text-amber-700 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {t('missingRequiredCalculations')}</p>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {latest.missing_required_calculations.map((f) => (
                                                <span key={f} className="text-xs bg-amber-100 border border-amber-300 text-amber-800 px-2 py-1 rounded-full">{f}</span>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {t('missingRequiredCalculations')} completos.</p>
                                )}
                                {(latest.risk_report?.factors?.length ?? 0) > 0 && (
                                    <div>
                                        <p className="font-medium text-slate-700">{t('riskFactors')}:</p>
                                        <ul className="space-y-1 mt-1">
                                            {(latest.risk_report?.factors ?? []).map((f) => (
                                                <li key={`${f.name}-${f.detail}`} className="text-xs text-slate-600">
                                                    <strong>{f.name}</strong> (+{f.points}): {f.detail}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium text-slate-700">{t('mathematicalValidation')}</p>
                                    <p className="text-xs text-slate-600">
                                        Filas: {latest.calculation_validation_report?.rowsAnalyzed ?? 0} | Hallazgos: {latest.calculation_validation_report?.rowsWithFindings ?? 0} | Criticos: {latest.calculation_validation_report?.criticalFindings ?? 0}
                                    </p>
                                    <div className="mt-2 space-y-2">
                                        {(latest.calculation_validation_report?.checks ?? []).slice(0, 8).map((check) => {
                                            const hasMissing = check.missingDependencies && check.missingDependencies.length > 0;
                                            return (
                                                <div key={check.id} className="text-xs border-l-2 border-slate-100 pl-2 py-1">
                                                    <p className="font-semibold text-slate-700">{check.label}</p>
                                                    {hasMissing ? (
                                                        <div className="text-amber-600 space-y-0.5">
                                                            <p className="flex items-center gap-1 font-medium"><AlertTriangle className="w-3 h-3" /> Faltan campos: {check.missingDependencies!.join(', ')}</p>
                                                            {check.potentialMatches && Object.keys(check.potentialMatches).length > 0 && (
                                                                <p className="text-[10px] text-slate-400 bg-slate-50 p-1 rounded border border-dashed border-slate-100 mt-1">
                                                                    Sugerencia: {Object.entries(check.potentialMatches).map(([t, h]) => `${h} → ${t}`).join(', ')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-slate-500">Correctos: {check.passedRows} | Fallas: {check.failedRows}</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-slate-500" /> {t('processedSheets')}</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-700">Archivo</TableHead>
                                        <TableHead className="font-bold text-slate-700">Hoja</TableHead>
                                        <TableHead className="text-right font-bold text-slate-700">Filas</TableHead>
                                        <TableHead className="text-right font-bold text-slate-700">Variables</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(latest.sheet_summary ?? []).map((s, idx) => (
                                        <TableRow key={`${s.fileName}-${s.sheetName}-${idx}`}>
                                            <TableCell className="text-xs font-semibold text-slate-600">{s.fileName}</TableCell>
                                            <TableCell className="text-xs text-slate-500">{s.sheetName}</TableCell>
                                            <TableCell className="text-right text-xs font-mono">{s.rowCount.toLocaleString('es-CO')}</TableCell>
                                            <TableCell className="text-right text-xs font-mono">{s.headerCount}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            )
            }
        </div >
    );
}
