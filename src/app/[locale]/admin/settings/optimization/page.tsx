'use client';

/**
 * Configuración de Optimización IA.
 *
 * Permite al administrador configurar la estrategia de optimización
 * costo/calidad del orquestador inteligente: seleccionar estrategia,
 * ajustar pesos, umbral mínimo de calidad y auto-routing.
 *
 * Consume GET/PUT `/api/admin/optimization-config`.
 *
 * Ruta: `/[locale]/admin/settings/optimization`
 * Acceso: Solo rol `admin` (protegido por middleware).
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Settings2,
  Scale,
  Gauge,
  ToggleLeft,
  ToggleRight,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
  DollarSign,
  Star,
  Route,
  Plus,
  Trash2,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────

interface OptimizationConfig {
  id: string;
  strategy: 'cost-first' | 'quality-first' | 'balanced';
  cost_weight: number;
  quality_weight: number;
  max_cost_per_task_usd: number;
  min_quality_threshold: number;
  enable_auto_routing: boolean;
  updated_at: string;
}

type Strategy = OptimizationConfig['strategy'];

const STRATEGIES: { value: Strategy; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    value: 'cost-first',
    label: 'Costo Primero',
    description: 'Prioriza modelos económicos. Ideal para tareas simples y alto volumen.',
    icon: DollarSign,
  },
  {
    value: 'balanced',
    label: 'Balanceado',
    description: 'Equilibrio entre costo y calidad. Recomendado para uso general.',
    icon: Scale,
  },
  {
    value: 'quality-first',
    label: 'Calidad Primero',
    description: 'Prioriza modelos premium. Ideal para tareas complejas y críticas.',
    icon: Star,
  },
];

// ── Routing Rule Types & Constants ──────────────────────────────────

interface ModelRoutingRule {
  id: string;
  task_type: string;
  agent_name: string;
  complexity_level: 'simple' | 'moderate' | 'complex';
  preferred_provider_type: string;
  preferred_model_id: string;
  max_cost_per_1k_tokens: number;
  min_quality_score: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const TASK_TYPES = ['chat', 'map', 'validate', 'correct', 'full-analysis'] as const;
const AGENT_NAMES = ['master', 'auditor', 'writer', 'corrector', 'mapper', 'payroll-expert', 'researcher'] as const;
const COMPLEXITY_LEVELS = ['simple', 'moderate', 'complex'] as const;

const EMPTY_RULE_FORM = {
  task_type: 'chat' as string,
  agent_name: 'master' as string,
  complexity_level: 'simple' as string,
  preferred_provider_type: '',
  preferred_model_id: '',
  max_cost_per_1k_tokens: 0.01,
  min_quality_score: 0.7,
};

// ── Page Component ──────────────────────────────────────────────────

export default function OptimizationConfigPage() {
  // ── State ─────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [strategy, setStrategy] = useState<Strategy>('balanced');
  const [costWeight, setCostWeight] = useState(0.5);
  const [qualityWeight, setQualityWeight] = useState(0.5);
  const [minQualityThreshold, setMinQualityThreshold] = useState(0.7);
  const [enableAutoRouting, setEnableAutoRouting] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // ── Routing rules state ───────────────────────────────────────────
  const [rules, setRules] = useState<ModelRoutingRule[]>([]);
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE_FORM);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [creatingRule, setCreatingRule] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [ruleSuccess, setRuleSuccess] = useState(false);

  // ── Fetch config on mount ───────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/optimization-config');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const cfg: OptimizationConfig = data.config;
      setStrategy(cfg.strategy);
      setCostWeight(cfg.cost_weight);
      setQualityWeight(cfg.quality_weight);
      setMinQualityThreshold(cfg.min_quality_threshold);
      setEnableAutoRouting(cfg.enable_auto_routing);
      setUpdatedAt(cfg.updated_at);
      setRules(data.rules ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // ── Linked weight sliders ───────────────────────────────────────

  const handleCostWeightChange = (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    setCostWeight(rounded);
    setQualityWeight(Math.round((1 - rounded) * 100) / 100);
  };

  const handleQualityWeightChange = (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    setQualityWeight(rounded);
    setCostWeight(Math.round((1 - rounded) * 100) / 100);
  };

  // ── Save handler ────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/admin/optimization-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy,
          cost_weight: costWeight,
          quality_weight: qualityWeight,
          min_quality_threshold: minQualityThreshold,
          enable_auto_routing: enableAutoRouting,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }

      const data = await res.json();
      setUpdatedAt(data.config?.updated_at ?? new Date().toISOString());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // ── Rule CRUD handlers ─────────────────────────────────────────

  const handleCreateRule = async () => {
    setCreatingRule(true);
    setRuleError(null);
    setRuleSuccess(false);
    try {
      const res = await fetch('/api/admin/optimization-config/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setRules((prev) => [data.rule, ...prev]);
      setRuleForm(EMPTY_RULE_FORM);
      setShowRuleForm(false);
      setRuleSuccess(true);
      setTimeout(() => setRuleSuccess(false), 3000);
    } catch (e) {
      setRuleError(e instanceof Error ? e.message : 'Error al crear regla');
    } finally {
      setCreatingRule(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    setDeletingRuleId(id);
    setRuleError(null);
    try {
      const res = await fetch(`/api/admin/optimization-config/rules/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setRuleError(e instanceof Error ? e.message : 'Error al eliminar regla');
    } finally {
      setDeletingRuleId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-violet" />
        <span className="ml-3 text-slate-400">Cargando configuración…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-violet" />
          <h1 className="text-2xl font-semibold text-white">Configuración de Optimización</h1>
        </div>
        {updatedAt && (
          <span className="text-xs text-slate-500">
            Última actualización: {new Date(updatedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Strategy Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            Estrategia de Optimización
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {STRATEGIES.map((s) => {
              const isActive = strategy === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStrategy(s.value)}
                  className={`rounded-xl p-4 text-left transition-all duration-200 border ${
                    isActive
                      ? 'border-violet bg-violet/10 shadow-[0_0_15px_rgba(124,58,237,0.2)]'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                  aria-pressed={isActive}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <s.icon className={`h-4 w-4 ${isActive ? 'text-violet-light' : 'text-slate-400'}`} />
                    <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-slate-300'}`}>
                      {s.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{s.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Weight Sliders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Scale className="h-4 w-4 text-cyan" />
            Pesos de Costo y Calidad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-xs text-slate-400">
            Los pesos determinan la importancia relativa del costo y la calidad al seleccionar modelos.
            La suma siempre debe ser 1.0.
          </p>

          {/* Cost Weight */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="cost-weight" className="text-sm text-slate-300 flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-emerald" />
                Peso de Costo
              </label>
              <span className="text-sm font-mono text-white bg-white/10 px-2 py-0.5 rounded">
                {(costWeight * 100).toFixed(0)}%
              </span>
            </div>
            <input
              id="cost-weight"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={costWeight}
              onChange={(e) => handleCostWeightChange(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-emerald bg-white/10"
              aria-label="Peso de costo"
            />
          </div>

          {/* Quality Weight */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="quality-weight" className="text-sm text-slate-300 flex items-center gap-2">
                <Star className="h-3.5 w-3.5 text-amber-400" />
                Peso de Calidad
              </label>
              <span className="text-sm font-mono text-white bg-white/10 px-2 py-0.5 rounded">
                {(qualityWeight * 100).toFixed(0)}%
              </span>
            </div>
            <input
              id="quality-weight"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={qualityWeight}
              onChange={(e) => handleQualityWeightChange(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-amber-400 bg-white/10"
              aria-label="Peso de calidad"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Scale className="h-3 w-3" />
            <span>Suma: {((costWeight + qualityWeight) * 100).toFixed(0)}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Quality Threshold + Auto-Routing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Min Quality Threshold */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4 text-rose-light" />
              Umbral Mínimo de Calidad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-400">
              Los modelos con calidad inferior a este umbral serán descartados (excepto en fallback).
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="quality-threshold" className="text-sm text-slate-300">
                  Umbral
                </label>
                <span className="text-sm font-mono text-white bg-white/10 px-2 py-0.5 rounded">
                  {minQualityThreshold.toFixed(2)}
                </span>
              </div>
              <input
                id="quality-threshold"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={minQualityThreshold}
                onChange={(e) => setMinQualityThreshold(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-rose-400 bg-white/10"
                aria-label="Umbral mínimo de calidad"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>0.0 (sin filtro)</span>
                <span>1.0 (máximo)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto-Routing Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              {enableAutoRouting ? (
                <ToggleRight className="h-4 w-4 text-emerald" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-slate-400" />
              )}
              Auto-Routing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-400">
              Cuando está habilitado, el orquestador usa las reglas de enrutamiento para asignar
              modelos preferidos por tipo de tarea, agente y complejidad.
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={enableAutoRouting}
              onClick={() => setEnableAutoRouting(!enableAutoRouting)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 ${
                enableAutoRouting ? 'bg-emerald' : 'bg-white/20'
              }`}
              aria-label="Habilitar auto-routing"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                  enableAutoRouting ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <p className="text-sm text-slate-300">
              {enableAutoRouting ? 'Habilitado' : 'Deshabilitado'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Feedback + Save */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {error && (
            <>
              <AlertCircle className="h-4 w-4 text-rose" />
              <span className="text-sm text-rose">{error}</span>
            </>
          )}
          {success && (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald" />
              <span className="text-sm text-emerald">Configuración guardada correctamente</span>
            </>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? 'Guardando…' : 'Guardar Configuración'}
        </Button>
      </div>

      {/* ── Routing Rules Section ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Route className="h-4 w-4 text-violet-light" />
              Reglas de Enrutamiento
            </CardTitle>
            <Button
              size="sm"
              variant={showRuleForm ? 'ghost' : 'outline'}
              onClick={() => {
                setShowRuleForm(!showRuleForm);
                setRuleError(null);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {showRuleForm ? 'Cancelar' : 'Nueva Regla'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rule feedback */}
          {ruleError && (
            <div className="flex items-center gap-2 text-sm text-rose">
              <AlertCircle className="h-4 w-4" />
              {ruleError}
            </div>
          )}
          {ruleSuccess && (
            <div className="flex items-center gap-2 text-sm text-emerald">
              <CheckCircle2 className="h-4 w-4" />
              Regla creada correctamente
            </div>
          )}

          {/* New rule form */}
          {showRuleForm && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* task_type */}
                <div className="space-y-1">
                  <label htmlFor="rule-task-type" className="text-xs text-slate-400">Tipo de Tarea</label>
                  <select
                    id="rule-task-type"
                    value={ruleForm.task_type}
                    onChange={(e) => setRuleForm({ ...ruleForm, task_type: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet/40"
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t} className="bg-navy text-white">{t}</option>
                    ))}
                  </select>
                </div>
                {/* agent_name */}
                <div className="space-y-1">
                  <label htmlFor="rule-agent-name" className="text-xs text-slate-400">Agente</label>
                  <select
                    id="rule-agent-name"
                    value={ruleForm.agent_name}
                    onChange={(e) => setRuleForm({ ...ruleForm, agent_name: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet/40"
                  >
                    {AGENT_NAMES.map((a) => (
                      <option key={a} value={a} className="bg-navy text-white">{a}</option>
                    ))}
                  </select>
                </div>
                {/* complexity_level */}
                <div className="space-y-1">
                  <label htmlFor="rule-complexity" className="text-xs text-slate-400">Complejidad</label>
                  <select
                    id="rule-complexity"
                    value={ruleForm.complexity_level}
                    onChange={(e) => setRuleForm({ ...ruleForm, complexity_level: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet/40"
                  >
                    {COMPLEXITY_LEVELS.map((c) => (
                      <option key={c} value={c} className="bg-navy text-white">{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* preferred_provider_type */}
                <div className="space-y-1">
                  <label htmlFor="rule-provider" className="text-xs text-slate-400">Proveedor Preferido</label>
                  <input
                    id="rule-provider"
                    type="text"
                    placeholder="ej. openai, anthropic"
                    value={ruleForm.preferred_provider_type}
                    onChange={(e) => setRuleForm({ ...ruleForm, preferred_provider_type: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet/40"
                  />
                </div>
                {/* preferred_model_id */}
                <div className="space-y-1">
                  <label htmlFor="rule-model" className="text-xs text-slate-400">Modelo Preferido</label>
                  <input
                    id="rule-model"
                    type="text"
                    placeholder="ej. gpt-4o-mini, claude-3-haiku"
                    value={ruleForm.preferred_model_id}
                    onChange={(e) => setRuleForm({ ...ruleForm, preferred_model_id: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* max_cost_per_1k_tokens */}
                <div className="space-y-1">
                  <label htmlFor="rule-max-cost" className="text-xs text-slate-400">Costo Máx. por 1K Tokens (USD)</label>
                  <input
                    id="rule-max-cost"
                    type="number"
                    step={0.001}
                    min={0}
                    value={ruleForm.max_cost_per_1k_tokens}
                    onChange={(e) => setRuleForm({ ...ruleForm, max_cost_per_1k_tokens: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet/40"
                  />
                </div>
                {/* min_quality_score */}
                <div className="space-y-1">
                  <label htmlFor="rule-min-quality" className="text-xs text-slate-400">Calidad Mínima (0–1)</label>
                  <input
                    id="rule-min-quality"
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={ruleForm.min_quality_score}
                    onChange={(e) => setRuleForm({ ...ruleForm, min_quality_score: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet/40"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleCreateRule}
                  disabled={creatingRule || !ruleForm.preferred_provider_type || !ruleForm.preferred_model_id}
                >
                  {creatingRule ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 mr-1" />
                  )}
                  {creatingRule ? 'Creando…' : 'Crear Regla'}
                </Button>
              </div>
            </div>
          )}

          {/* Rules table */}
          {rules.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              No hay reglas de enrutamiento configuradas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="pb-2 pr-3 text-xs font-medium text-slate-400">Tipo Tarea</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-slate-400">Agente</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-slate-400">Complejidad</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-slate-400">Proveedor / Modelo</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-slate-400">Calidad Mín.</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-slate-400">Estado</th>
                    <th className="pb-2 text-xs font-medium text-slate-400">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2.5 pr-3 text-slate-300">{rule.task_type}</td>
                      <td className="py-2.5 pr-3 text-slate-300">{rule.agent_name}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            rule.complexity_level === 'simple'
                              ? 'bg-emerald/20 text-emerald'
                              : rule.complexity_level === 'moderate'
                              ? 'bg-amber-400/20 text-amber-400'
                              : 'bg-rose/20 text-rose'
                          }`}
                        >
                          {rule.complexity_level}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-300">
                        <span className="text-slate-400">{rule.preferred_provider_type}</span>
                        {' / '}
                        <span className="text-white">{rule.preferred_model_id}</span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-slate-300">
                        {rule.min_quality_score.toFixed(2)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            rule.is_active
                              ? 'bg-emerald/20 text-emerald'
                              : 'bg-slate-500/20 text-slate-400'
                          }`}
                        >
                          {rule.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteRule(rule.id)}
                          disabled={deletingRuleId === rule.id}
                          aria-label={`Eliminar regla ${rule.task_type} ${rule.agent_name} ${rule.complexity_level}`}
                        >
                          {deletingRuleId === rule.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-rose/70 hover:text-rose" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
