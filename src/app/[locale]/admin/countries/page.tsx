'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';

interface Country {
  id: string;
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_symbol: string;
  locale_format: string;
  decimal_separator: string;
  thousands_separator: string;
  is_active: boolean;
}

const empty: Omit<Country, 'id'> = {
  country_code: '',
  country_name: '',
  currency_code: '',
  currency_symbol: '',
  locale_format: '',
  decimal_separator: '.',
  thousands_separator: ',',
  is_active: true,
};

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Country, 'id'>>(empty);
  const [researchingId, setResearchingId] = useState<string | null>(null);

  const fetchCountries = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/countries');
      const data = await res.json();
      if (res.ok) setCountries(data);
      else setError(data.error ?? 'Error loading countries');
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCountries(); }, [fetchCountries]);

  const resetForm = () => { setEditId(null); setForm(empty); };

  const startEdit = (c: Country) => {
    setEditId(c.id);
    setForm({
      country_code: c.country_code,
      country_name: c.country_name,
      currency_code: c.currency_code,
      currency_symbol: c.currency_symbol,
      locale_format: c.locale_format,
      decimal_separator: c.decimal_separator,
      thousands_separator: c.thousands_separator,
      is_active: c.is_active,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const method = editId ? 'PUT' : 'POST';
      const body = editId ? { id: editId, ...form } : form;
      const res = await fetch('/api/admin/countries', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Save failed');
      } else {
        resetForm();
        await fetchCountries();
      }
    } catch {
      setError('Connection error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this country?')) return;
    setError(null);
    try {
      const res = await fetch('/api/admin/countries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Delete failed');
      } else {
        await fetchCountries();
      }
    } catch {
      setError('Connection error');
    }
  };

  const handleResearch = async (c: Country) => {
    setResearchingId(c.id);
    setError(null);
    try {
      const res = await fetch('/api/ai/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'research',
          context: { countryCode: c.country_code, year: new Date().getFullYear() },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Research request failed');
      }
    } catch {
      setError('Connection error');
    } finally {
      setResearchingId(null);
    }
  };

  const set = (field: keyof Omit<Country, 'id'>, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const inputCls =
    'w-full rounded-lg border border-white/10 bg-navy-light px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet/40';

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Países soportados</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Gestiona los países, monedas y formatos de localización.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* ── Form ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-navy-light/50 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">
          {editId ? 'Editar país' : 'Agregar país'}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Código país</label>
            <input
              className={inputCls}
              placeholder="CO"
              maxLength={5}
              value={form.country_code}
              onChange={(e) => set('country_code', e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nombre</label>
            <input
              className={inputCls}
              placeholder="Colombia"
              value={form.country_name}
              onChange={(e) => set('country_name', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Moneda (ISO)</label>
            <input
              className={inputCls}
              placeholder="COP"
              maxLength={3}
              value={form.currency_code}
              onChange={(e) => set('currency_code', e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Símbolo</label>
            <input
              className={inputCls}
              placeholder="$"
              value={form.currency_symbol}
              onChange={(e) => set('currency_symbol', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Locale</label>
            <input
              className={inputCls}
              placeholder="es-CO"
              value={form.locale_format}
              onChange={(e) => set('locale_format', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sep. decimal</label>
            <input
              className={inputCls}
              placeholder=","
              maxLength={1}
              value={form.decimal_separator}
              onChange={(e) => set('decimal_separator', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sep. miles</label>
            <input
              className={inputCls}
              placeholder="."
              maxLength={1}
              value={form.thousands_separator}
              onChange={(e) => set('thousands_separator', e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2 pb-0.5">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => set('is_active', e.target.checked)}
                className="rounded border-white/20 bg-navy-light text-violet focus:ring-violet/40"
              />
              Activo
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving || !form.country_code || !form.country_name}>
            {saving ? 'Guardando…' : editId ? 'Actualizar' : 'Crear'}
          </Button>
          {editId && (
            <Button size="sm" variant="ghost" onClick={resetForm}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
