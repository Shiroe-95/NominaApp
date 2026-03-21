'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { ProviderCard } from '@/components/ui/ProviderCard';

const PROVIDER_TYPES = ['openai', 'anthropic', 'groq', 'google', 'openrouter'] as const;
type ProviderType = (typeof PROVIDER_TYPES)[number];

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

interface FormData {
  provider_type: ProviderType;
  display_name: string;
  api_key: string;
  model_id: string;
  priority: number;
  is_active: boolean;
}

const EMPTY_FORM: FormData = {
  provider_type: 'openai',
  display_name: '',
  api_key: '',
  model_id: '',
  priority: 0,
  is_active: true,
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/providers');
      const data = await res.json();
      if (res.ok) setProviders(data.providers ?? []);
      else setError(data.error ?? 'Error al cargar proveedores');
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [success]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (p: Provider) => {
    setForm({
      provider_type: p.provider_type,
      display_name: p.display_name,
      api_key: '',
      model_id: p.model_id,
      priority: p.priority,
      is_active: p.is_active,
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const isEdit = editingId !== null;
      const url = isEdit ? `/api/settings/providers/${editingId}` : '/api/settings/providers';
      const method = isEdit ? 'PUT' : 'POST';

      const body: Record<string, unknown> = { ...form };
      if (isEdit && !form.api_key) delete body.api_key;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Error al guardar');
        return;
      }

      setSuccess(isEdit ? 'Proveedor actualizado' : 'Proveedor creado');
      resetForm();
      fetchProviders();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este proveedor?')) return;
    try {
      const res = await fetch(`/api/settings/providers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccess('Proveedor eliminado');
        fetchProviders();
      } else {
        const data = await res.json();
        setError(data.error ?? 'Error al eliminar');
      }
    } catch {
      setError('Error de conexión');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch(`/api/settings/providers/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (data.success) setSuccess('Conectividad OK');
      else setError(data.error ?? 'Test fallido');
      fetchProviders();
    } catch {
      setError('Error de conexión');
    } finally {
      setTestingId(null);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= providers.length) return;

    const reordered = [...providers];
    [reordered[index], reordered[swapIdx]] = [reordered[swapIdx], reordered[index]];
    const order = reordered.map((p, i) => ({ id: p.id, priority: i }));

    try {
      const res = await fetch('/api/settings/providers/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (res.ok) fetchProviders();
      else setError('Error al reordenar');
    } catch {
      setError('Error de conexión');
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Proveedores de IA</h1>
          <p className="text-sm text-slate-400 mt-0.5">Configura y prioriza los proveedores de inteligencia artificial.</p>
        </div>
        {!showForm && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            + Agregar proveedor
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">cerrar</button>
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* CRUD Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">
            {editingId ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</label>
              <select
                value={form.provider_type}
                onChange={(e) => setForm({ ...form, provider_type: e.target.value as ProviderType })}
                className="h-10 w-full px-3 rounded-lg border border-slate-200 text-sm bg-white"
              >
                {PROVIDER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre</label>
              <input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Mi proveedor"
                required
                className="h-10 w-full px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                API Key {editingId && <span className="text-slate-400 normal-case">(dejar vacío para mantener)</span>}
              </label>
              <input
                type="password"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder={editingId ? '••••••••' : 'sk-...'}
                required={!editingId}
                className="h-10 w-full px-3 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Modelo</label>
              <input
                value={form.model_id}
                onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                placeholder="gpt-4o-mini"
                required
                className="h-10 w-full px-3 rounded-lg border border-slate-200 text-sm font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Prioridad</label>
              <input
                type="number"
                min={0}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                className="h-10 w-full px-3 rounded-lg border border-slate-200 text-sm"
              />
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-violet-600"
                />
                <span className="text-sm text-slate-700">Activo</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : editingId ? 'Actualizar' : 'Crear proveedor'}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm}>Cancelar</Button>
          </div>
        </form>
      )}

      {/* Provider List */}
      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Cargando proveedores…</div>
      ) : providers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">No hay proveedores configurados.</p>
          <p className="text-xs text-slate-400 mt-1">Agrega uno para empezar a usar la IA.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((p, idx) => (
            <div key={p.id} className="flex items-start gap-2">
              {/* Priority controls */}
              <div className="flex flex-col gap-1 pt-3">
                <button
                  onClick={() => handleMove(idx, 'up')}
                  disabled={idx === 0}
                  className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
                  title="Subir prioridad"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleMove(idx, 'down')}
                  disabled={idx === providers.length - 1}
                  className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
                  title="Bajar prioridad"
                >
                  ▼
                </button>
              </div>

              <div className="flex-1">
                <ProviderCard
                  name={p.display_name}
                  providerType={p.provider_type}
                  model={p.model_id}
                  isActive={p.is_active}
                  lastTestSuccess={p.last_test_success}
                  onTest={() => handleTest(p.id)}
                  onEdit={() => handleEdit(p)}
                  onDelete={() => handleDelete(p.id)}
                />
                {testingId === p.id && (
                  <p className="text-xs text-slate-400 mt-1 ml-1">Probando conectividad…</p>
                )}
              </div>

              <div className="pt-4 text-xs text-slate-300 font-mono w-6 text-center">
                #{idx + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
