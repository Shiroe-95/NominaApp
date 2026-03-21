'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * Representa un país configurado en el sistema con su moneda y formato de localización.
 * Corresponde a la tabla `countries` en Supabase.
 */
interface Country {
  id: string;
  /** Código ISO del país (ej. "CO", "MX") */
  country_code: string;
  /** Nombre legible del país */
  country_name: string;
  /** Código ISO 4217 de la moneda (ej. "COP", "USD") */
  currency_code: string;
  /** Símbolo de la moneda (ej. "$", "€") */
  currency_symbol: string;
  /** Identificador de locale (ej. "es-CO") */
  locale_format: string;
  /** Separador decimal usado en el locale */
  decimal_separator: string;
  /** Separador de miles usado en el locale */
  thousands_separator: string;
  /** Indica si el país está habilitado para uso en la plataforma */
  is_active: boolean;
}

/** Valores por defecto para el formulario de creación de un país nuevo. */
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

/**
 * Página de administración de países soportados.
 *
 * Permite crear, editar, eliminar y consultar los países configurados en la plataforma.
 * Cada país define su moneda, formato de localización y separadores numéricos.
 * Incluye un botón "Investigar" que invoca al Agente Investigador de IA
 * para obtener normativa laboral vigente del país seleccionado.
 *
 * Secciones:
 * - Formulario de creación/edición de país.
 * - Tabla con listado de países, estado (activo/inactivo) y acciones (editar, investigar, eliminar).
 *
 * Consume la API `/api/admin/countries` (GET, POST, PUT, DELETE)
 * y `/api/ai/orchestrate` (POST, type: "research") para la investigación con IA.
 */
export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Country, 'id'>>(empty);
  const [researchingId, setResearchingId] = useState<string | null>(null);

  /** Obtiene la lista de países desde la API. */
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

  /** Reinicia el formulario al estado de creación. */
  const resetForm = () => { setEditId(null); setForm(empty); };

  /** Carga los datos de un país existente en el formulario para edición. */
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

  /** Crea o actualiza un país según si `editId` está definido (PUT) o no (POST). */
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

  /** Elimina un país previa confirmación del usuario. */
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

  /** Invoca al Agente Investigador de IA para obtener normativa laboral vigente del país. */
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

  /** Helper para actualizar un campo del formulario de forma tipada. */
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

      {/* ── Table ────────────────────────────────────────── */}
      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : countries.length === 0 ? (
        <p className="text-sm text-slate-400">No hay países configurados.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm text-left">
            <thead className="bg-navy-light/60 text-xs text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">País</th>
                <th className="px-4 py-3">Moneda</th>
                <th className="px-4 py-3">Símbolo</th>
                <th className="px-4 py-3">Locale</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {countries.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-200">{c.country_code}</td>
                  <td className="px-4 py-3 text-slate-200">{c.country_name}</td>
                  <td className="px-4 py-3 text-slate-300">{c.currency_code}</td>
                  <td className="px-4 py-3 text-slate-300">{c.currency_symbol}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{c.locale_format}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.is_active
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {c.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(c)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleResearch(c)}
                      disabled={researchingId === c.id}
                    >
                      {researchingId === c.id ? 'Investigando…' : '🔍 Investigar'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}>
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
