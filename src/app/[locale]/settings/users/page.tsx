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
}

/** Datos del formulario para crear un nuevo usuario. */
interface UserForm {
  email: string;
  password: string;
  display_name: string;
  role: string;
  company_id: string;
}

// ── Constantes ──────────────────────────────────────────────────────

/** Estado inicial vacío del formulario de creación de usuario. */
const EMPTY_FORM: UserForm = {
  email: '',
  password: '',
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
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          display_name: form.display_name,
          role: form.role,
          company_id: form.company_id || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al crear usuario');
        return;
      }
      setSuccess('Usuario creado correctamente');
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

  const inputCls =
    'h-10 w-full px-3 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet/50';
  const selectCls =
    'h-10 w-full px-3 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet/50';
  const inlineInputCls =
    'h-8 px-2 rounded border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-violet/30';
