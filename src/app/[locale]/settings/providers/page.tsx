'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { ProviderCard } from '@/components/ui/ProviderCard';
import { Shield, Sparkles, Zap, Info } from 'lucide-react';

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

interface ModelOption {
  id: string;
  label: string;
  free: boolean;
  context: string;
  recommended?: boolean;
}

// ── Catálogo de modelos por proveedor ───────────────────────────────

const MODEL_CATALOG: Record<ProviderType, { label: string; icon: string; hint: string; models: ModelOption[] }> = {
  openrouter: {
    label: 'OpenRouter',
    icon: '🌐',
    hint: 'Acceso a múltiples modelos con una sola API key. Incluye modelos gratuitos.',
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
    label: 'OpenAI',
    icon: '🤖',
    hint: 'Modelos GPT directamente desde OpenAI.',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', free: false, context: '128K tokens', recommended: true },
      { id: 'gpt-4o', label: 'GPT-4o', free: false, context: '128K tokens' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', free: false, context: '128K tokens' },
      { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', free: false, context: '16K tokens' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    icon: '🧠',
    hint: 'Modelos Claude de Anthropic.',
    models: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', free: false, context: '200K tokens', recommended: true },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', free: false, context: '200K tokens' },
    ],
  },
  groq: {
    label: 'Groq',
    icon: '⚡',
    hint: 'Inferencia ultra-rápida. Modelos open-source acelerados.',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', free: false, context: '128K tokens', recommended: true },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', free: false, context: '128K tokens' },
      { id: 'gemma2-9b-it', label: 'Gemma 2 9B', free: false, context: '8K tokens' },
    ],
  },
  google: {
    label: 'Google AI',
    icon: '🔮',
    hint: 'Modelos Gemini directamente desde Google.',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', free: false, context: '1M tokens', recommended: true },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', free: false, context: '2M tokens' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', free: false, context: '1M tokens' },
    ],
  },
};

const EMPTY_FORM: FormData = {
  provider_type: 'openrouter',
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

  const catalog = MODEL_CATALOG[form.provider_type];
  const freeModels = catalog.models.filter((m) => m.free);
  const paidModels = catalog.models.filter((m) => !m.free);

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
    const t = setTimeout(() => setSuccess(null), 4000);
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

  const selectModel = (model: ModelOption) => {
    setForm((prev) => ({
      ...prev,
      model_id: model.id,
      display_name: prev.display_name || `${catalog.label} — ${model.label}`,
    }));
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

      setSuccess(isEdit ? 'Proveedor actualizado correctamente ✓' : 'Proveedor creado y probado ✓');
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
      if (data.success) setSuccess('Conectividad OK ✓');
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
