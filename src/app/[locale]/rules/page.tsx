'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Pencil, Trash2, Save, X, ShieldCheck, Info, FileCheck2, Calculator, ClipboardList, CheckCircle2, XCircle, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface AuditEntryRow {
    id: string;
    action: string;
    origin: string;
    created_at: string;
    user_id?: string;
}

interface RuleRow {
    id?: string;
    country_code: string;
    rule_year: number;
    label: string;
    required_fields: string[];
    required_calculations: string[];
    checks: string[];
    status?: 'active' | 'pending_review' | 'draft' | 'approved' | 'rejected';
}

const EMPTY_RULE: RuleRow = {
    country_code: 'CO',
    rule_year: new Date().getFullYear(),
    label: '',
    required_fields: [],
    required_calculations: [],
    checks: [],
};

function arrayToText(arr: string[]) {
    return arr.join('\n');
}

function textToArray(text: string): string[] {
    return text
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
}

export default function RulesPage() {
    const [rules, setRules] = useState<RuleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [filterCountry, setFilterCountry] = useState<string>('todos');
    const [filterYear, setFilterYear] = useState<string>('todos');
    const [showHelp, setShowHelp] = useState(false);
    const [approvingKey, setApprovingKey] = useState<string | null>(null);
    const [rejectingKey, setRejectingKey] = useState<string | null>(null);
    const [auditKey, setAuditKey] = useState<string | null>(null);
    const [auditEntries, setAuditEntries] = useState<AuditEntryRow[]>([]);

    // Draft state for editing/creating
    const [draft, setDraft] = useState<RuleRow & { fieldsText: string; calculationsText: string; checksText: string }>({
        ...EMPTY_RULE,
        fieldsText: '',
        calculationsText: '',
        checksText: '',
    });

    const ruleKey = (r: RuleRow) => `${r.country_code}-${r.rule_year}`;

    useEffect(() => {
        void loadRules();
    }, []);

    const loadRules = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/rules');
            const data = await res.json();
            if (res.ok && Array.isArray(data.rules)) {
                setRules(data.rules);
            }
        } catch (err) {
            console.error('Error cargando reglas:', err);
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (rule: RuleRow) => {
        setIsCreating(false);
        setEditingKey(ruleKey(rule));
        setExpandedKey(ruleKey(rule));
        setDraft({
            ...rule,
            fieldsText: arrayToText(rule.required_fields),
            calculationsText: arrayToText(rule.required_calculations),
            checksText: arrayToText(rule.checks),
        });
    };

    const startCreate = () => {
        setEditingKey(null);
        setIsCreating(true);
        setExpandedKey('__new__');
        setDraft({
            ...EMPTY_RULE,
            rule_year: new Date().getFullYear(),
            fieldsText: '',
            calculationsText: '',
            checksText: '',
        });
    };

    const cancelEdit = () => {
        setEditingKey(null);
        setIsCreating(false);
    };

    const saveRule = async () => {
        if (!draft.label.trim() || !draft.country_code.trim()) return;
        setSaving(true);
        try {
            const payload = {
                countryCode: draft.country_code.trim().toUpperCase(),
                ruleYear: Number(draft.rule_year),
                label: draft.label.trim(),
                requiredFields: textToArray(draft.fieldsText),
                requiredCalculations: textToArray(draft.calculationsText),
                checks: textToArray(draft.checksText),
            };
            const res = await fetch('/api/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                await loadRules();
                cancelEdit();
            }
        } catch (err) {
            console.error('Error guardando regla:', err);
        } finally {
            setSaving(false);
        }
    };

    const deleteRule = async (rule: RuleRow) => {
        const key = ruleKey(rule);
        setDeleting(key);
        try {
            const res = await fetch(
                `/api/rules?countryCode=${encodeURIComponent(rule.country_code)}&ruleYear=${rule.rule_year}`,
                { method: 'DELETE' }
            );
            if (res.ok) {
                setRules((prev) => prev.filter((r) => ruleKey(r) !== key));
                if (expandedKey === key) setExpandedKey(null);
                if (editingKey === key) setEditingKey(null);
            }
        } catch (err) {
            console.error('Error eliminando regla:', err);
        } finally {
            setDeleting(null);
        }
    };

    const countries = ['todos', ...Array.from(new Set(rules.map((r) => r.country_code))).sort()];
    const years = ['todos', ...Array.from(new Set(rules.map((r) => String(r.rule_year)))).sort()];
    const filtered = rules.filter((r) => {
        if (filterCountry !== 'todos' && r.country_code !== filterCountry) return false;
        if (filterYear !== 'todos' && String(r.rule_year) !== filterYear) return false;
        return true;
    });

    const approveRule = async (rule: RuleRow) => {
        if (!rule.id) return;
        const key = ruleKey(rule);
        setApprovingKey(key);
        try {
            const res = await fetch(`/api/admin/rules/${rule.id}/approve`, { method: 'PATCH' });
            if (res.ok) await loadRules();
        } catch (err) {
            console.error('Error aprobando regla:', err);
        } finally {
            setApprovingKey(null);
        }
    };

    const rejectRule = async (rule: RuleRow) => {
        if (!rule.id) return;
        const key = ruleKey(rule);
        setRejectingKey(key);
        try {
            const res = await fetch(`/api/admin/rules/${rule.id}/reject`, { method: 'PATCH' });
            if (res.ok) await loadRules();
        } catch (err) {
            console.error('Error rechazando regla:', err);
        } finally {
            setRejectingKey(null);
        }
    };

    const toggleAudit = async (rule: RuleRow) => {
        if (!rule.id) return;
        const key = ruleKey(rule);
        if (auditKey === key) {
            setAuditKey(null);
            setAuditEntries([]);
            return;
        }
        setAuditKey(key);
        try {
            const res = await fetch(`/api/audit/${rule.id}`);
            const data = await res.json();
            if (res.ok && Array.isArray(data.history)) {
                setAuditEntries(data.history);
            } else {
                setAuditEntries([]);
            }
        } catch (err) {
            console.error('Error cargando auditoría:', err);
            setAuditEntries([]);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Reglas de Validación Normativa</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Configura las reglas por país y año que se aplican al analizar cada nómina cargada.
                    </p>
                </div>
                <Button onClick={startCreate} disabled={isCreating}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Nueva regla
                </Button>
            </div>

            {/* Help panel */}
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 overflow-hidden">
                <button
                    onClick={() => setShowHelp((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-indigo-100/60 transition-colors text-left"
                >
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <span className="text-sm font-semibold text-indigo-800">¿Cómo funcionan las reglas de validación?</span>
                    </div>
                    {showHelp ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-indigo-400" />}
                </button>

                {showHelp && (
                    <div className="border-t border-indigo-200 px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 font-semibold text-indigo-800">
                                <FileCheck2 className="w-4 h-4 text-indigo-500" />
                                Campos requeridos
                            </div>
                            <p className="text-indigo-700 text-xs leading-relaxed">
                                Son las <strong>columnas de datos</strong> que deben existir en el archivo de nómina para que pueda ser analizado. Si falta alguno, la planilla no puede certificarse.
                            </p>
                            <p className="text-indigo-600 text-xs bg-indigo-100 rounded-lg px-2 py-1.5">
                                Ejemplos: <code className="font-mono">document_number</code>, <code className="font-mono">base_salary</code>, <code className="font-mono">worked_days</code>
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 font-semibold text-indigo-800">
                                <Calculator className="w-4 h-4 text-indigo-500" />
                                Cálculos requeridos
                            </div>
                            <p className="text-indigo-700 text-xs leading-relaxed">
                                Son los <strong>resultados de cálculo</strong> que deben aparecer en la nómina para validar que los aportes están bien liquidados. El sistema verifica que los valores sean correctos.
                            </p>
                            <p className="text-indigo-600 text-xs bg-indigo-100 rounded-lg px-2 py-1.5">
                                Ejemplos: <code className="font-mono">ibc_total</code> (base de aportes), <code className="font-mono">ibc_salud</code>, <code className="font-mono">ibc_pension</code>
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 font-semibold text-indigo-800">
                                <ClipboardList className="w-4 h-4 text-indigo-500" />
                                Verificaciones normativas
                            </div>
                            <p className="text-indigo-700 text-xs leading-relaxed">
                                Son las <strong>reglas legales vigentes</strong> del país y año (SMMLV, topes, porcentajes, recargos). El sistema usa estas reglas para detectar inconsistencias y generar hallazgos.
                            </p>
                            <p className="text-indigo-600 text-xs bg-indigo-100 rounded-lg px-2 py-1.5">
                                Ejemplos: SMMLV 2026, límite Ley 1393, porcentaje salud empleador
                            </p>
                        </div>
                        <div className="md:col-span-3 border-t border-indigo-200 pt-3 text-xs text-indigo-600 flex items-start gap-2">
                            <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                            <span>Al cargar una nómina, el sistema selecciona automáticamente la regla del país y año elegidos, verifica los campos y cálculos presentes, y aplica las verificaciones normativas para generar el reporte de riesgo y el plan de acción.</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Country filter */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">País:</span>
                {countries.map((c) => (
                    <button
                        key={c}
                        onClick={() => setFilterCountry(c)}
                        className={cn(
                            'px-3 py-1 text-xs font-semibold rounded-full border transition-colors',
                            filterCountry === c
                                ? 'bg-violet text-white border-violet'
                                : 'bg-white text-slate-600 border-slate-300 hover:border-violet hover:text-violet'
                        )}
                    >
                        {c === 'todos' ? 'Todos los países' : c}
                    </button>
                ))}
            </div>

            {/* Year filter */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Año:</span>
                {years.map((y) => (
                    <button
                        key={y}
                        onClick={() => setFilterYear(y)}
                        className={cn(
                            'px-3 py-1 text-xs font-semibold rounded-full border transition-colors',
                            filterYear === y
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-500 hover:text-indigo-600'
                        )}
                    >
                        {y === 'todos' ? 'Todos los años' : y}
                    </button>
                ))}
            </div>

            {/* Create new rule form */}
            {isCreating && (
                <Card className="border-violet/30 bg-violet/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Plus className="w-4 h-4 text-violet" />
                            Nueva regla normativa
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RuleForm
                            draft={draft}
                            setDraft={setDraft}
                            onSave={saveRule}
                            onCancel={cancelEdit}
                            saving={saving}
                            isNew
                        />
                    </CardContent>
                </Card>
            )}

            {/* Rules list */}
            {loading ? (
                <Card>
                    <CardContent className="py-12 text-center text-slate-400 text-sm">
                        Cargando reglas...
                    </CardContent>
                </Card>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-slate-400 text-sm">
                        No hay reglas configuradas para este país. Crea la primera con el botón superior.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map((rule) => {
                        const key = ruleKey(rule);
                        const isExpanded = expandedKey === key;
                        const isEditing = editingKey === key;
                        const isDeleting = deleting === key;

                        return (
                            <Card key={key} className={cn(isEditing && 'border-violet/40 bg-violet/5')}>
                                <CardHeader className="pb-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <button
                                            onClick={() => setExpandedKey(isExpanded ? null : key)}
                                            className="flex items-center gap-2 flex-1 text-left"
                                        >
                                            <ShieldCheck className={cn('w-4 h-4 shrink-0', isEditing ? 'text-violet' : 'text-indigo-500')} />
                                            <span className="font-semibold text-slate-800 text-sm">{rule.label}</span>
                                            {rule.status === 'active' && (
                                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">Activa</span>
                                            )}
                                            {rule.status === 'approved' && (
                                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">Aprobada</span>
                                            )}
                                            {rule.status === 'pending_review' && (
                                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">Pendiente de revisión</span>
                                            )}
                                            {rule.status === 'draft' && (
                                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">Borrador</span>
                                            )}
                                            {rule.status === 'rejected' && (
                                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700">Rechazada</span>
                                            )}
                                            <span className="text-xs text-slate-400 font-mono">{rule.country_code} {rule.rule_year}</span>
                                            <span className="text-xs text-slate-400 ml-auto mr-2">
                                                {rule.checks.length} verificaciones · {rule.required_fields.length} campos · {rule.required_calculations.length} cálculos
                                            </span>
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {rule.status === 'pending_review' && rule.id && (
                                                <>
                                                    <button
                                                        onClick={() => void approveRule(rule)}
                                                        disabled={approvingKey === key}
                                                        className="p-1.5 rounded hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors disabled:opacity-50"
                                                        title="Aprobar"
                                                    >
                                                        {approvingKey === key ? (
                                                            <span className="w-4 h-4 block border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => void rejectRule(rule)}
                                                        disabled={rejectingKey === key}
                                                        className="p-1.5 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors disabled:opacity-50"
                                                        title="Rechazar"
                                                    >
                                                        {rejectingKey === key ? (
                                                            <span className="w-4 h-4 block border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <XCircle className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </>
                                            )}
                                            {rule.id && (
                                                <button
                                                    onClick={() => void toggleAudit(rule)}
                                                    className={cn(
                                                        'p-1.5 rounded transition-colors',
                                                        auditKey === key
                                                            ? 'bg-indigo-50 text-indigo-600'
                                                            : 'hover:bg-slate-100 text-slate-500 hover:text-indigo-600'
                                                    )}
                                                    title="Auditoría"
                                                >
                                                    <History className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => (isEditing ? cancelEdit() : startEdit(rule))}
                                                className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-violet transition-colors"
                                                title="Editar"
                                            >
                                                {isEditing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => void deleteRule(rule)}
                                                disabled={isDeleting}
                                                className="p-1.5 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors disabled:opacity-50"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </CardHeader>

                                {isExpanded && (
                                    <CardContent className="pt-4 space-y-4">
                                        {isEditing ? (
                                            <RuleForm
                                                draft={draft}
                                                setDraft={setDraft}
                                                onSave={saveRule}
                                                onCancel={cancelEdit}
                                                saving={saving}
                                                isNew={false}
                                            />
                                        ) : (
                                            <RuleView rule={rule} />
                                        )}
                                    </CardContent>
                                )}

                                {auditKey === key && (
                                    <CardContent className="pt-2 pb-4">
                                        <div className="border border-indigo-200 rounded-lg overflow-hidden">
                                            <div className="px-3 py-2 bg-indigo-50 flex items-center gap-2">
                                                <History className="w-3.5 h-3.5 text-indigo-500" />
                                                <span className="text-xs font-semibold text-indigo-800">Historial de auditoría</span>
                                            </div>
                                            {auditEntries.length === 0 ? (
                                                <div className="px-3 py-4 text-center text-xs text-slate-400">
                                                    Sin registros de auditoría.
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-indigo-100">
                                                    {auditEntries.map((entry) => (
                                                        <div key={entry.id} className="px-3 py-2 flex items-center gap-3 text-xs">
                                                            <span className={cn(
                                                                'px-1.5 py-0.5 rounded font-semibold',
                                                                entry.action === 'approved' && 'bg-emerald-100 text-emerald-700',
                                                                entry.action === 'rejected' && 'bg-rose-100 text-rose-700',
                                                                entry.action === 'created' && 'bg-blue-100 text-blue-700',
                                                                entry.action === 'updated' && 'bg-amber-100 text-amber-700',
                                                                !['approved', 'rejected', 'created', 'updated'].includes(entry.action) && 'bg-slate-100 text-slate-600',
                                                            )}>
                                                                {entry.action}
                                                            </span>
                                                            <span className="text-slate-500">{entry.origin}</span>
                                                            <span className="text-slate-400 ml-auto">
                                                                {new Date(entry.created_at).toLocaleString('es')}
                                                            </span>
                                                            {entry.user_id && (
                                                                <span className="text-slate-400 font-mono text-[10px]" title={entry.user_id}>
                                                                    {entry.user_id.slice(0, 8)}…
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const FIELD_LABELS: Record<string, { label: string; desc: string }> = {
    document_number: { label: 'Número de documento', desc: 'Identifica al empleado. Permite agrupar hallazgos por persona.' },
    document_type: { label: 'Tipo de documento', desc: 'CC, CE, etc. Requerido para reportes regulatorios.' },
    first_name: { label: 'Nombre', desc: 'Nombre del empleado para los reportes y el plan de acción.' },
    last_name: { label: 'Apellido', desc: 'Apellido del empleado.' },
    base_salary: { label: 'Salario base', desc: 'Base para calcular el IBC, prestaciones y todos los aportes.' },
    non_salary_payments: { label: 'Pagos no salariales', desc: 'Bonos, viáticos, etc. El exceso sobre el 40% del total entra al IBC (Ley 1393).' },
    worked_days: { label: 'Días trabajados', desc: 'Define el IBC mínimo proporcional. Un empleado de tiempo parcial tiene un mínimo distinto.' },
    contributor_type: { label: 'Tipo de cotizante', desc: 'Determina qué tarifas y reglas aplican (empleado, independiente, pensionado, etc.).' },
    employee_id: { label: 'ID empleado', desc: 'Identificador interno. Usado para trazabilidad.' },
};

const CALC_LABELS: Record<string, { label: string; desc: string }> = {
    ibc_total: { label: 'IBC total', desc: 'Ingreso Base de Cotización. La base sobre la cual se calculan todos los aportes de seguridad social.' },
    ibc_salud: { label: 'IBC salud', desc: 'Debe ser igual al IBC total. Verifica que la cotización de salud esté sobre la misma base.' },
    ibc_pension: { label: 'IBC pensión', desc: 'Debe ser igual al IBC total. Verifica coherencia en la base de pensión.' },
    ibc_arl: { label: 'IBC ARL', desc: 'Debe ser igual al IBC total. Verifica coherencia en la base de riesgos laborales.' },
    tope_40_no_salarial: { label: 'Tope 40% no salarial (Ley 1393)', desc: 'El exceso de pagos no salariales sobre el 40% del total devengado que se suma al IBC.' },
    sbc: { label: 'Salario base de cotización (SBC)', desc: 'México: base para calcular cuotas IMSS.' },
    isr_retenido: { label: 'ISR retenido', desc: 'México: retención de impuesto sobre la renta del período.' },
};

interface MathCheck {
    id: string;
    label: string;
    formula: string;
    example?: string;
    severity: 'critical' | 'warning';
    needs: string[];
}

const MATH_CHECK_GROUPS: Array<{ group: string; color: string; desc: string; checks: MathCheck[] }> = [
    {
        group: 'IBC – Base de cotización',
        color: 'indigo',
        desc: 'Calcula y verifica la base sobre la cual se liquidan todos los aportes de seguridad social',
        checks: [
            {
                id: 'ibc_rule_1393',
                label: 'Ley 1393: pagos no salariales excesivos entran al IBC',
                formula: 'Si no_salarial > 40% × total → IBC = salario + (no_salarial − 40% × total)',
                example: 'Ej: $5M sal. + $4M no sal. → total $9M. Límite 40% = $3.6M. Exceso = $400k. IBC = $5.4M',
                severity: 'critical',
                needs: ['ibc_total', 'base_salary', 'non_salary_payments'],
            },
            {
                id: 'ibc_min_max',
                label: 'IBC dentro del rango legal: mín. 1 SMMLV proporcional, máx. 25 SMMLV',
                formula: 'SMMLV × (días / 30) ≤ IBC ≤ 25 × SMMLV',
                severity: 'critical',
                needs: ['ibc_total', 'worked_days'],
            },
            {
                id: 'ibc_consistency',
                label: 'IBC salud = IBC pensión = IBC ARL = IBC total',
                formula: 'Los 4 subsistemas deben cotizar sobre la misma base (tolerancia $100)',
                severity: 'warning',
                needs: ['ibc_total', 'ibc_salud', 'ibc_pension', 'ibc_arl'],
            },
            {
                id: 'tope_40_value',
                label: 'Campo tope_40 consistente con el exceso calculado',
                formula: 'tope_40 = MAX(0, no_salarial − 40% × total_devengado)',
                severity: 'warning',
                needs: ['tope_40_no_salarial', 'non_salary_payments'],
            },
        ],
    },
    {
        group: 'Aportes del empleado',
        color: 'violet',
        desc: 'Descuentos que se hacen al empleado en cada período',
        checks: [
            {
                id: 'health_4pct',
                label: 'Salud empleado = 4% del IBC',
                formula: 'descuento_salud = IBC × 4%',
                severity: 'critical',
                needs: ['ibc_total'],
            },
            {
                id: 'pension_4pct',
                label: 'Pensión empleado = 4% del IBC',
                formula: 'descuento_pension = IBC × 4%',
                severity: 'critical',
                needs: ['ibc_total'],
            },
        ],
    },
    {
        group: 'Aportes del empleador',
        color: 'blue',
        desc: 'Contribuciones que paga la empresa a la seguridad social de cada empleado',
        checks: [
            {
                id: 'salud_emp_8_5',
                label: 'Salud empleador = 8.5% del IBC',
                formula: 'salud_empleador = IBC × 8.5%',
                severity: 'critical',
                needs: ['ibc_total'],
            },
            {
                id: 'pension_emp_12',
                label: 'Pensión empleador = 12% del IBC',
                formula: 'pension_empleador = IBC × 12%',
                severity: 'critical',
                needs: ['ibc_total'],
            },
            {
                id: 'parafiscales_9',
                label: 'Parafiscales = 9% del IBC (SENA 2% + ICBF 3% + Caja 4%)',
                formula: 'parafiscales = IBC × 9%',
                severity: 'warning',
                needs: ['ibc_total'],
            },
            {
                id: 'arl_bounds',
                label: 'ARL entre 0.522% y 8.7% del IBC según clase de riesgo',
                formula: 'IBC × 0.522% ≤ ARL ≤ IBC × 8.7%',
                severity: 'warning',
                needs: ['ibc_total'],
            },
        ],
    },
    {
        group: 'Prestaciones sociales',
        color: 'emerald',
        desc: 'Provisiones que la empresa debe acumular mensualmente por ley laboral',
        checks: [
            {
                id: 'cesantias',
                label: 'Cesantías ≈ 8.33% del total devengado (Art. 249 CST)',
                formula: 'cesantias = devengado × 8.33%',
                severity: 'warning',
                needs: ['base_salary'],
            },
            {
                id: 'prima',
                label: 'Prima de servicios ≈ 8.33% del total devengado (Art. 306 CST)',
                formula: 'prima = devengado × 8.33%',
                severity: 'warning',
                needs: ['base_salary'],
            },
            {
                id: 'vacaciones',
                label: 'Vacaciones ≈ 4.17% del salario básico (Art. 186 CST)',
                formula: 'vacaciones = salario_base × 4.17%',
                severity: 'warning',
                needs: ['base_salary'],
            },
        ],
    },
    {
        group: 'Devengados',
        color: 'amber',
        desc: 'Validaciones sobre lo que el empleado recibe en el período',
        checks: [
            {
                id: 'transport',
                label: 'Auxilio de transporte solo aplica si salario ≤ 2 SMMLV',
                formula: 'Si salario > 2 × SMMLV y hay auxilio → hallazgo',
                severity: 'warning',
                needs: ['base_salary'],
            },
        ],
    },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', badge: 'bg-indigo-100 text-indigo-700' },
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', badge: 'bg-violet-100 text-violet-700' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
};

// Classify each normative check: does the math engine already verify it, or is it AI-only?
function classifyNormCheck(text: string): { type: 'motor'; motorLabel: string } | { type: 'ai' } {
    const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if ((t.includes('salud') && t.includes('empleado') && t.includes('4%')) ||
        (t.includes('salud') && t.includes('4% del ibc') && !t.includes('empleador')))
        return { type: 'motor', motorLabel: 'Motor: salud empleado = 4% IBC' };

    if ((t.includes('pension') && t.includes('empleado') && t.includes('4%')) ||
        (t.includes('pension') && t.includes('4% del ibc') && !t.includes('empleador')))
        return { type: 'motor', motorLabel: 'Motor: pensión empleado = 4% IBC' };

    if (t.includes('salud') && t.includes('empleador') && t.includes('8.5%'))
        return { type: 'motor', motorLabel: 'Motor: salud empleador = 8.5% IBC' };

    if (t.includes('pension') && t.includes('empleador') && t.includes('12%'))
        return { type: 'motor', motorLabel: 'Motor: pensión empleador = 12% IBC' };

    if ((t.includes('sena') || t.includes('icbf') || t.includes('caja de compensacion')) && (t.includes('2%') || t.includes('3%') || t.includes('4%')))
        return { type: 'motor', motorLabel: 'Motor: parafiscales 9% IBC (SENA + ICBF + Caja)' };

    if (t.includes('arl') && (t.includes('0.522%') || t.includes('8.7%')))
        return { type: 'motor', motorLabel: 'Motor: ARL entre 0.522% y 8.7% del IBC' };

    if (t.includes('ley 1393') || (t.includes('40%') && t.includes('no salarial')))
        return { type: 'motor', motorLabel: 'Motor: Ley 1393 — exceso no salarial en el IBC' };

    if (t.includes('ibc maximo') || (t.includes('25 smmlv') && t.includes('ibc')))
        return { type: 'motor', motorLabel: 'Motor: IBC máximo = 25 SMMLV' };

    if (t.includes('ibc minimo') || (t.includes('dias trabajados') && t.includes('smmlv') && t.includes('ibc')))
        return { type: 'motor', motorLabel: 'Motor: IBC mínimo proporcional por días trabajados' };

    if (t.includes('cesant') && t.includes('8.33%'))
        return { type: 'motor', motorLabel: 'Motor: cesantías ≈ 8.33% del devengado' };

    if (t.includes('prima') && t.includes('8.33%'))
        return { type: 'motor', motorLabel: 'Motor: prima ≈ 8.33% del devengado' };

    if (t.includes('vacaciones') && t.includes('4.17%'))
        return { type: 'motor', motorLabel: 'Motor: vacaciones ≈ 4.17% del salario básico' };

    if (t.includes('transporte') && (t.includes('2 smmlv') || t.includes('<= 2') || t.includes('no se incluye')))
        return { type: 'motor', motorLabel: 'Motor: auxilio de transporte — elegibilidad y exclusión del IBC' };

    return { type: 'ai' };
}

function NormativaTab({ checks, countryCode, year }: { checks: string[]; countryCode: string; year: number }) {
    const classified = checks.map((c) => ({ text: c, ...classifyNormCheck(c) }));
    const motorChecks = classified.filter((c) => c.type === 'motor');
    const aiChecks = classified.filter((c) => c.type === 'ai');

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>
                    De las <strong>{checks.length}</strong> reglas normativas para <strong>{countryCode} {year}</strong>:
                    {' '}<span className="text-emerald-700 font-semibold">{motorChecks.length} son verificadas matemáticamente por el motor</span>
                    {' '}(fórmulas exactas aplicadas fila por fila) y
                    {' '}<span className="text-violet-700 font-semibold">{aiChecks.length} son analizadas por la IA</span>
                    {' '}(recargos, situaciones con contexto o datos no siempre presentes).
                </span>
            </div>

            {/* Motor-validated rules */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Verificadas por el motor matemático ({motorChecks.length})</span>
                </div>
                <div className="space-y-1">
                    {motorChecks.map((c, i) => (
                        <div key={i} className="flex items-start gap-2.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <div className="flex items-center gap-1.5 mt-0.5 shrink-0">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="text-xs text-slate-700 leading-relaxed">{c.text}</span>
                                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">{c.type === 'motor' ? c.motorLabel : ''}</p>
                            </div>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">Motor</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* AI-analyzed rules */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-violet-700">Analizadas por IA ({aiChecks.length})</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                    Estas reglas dependen de columnas que no siempre están presentes (horas extra, recargos, tipo de cotizante, etc.) o requieren interpretación de contexto que el motor determinístico no puede resolver. La IA las revisa al encontrar los datos relevantes.
                </p>
                <div className="space-y-1">
                    {aiChecks.map((c, i) => (
                        <div key={i} className="flex items-start gap-2.5 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
                            <div className="flex items-center gap-1.5 mt-0.5 shrink-0">
                                <ShieldCheck className="w-3 h-3 text-violet-500" />
                            </div>
                            <span className="text-xs text-slate-700 leading-relaxed flex-1">{c.text}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 shrink-0 mt-0.5">IA</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function RuleView({ rule }: { rule: RuleRow }) {
    const [tab, setTab] = useState<'requisitos' | 'motor' | 'normativa'>('motor');

    // Count how many math checks each required field/calc feeds into
    const fieldUsageCount = (key: string) =>
        MATH_CHECK_GROUPS.flatMap((g) => g.checks).filter((c) => c.needs.includes(key)).length;

    // For motor tab: mark which checks are "enabled" based on required fields/calcs in the rule
    const allRequired = new Set([...rule.required_fields, ...rule.required_calculations]);
    const checkEnabled = (needs: string[]) => needs.every((n) => allRequired.has(n));

    const tabs = [
        { id: 'motor', label: 'Cómo valida el motor', icon: <Calculator className="w-3.5 h-3.5" /> },
        { id: 'requisitos', label: `Datos del archivo (${rule.required_fields.length + rule.required_calculations.length})`, icon: <FileCheck2 className="w-3.5 h-3.5" /> },
        { id: 'normativa', label: `Referencia legal (${rule.checks.length})`, icon: <ClipboardList className="w-3.5 h-3.5" /> },
    ] as const;

    return (
        <div className="space-y-3">
            {/* Context banner */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>
                    Esta regla se activa automáticamente al cargar una nómina con
                    <strong className="text-slate-800"> país = {rule.country_code}</strong> y
                    <strong className="text-slate-800"> año = {rule.rule_year}</strong>.
                    El motor matemático ejecuta <strong className="text-slate-800">{MATH_CHECK_GROUPS.reduce((a, g) => a + g.checks.length, 0)} verificaciones</strong> y
                    la IA analiza la normativa de referencia para detectar inconsistencias adicionales.
                </span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors',
                            tab === t.id
                                ? 'border-indigo-500 text-indigo-700'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        )}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab: motor de cálculo */}
            {tab === 'motor' && (
                <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                        Estas son las verificaciones matemáticas que el sistema ejecuta automáticamente al guardar la planilla. Las marcadas como
                        <span className="inline-flex items-center gap-0.5 mx-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700">crítico</span>
                        bloquean la certificación si fallan. Las
                        <span className="inline-flex items-center gap-0.5 mx-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">advertencia</span>
                        generan hallazgos en el plan de acción. Las verificaciones sin los datos requeridos se omiten.
                    </p>
                    {MATH_CHECK_GROUPS.map((group) => {
                        const colors = COLOR_MAP[group.color] ?? COLOR_MAP['indigo'];
                        return (
                            <div key={group.group} className={cn('rounded-xl border overflow-hidden', colors.border)}>
                                <div className={cn('px-4 py-2.5 flex items-center gap-2', colors.bg)}>
                                    <span className={cn('text-xs font-bold', colors.text)}>{group.group}</span>
                                    <span className="text-xs text-slate-500 font-normal">— {group.desc}</span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {group.checks.map((check) => {
                                        const enabled = checkEnabled(check.needs);
                                        return (
                                            <div key={check.id} className={cn('px-4 py-3 flex gap-3', !enabled && 'opacity-50')}>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className="text-xs font-semibold text-slate-800">{check.label}</span>
                                                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0', check.severity === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}>
                                                            {check.severity === 'critical' ? 'crítico' : 'advertencia'}
                                                        </span>
                                                        {!enabled && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">faltan datos</span>}
                                                    </div>
                                                    <code className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded block w-fit">{check.formula}</code>
                                                    {check.example && <p className="text-[11px] text-slate-500 mt-1">{check.example}</p>}
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {check.needs.map((n) => (
                                                            <span key={n} className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono', allRequired.has(n) ? colors.badge : 'bg-slate-100 text-slate-400')}>
                                                                {n}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Tab: datos del archivo */}
            {tab === 'requisitos' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <FileCheck2 className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Columnas de datos ({rule.required_fields.length})</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">El archivo debe incluir estas columnas. Si alguna falta después del mapeo, la planilla no se puede certificar.</p>
                        <div className="space-y-1.5">
                            {rule.required_fields.map((f) => {
                                const info = FIELD_LABELS[f];
                                const usage = fieldUsageCount(f);
                                return (
                                    <div key={f} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-slate-800">{info?.label ?? f}</span>
                                            {usage > 0 && <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">usada en {usage} checks</span>}
                                        </div>
                                        {info?.desc && <p className="text-[11px] text-slate-500 mt-0.5">{info.desc}</p>}
                                        <code className="text-[10px] text-slate-400 font-mono">{f}</code>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <Calculator className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Cálculos necesarios ({rule.required_calculations.length})</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">Columnas con resultados de cálculo que el motor necesita para validar los aportes. Si no están, las verificaciones correspondientes se omiten.</p>
                        <div className="space-y-1.5">
                            {rule.required_calculations.map((c) => {
                                const info = CALC_LABELS[c];
                                const usage = fieldUsageCount(c);
                                return (
                                    <div key={c} className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-indigo-900">{info?.label ?? c}</span>
                                            {usage > 0 && <span className="text-[10px] text-indigo-600 bg-white border border-indigo-200 px-1.5 py-0.5 rounded shrink-0">usada en {usage} checks</span>}
                                        </div>
                                        {info?.desc && <p className="text-[11px] text-indigo-700 mt-0.5">{info.desc}</p>}
                                        <code className="text-[10px] text-indigo-400 font-mono">{c}</code>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: referencia normativa */}
            {tab === 'normativa' && (
                <NormativaTab checks={rule.checks} countryCode={rule.country_code} year={rule.rule_year} />
            )}
        </div>
    );
}

interface DraftState {
    country_code: string;
    rule_year: number;
    label: string;
    fieldsText: string;
    calculationsText: string;
    checksText: string;
}

function RuleForm({
    draft,
    setDraft,
    onSave,
    onCancel,
    saving,
    isNew,
}: {
    draft: DraftState;
    setDraft: React.Dispatch<React.SetStateAction<DraftState & { required_fields: string[]; required_calculations: string[]; checks: string[] }>>;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
    isNew: boolean;
}) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">País *</label>
                    <input
                        value={draft.country_code}
                        onChange={(e) => setDraft((d) => ({ ...d, country_code: e.target.value.toUpperCase() }))}
                        disabled={!isNew}
                        maxLength={10}
                        placeholder="CO"
                        className="w-full h-9 px-3 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-400"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Año *</label>
                    <input
                        type="number"
                        value={draft.rule_year}
                        onChange={(e) => setDraft((d) => ({ ...d, rule_year: Number(e.target.value) }))}
                        disabled={!isNew}
                        className="w-full h-9 px-3 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-400"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Etiqueta *</label>
                    <input
                        value={draft.label}
                        onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                        placeholder="Ej: Normativa Colombia 2027"
                        className="w-full h-9 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Campos requeridos <span className="text-slate-400 normal-case font-normal">(uno por línea)</span>
                    </label>
                    <textarea
                        value={draft.fieldsText}
                        onChange={(e) => setDraft((d) => ({ ...d, fieldsText: e.target.value }))}
                        rows={8}
                        placeholder={'document_number\nfirst_name\nlast_name\nbase_salary'}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono resize-y"
                    />
                    <p className="text-[10px] text-slate-400">{textToArray(draft.fieldsText).length} campos</p>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Cálculos requeridos <span className="text-slate-400 normal-case font-normal">(uno por línea)</span>
                    </label>
                    <textarea
                        value={draft.calculationsText}
                        onChange={(e) => setDraft((d) => ({ ...d, calculationsText: e.target.value }))}
                        rows={8}
                        placeholder={'ibc_total\nibc_salud\nibc_pension'}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono resize-y"
                    />
                    <p className="text-[10px] text-slate-400">{textToArray(draft.calculationsText).length} cálculos</p>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Verificaciones normativas <span className="text-slate-400 normal-case font-normal">(una por línea)</span>
                    </label>
                    <textarea
                        value={draft.checksText}
                        onChange={(e) => setDraft((d) => ({ ...d, checksText: e.target.value }))}
                        rows={8}
                        placeholder={'SMMLV 2027: $X.XXX.XXX\nSalud empleado: 4% del IBC\nCesantías: 8.33% del devengado'}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg resize-y"
                    />
                    <p className="text-[10px] text-slate-400">{textToArray(draft.checksText).length} verificaciones</p>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onCancel} disabled={saving}>
                    <X className="w-4 h-4 mr-1" /> Cancelar
                </Button>
                <Button onClick={onSave} disabled={saving || !draft.label.trim()}>
                    <Save className="w-4 h-4 mr-1" /> {saving ? 'Guardando...' : 'Guardar regla'}
                </Button>
            </div>
        </div>
    );
}
