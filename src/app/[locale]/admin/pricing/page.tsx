'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Tag, Save, Globe2 } from 'lucide-react';

interface PricingRow {
  id: string;
  task_type: string;
  country_code: string;
  price_per_task: number;
  currency_code: string;
}

const TASK_LABELS: Record<string, string> = {
  validation: 'Validación',
  mapping: 'Mapeo',
  correction: 'Corrección',
  'full-analysis': 'Análisis completo',
  research: 'Investigación',
};

export default function PricingAdminPage() {
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/admin/finance?type=pricing')
      .then((r) => {
        if (!r.ok) throw new Error('Error al cargar precios');
        return r.json();
      })
      .then((data: PricingRow[]) => setRows(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const updatePrice = (id: string, value: string) => {
    setSuccess(false);
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, price_per_task: parseFloat(value) || 0 } : r
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/admin/finance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  const grouped = rows.reduce<Record<string, PricingRow[]>>((acc, r) => {
    (acc[r.country_code] ??= []).push(r);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Cargando precios…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tag className="h-6 w-6 text-violet-600" />
          <h1 className="text-2xl font-bold text-slate-900">
            Configuración de Precios
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-4 py-2">
          Precios actualizados correctamente.
        </p>
      )}

      {Object.entries(grouped).map(([country, items]) => (
        <div
          key={country}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-slate-700 font-semibold">
            <Globe2 className="h-5 w-5 text-violet-500" />
            <span>País: {country}</span>
            <span className="ml-auto text-xs text-slate-400">
              {items[0]?.currency_code}
            </span>
          </div>

          <div className="grid gap-3">
            {items.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-4 text-sm"
              >
                <span className="w-40 text-slate-600">
                  {TASK_LABELS[row.task_type] ?? row.task_type}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.price_per_task}
                  onChange={(e) => updatePrice(row.id, e.target.value)}
                  className="h-10 px-3 rounded-lg border border-slate-200 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <span className="text-slate-400">{row.currency_code}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
