'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';

// ── Tipos ───────────────────────────────────────────────────────────

/** Representación de un usuario con su perfil y empresa asociada. */
interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
  company_id: string | null;
  company_name: string | null;
  is_active: boolean;
  created_at: string;
  invitation_status?: string;
}

/** Datos del formulario para invitar un nuevo usuario. */
interface UserForm {
  email: string;
  display_name: string;
  role: string;
  company_id: string;
}

// ── Constantes ──────────────────────────────────────────────────────

/** Estado inicial vacío del formulario de creación de usuario. */
const EMPTY_FORM: UserForm = {
  email: '',
  display_name: '',
  role: 'client',
  company_id: '',
};

/** Roles disponibles en el sistema (admin, analyst, client). */
const ROLES = ['admin', 'analyst', 'client'] as const;

/** Etiquetas legibles para cada rol, usadas en la UI. */
const ROLE_LABELS: Record<string, string> = { admin: 'Admin', analyst: 'Analista', client: 'Cliente' };

/** Opciones de filtro por estado de activación del usuario. */
const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
];

// ── Componente ──────────────────────────────────────────────────────

/**
 * Página de gestión de usuarios (solo accesible por administradores).
 *
 * Permite listar, crear, editar inline y desactivar usuarios del sistema.
 * Consume los endpoints:
 * - `GET /api/admin/users` — listar usuarios con filtros por rol y estado.
 * - `POST /api/admin/users` — crear usuario en Auth + perfil.
 * - `PUT /api/admin/users/:id` — actualizar rol, empresa, nombre o estado.
 * - `DELETE /api/admin/users/:id` — desactivación lógica (soft-delete).
 *
 * Ruta protegida: `/[locale]/settings/users` (requiere rol `admin`).
 */
export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);

  // Edit-inline state
  const [editInlineId, setEditInlineId] = useState<string | null>(null);
  const [editInlineData, setEditInlineData] = useState<{
    display_name: string;
    role: string;
    company_id: string;
    is_active: boolean;
  }>({ display_name: '', role: 'client', company_id: '', is_active: true });

  // Resend invite state
  const [resendingId, setResendingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterRole) params.set('role', filterRole);
      if (filterStatus) params.set('status', filterStatus);
      const qs = params.toString();
      const res = await fetch(`/api/admin/users${qs ? `?${qs}` : ''}`);
      const data = await res.json();
      if (res.ok) setUsers(data.users ?? []);
      else setError(data.error ?? 'Error al cargar usuarios');
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [filterRole, filterStatus]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [success]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingUser(null);
    setShowForm(false);
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          display_name: form.display_name,
          role: form.role,
          company_id: form.company_id || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al invitar usuario');
        return;
      }
      setSuccess('Invitación enviada correctamente');
      resetForm();
      fetchUsers();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const startInlineEdit = (u: User) => {
    setEditInlineId(u.id);
    setEditInlineData({
      display_name: u.display_name ?? '',
      role: u.role,
      company_id: u.company_id ?? '',
      is_active: u.is_active,
    });
  };

  const cancelInlineEdit = () => {
    setEditInlineId(null);
  };

  const saveInlineEdit = async () => {
    if (!editInlineId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${editInlineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: editInlineData.display_name,
          role: editInlineData.role,
          company_id: editInlineData.company_id || null,
          is_active: editInlineData.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al actualizar usuario');
        return;
      }
      setSuccess('Usuario actualizado');
      setEditInlineId(null);
      fetchUsers();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('¿Desactivar este usuario?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccess('Usuario desactivado');
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error ?? 'Error al desactivar');
      }
    } catch {
      setError('Error de conexión');
    }
  };

  const handleResendInvite = async (id: string) => {
    setResendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/resend-invite`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Invitación reenviada correctamente');
      } else {
        setError(data.error ?? 'Error al reenviar invitación');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setResendingId(null);
    }
  };

  const inputCls =
    'h-10 w-full px-3 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet/50';
  const selectCls =
    'h-10 w-full px-3 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet/50';
  const inlineInputCls =
    'h-8 px-2 rounded border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-violet/30';

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gestión de Usuarios</h1>
          <p className="text-sm text-slate-500 mt-0.5">Administra usuarios, roles y permisos.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nuevo usuario'}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-600">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-600">{success}</div>
      )}

      {/* ── Create form ──────────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Invitar usuario</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Email</label>
              <input className={inputCls} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nombre</label>
              <input className={inputCls} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Rol</label>
              <select className={selectCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">ID Empresa (opcional)</label>
              <input className={inputCls} value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} />
            </div>
          </div>
          <Button size="sm" disabled={saving}>{saving ? 'Enviando…' : 'Enviar invitación'}</Button>
        </form>
      )}

      {/* ── Filters ──────────────────────────────────────── */}
      <div className="flex gap-3 items-center">
        <select className={`${selectCls} w-40`} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">Todos los roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <select className={`${selectCls} w-40`} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Table ────────────────────────────────────────── */}
      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-slate-400">No hay usuarios.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Estado invitación</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-slate-700">
                    {editInlineId === u.id ? (
                      <input className={inlineInputCls} value={editInlineData.display_name} onChange={(e) => setEditInlineData({ ...editInlineData, display_name: e.target.value })} />
                    ) : (
                      u.display_name || '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    {editInlineId === u.id ? (
                      <select className={`${inlineInputCls} w-24`} value={editInlineData.role} onChange={(e) => setEditInlineData({ ...editInlineData, role: e.target.value })}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {editInlineId === u.id ? (
                      <input className={`${inlineInputCls} w-28`} value={editInlineData.company_id} onChange={(e) => setEditInlineData({ ...editInlineData, company_id: e.target.value })} />
                    ) : (
                      u.company_name || u.company_id || '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editInlineId === u.id ? (
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="checkbox" checked={editInlineData.is_active} onChange={(e) => setEditInlineData({ ...editInlineData, is_active: e.target.checked })} />
                        {editInlineData.is_active ? 'Activo' : 'Inactivo'}
                      </label>
                    ) : (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.invitation_status === 'pending' ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pendiente</span>
                    ) : u.invitation_status === 'accepted' || u.invitation_status === 'active' ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Activo</span>
                    ) : u.invitation_status === 'expired' ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">Expirado</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {editInlineId === u.id ? (
                      <>
                        <Button size="sm" onClick={saveInlineEdit} disabled={saving}>Guardar</Button>
                        <Button size="sm" variant="ghost" onClick={cancelInlineEdit}>Cancelar</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => startInlineEdit(u)}>Editar</Button>
                        {u.is_active && (
                          <Button size="sm" variant="ghost" onClick={() => handleDeactivate(u.id)}>Desactivar</Button>
                        )}
                        {u.invitation_status === 'pending' && (
                          <Button size="sm" variant="ghost" onClick={() => handleResendInvite(u.id)} disabled={resendingId === u.id}>
                            {resendingId === u.id ? 'Reenviando…' : 'Reenviar invitación'}
                          </Button>
                        )}
                      </>
                    )}
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
