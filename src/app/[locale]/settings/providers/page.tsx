/**
 * Página de configuración de proveedores de IA.
 *
 * Permite al administrador agregar, editar, eliminar, probar y reordenar
 * los proveedores de modelos de IA utilizados por los agentes de NominaSmart.
 * Cada proveedor se almacena con su API key cifrada (AES-256-GCM) y un
 * modelo seleccionado del catálogo predefinido.
 *
 * Funcionalidades:
 * - CRUD completo de proveedores (crear, editar, eliminar).
 * - Test de conectividad por proveedor.
 * - Reordenamiento por prioridad de ejecución (drag up/down).
 * - Catálogo de modelos con indicadores de gratuidad y contexto.
 *
 * Consume las APIs:
 * - `GET  /api/settings/providers` — Lista proveedores configurados.
 * - `POST /api/settings/providers` — Crea un nuevo proveedor.
 * - `PUT  /api/settings/providers/[id]` — Actualiza un proveedor existente.
 * - `DELETE /api/settings/providers/[id]` — Elimina un proveedor.
 * - `POST /api/settings/providers/[id]/test` — Prueba conectividad del proveedor.
 * - `PUT  /api/settings/providers/reorder` — Reordena prioridades.
 *
 * Ruta: `/[locale]/settings/providers`
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { ProviderCard } from '@/components/ui/ProviderCard';
import { Shield, Sparkles, Zap, Info } from 'lucide-react';

/** Tipos de proveedor soportados por la plataforma. */
const PROVIDER_TYPES = ['openai', 'anthropic', 'groq', 'google', 'openrouter'] as const;
type ProviderType = (typeof PROVIDER_TYPES)[number];

/** Proveedor de IA almacenado en la tabla `ai_providers`. */
interface Provider {
  id: string;
  provider_type: ProviderType;
  display_name: string;
  api_key_masked: string;
  model_id: string;
  priority: number;
  is_active: boolean;
  last_test_at: string | null;
  last_test_success: boolean | null;
}

/** Datos del formulario de creación/edición de proveedor. */
interface FormData {
  provider_type: ProviderType;
  display_name: string;
  api_key: string;
  model_id: string;
  priority: number;
  is_active: boolean;
}

/** Opción de modelo dentro del catálogo de un proveedor. */
interface ModelOption {
  id: string;
  label: string;
  free: boolean;
  context: string;
  recommended?: boolean;
}

/**
 * Catálogo de modelos disponibles por proveedor.
 *
 * Cada entrada incluye un emoji identificador, descripción breve y la lista
 * de modelos con su ID, etiqueta, indicador de gratuidad, ventana de contexto
 * y si es recomendado. Se usa para renderizar el selector de modelos en el formulario.
 */
const MODEL_CATALOG: Record<ProviderType, { label: string; icon: string; hint: string; models: ModelOption[] }> = {
  openrouter: {
    label: 'OpenRouter', icon: '\uD83C\uDF10',
    hint: 'Acceso a m\u00FAltiples modelos con una sola API key. Incluye modelos gratuitos.',
    models: [
      { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (gratis)', free: true, context: '1M tokens', recommended: true },
      { id: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B (gratis)', free: true, context: '96K tokens' },
      { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3 (gratis)', free: true, context: '64K tokens', recommended: true },
      { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 Reasoning (gratis)', free: true, context: '64K tokens' },
      { id: 'meta-llama/llama-4-maverick:free', label: 'Llama 4 Maverick (gratis)', free: true, context: '128K tokens' },
      { id: 'meta-llama/llama-4-scout:free', label: 'Llama 4 Scout (gratis)', free: true, context: '512K tokens' },
      { id: 'qwen/qwen3-235b-a22b:free', label: 'Qwen 3 235B (gratis)', free: true, context: '40K tokens' },
      { id: 'microsoft/mai-ds-r1:free', label: 'MAI DS R1 (gratis)', free: true, context: '64K tokens' },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', free: false, context: '128K tokens' },
      { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', free: false, context: '200K tokens' },
    ],
  },
  openai: {
    label: 'OpenAI', icon: '\uD83E\uDD16', hint: 'Modelos GPT directamente desde OpenAI.',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', free: false, context: '128K tokens', recommended: true },
      { id: 'gpt-4o', label: 'GPT-4o', free: false, context: '128K tokens' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', free: false, context: '128K tokens' },
      { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', free: false, context: '16K tokens' },
    ],
  },
  anthropic: {
    label: 'Anthropic', icon: '\uD83E\uDDE0', hint: 'Modelos Claude de Anthropic.',
    models: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', free: false, context: '200K tokens', recommended: true },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', free: false, context: '200K tokens' },
    ],
  },
  groq: {
    label: 'Groq', icon: '\u26A1', hint: 'Inferencia ultra-r\u00E1pida. Modelos open-source acelerados.',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', free: false, context: '128K tokens', recommended: true },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', free: false, context: '128K tokens' },
      { id: 'gemma2-9b-it', label: 'Gemma 2 9B', free: false, context: '8K tokens' },
    ],
  },
  google: {
    label: 'Google AI', icon: '\uD83D\uDD2E', hint: 'Modelos Gemini directamente desde Google.',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', free: false, context: '1M tokens', recommended: true },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', free: false, context: '2M tokens' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', free: false, context: '1M tokens' },
    ],
  },
};

/** Estado inicial vacío para el formulario de proveedor. */
const EMPTY_FORM: FormData = { provider_type: 'openrouter', display_name: '', api_key: '', model_id: '', priority: 0, is_active: true };

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const catalog = MODEL_CATALOG[form.provider_type];
  const freeModels = catalog.models.filter((m) => m.free);
  const paidModels = catalog.models.filter((m) => !m.free);

  /** Carga la lista de proveedores desde la API. */
  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/providers');
      const data = await res.json();
      if (res.ok) setProviders(data.providers ?? []);
      else setError(data.error ?? 'Error al cargar proveedores');
    } catch { setError('Error de conexion'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);
  useEffect(() => { if (!success) return; const t = setTimeout(() => setSuccess(null), 4000); return () => clearTimeout(t); }, [success]);

  /** Reinicia el formulario al estado vacío y cierra el panel de edición. */
  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); setError(null); };

  /** Carga los datos de un proveedor existente en el formulario para edición. */
  const handleEdit = (p: Provider) => {
    setForm({ provider_type: p.provider_type, display_name: p.display_name, api_key: '', model_id: p.model_id, priority: p.priority, is_active: p.is_active });
    setEditingId(p.id); setShowForm(true);
  };

  /** Selecciona un modelo del catálogo y auto-completa el nombre visible si está vacío. */
  const selectModel = (model: ModelOption) => {
    setForm((prev) => ({ ...prev, model_id: model.id, display_name: prev.display_name || `${catalog.label} - ${model.label}` }));
  };

  /** Crea o actualiza un proveedor según si `editingId` está definido (PUT) o no (POST). */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const isEdit = editingId !== null;
      const url = isEdit ? `/api/settings/providers/${editingId}` : '/api/settings/providers';
      const body: Record<string, unknown> = { ...form };
      if (isEdit && !form.api_key) delete body.api_key;
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return; }
      setSuccess(isEdit ? 'Proveedor actualizado' : 'Proveedor creado');
      resetForm(); fetchProviders();
    } catch { setError('Error de conexion'); }
    finally { setSaving(false); }
  };

  /** Elimina un proveedor previa confirmación del usuario. */
  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este proveedor?')) return;
    try {
      const res = await fetch(`/api/settings/providers/${id}`, { method: 'DELETE' });
      if (res.ok) { setSuccess('Proveedor eliminado'); fetchProviders(); }
      else { const data = await res.json(); setError(data.error ?? 'Error al eliminar'); }
    } catch { setError('Error de conexion'); }
  };

  /** Ejecuta un test de conectividad contra el proveedor seleccionado. */
  const handleTest = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/providers/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (data.success) setSuccess('Conectividad OK');
      else setError(data.error ?? 'Test fallido');
      fetchProviders();
    } catch { setError('Error de conexion'); }
  };

  /** Intercambia la prioridad de un proveedor con su vecino (arriba o abajo). */
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= providers.length) return;
    const reordered = [...providers];
    [reordered[index], reordered[swapIdx]] = [reordered[swapIdx], reordered[index]];
    const order = reordered.map((p, i) => ({ id: p.id, priority: i }));
    try {
      const res = await fetch('/api/settings/providers/reorder', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) });
      if (res.ok) fetchProviders(); else setError('Error al reordenar');
    } catch { setError('Error de conexion'); }
  };

  if (loading) return (<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-violet border-t-transparent rounded-full animate-spin" /></div>);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-violet-light" /> Proveedores de IA
          </h1>
          <p className="text-sm text-slate-400 mt-1">Configura y prioriza los modelos de IA para tus agentes.</p>
        </div>
        {!showForm && (<Button onClick={() => setShowForm(true)} size="sm"><Zap className="w-4 h-4 mr-1.5" />Agregar proveedor</Button>)}
      </div>

      {error && (<div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm px-4 py-3 rounded-xl flex items-center gap-2"><Info className="w-4 h-4 shrink-0" /> {error}<button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-300">x</button></div>)}
      {success && (<div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm px-4 py-3 rounded-xl">{success}</div>)}

      <div className="glass-panel rounded-xl p-4 border-violet/20">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-white">Modelos gratuitos recomendados</p>
            <p className="text-xs text-slate-400 mt-1">OpenRouter ofrece modelos gratuitos de alta calidad. Recomendamos Gemini 2.0 Flash o DeepSeek V3 para empezar sin costo. Tus API keys se cifran con AES-256-GCM.</p>
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-panel rounded-xl p-6 space-y-6 border-violet/20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{editingId ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
            <button type="button" onClick={resetForm} className="text-slate-400 hover:text-white text-sm">Cancelar</button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Proveedor</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PROVIDER_TYPES.map((pt) => { const cat = MODEL_CATALOG[pt]; return (
                <button key={pt} type="button" onClick={() => setForm((prev) => ({ ...prev, provider_type: pt, model_id: '', display_name: '' }))}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${form.provider_type === pt ? 'bg-violet/20 border-violet/40 text-violet-light' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}>
                  {cat.icon} {cat.label}
                </button>); })}
            </div>
            <p className="text-xs text-slate-500 mt-2">{catalog.hint}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Modelo</label>
            {freeModels.length > 0 && (<div className="mb-3"><p className="text-xs text-emerald-400 font-medium mb-1.5">Gratuitos</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {freeModels.map((m) => (<button key={m.id} type="button" onClick={() => selectModel(m)} className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${form.model_id === m.id ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-slate-400 hover:border-emerald-500/20'}`}><span className="font-medium">{m.label}</span><span className="text-slate-500 ml-1">- {m.context}</span>{m.recommended && <span className="ml-1 text-emerald-400">*</span>}</button>))}
            </div></div>)}
            {paidModels.length > 0 && (<div><p className="text-xs text-slate-500 font-medium mb-1.5">De pago</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {paidModels.map((m) => (<button key={m.id} type="button" onClick={() => selectModel(m)} className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${form.model_id === m.id ? 'bg-violet/15 border-violet/30 text-violet-light' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}><span className="font-medium">{m.label}</span><span className="text-slate-500 ml-1">- {m.context}</span>{m.recommended && <span className="ml-1 text-violet-light">*</span>}</button>))}
            </div></div>)}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre visible</label>
            <input type="text" value={form.display_name} onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))} placeholder="Ej: Mi OpenRouter Gratis" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">API Key {editingId && <span className="text-slate-500 font-normal">(dejar vacio para mantener)</span>}</label>
            <input type="password" value={form.api_key} onChange={(e) => setForm((prev) => ({ ...prev, api_key: e.target.value }))} placeholder={editingId ? 'xxxxxxxx' : 'sk-...'} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet/50" required={!editingId} />
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Shield className="w-3 h-3" /> Cifrada con AES-256-GCM</p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} className="sr-only peer" />
            <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-emerald/30 transition-colors relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-4" />
            <span className="text-sm text-slate-300">Proveedor activo</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={saving || !form.model_id}>{saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear proveedor'}</Button>
          </div>
        </form>
      )}

      {providers.length === 0 && !showForm ? (
        <div className="glass-panel rounded-xl p-12 text-center">
          <Sparkles className="w-10 h-10 text-violet-light mx-auto mb-4 opacity-50" />
          <p className="text-slate-400 text-sm">No hay proveedores configurados.</p>
          <p className="text-slate-500 text-xs mt-1">Agrega uno para activar los agentes de IA.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Prioridad de ejecucion</p>
          {providers.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => handleMove(i, 'up')} disabled={i === 0} className="text-slate-500 hover:text-white disabled:opacity-20 text-xs px-1" aria-label="Subir prioridad">&#9650;</button>
                <button onClick={() => handleMove(i, 'down')} disabled={i === providers.length - 1} className="text-slate-500 hover:text-white disabled:opacity-20 text-xs px-1" aria-label="Bajar prioridad">&#9660;</button>
              </div>
              <div className="flex-1">
                <ProviderCard name={p.display_name} providerType={p.provider_type} model={p.model_id} isActive={p.is_active} lastTestSuccess={p.last_test_success} onTest={() => handleTest(p.id)} onEdit={() => handleEdit(p)} onDelete={() => handleDelete(p.id)} />
              </div>
              <span className="text-xs text-slate-600 font-mono w-6 text-center">#{i + 1}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
