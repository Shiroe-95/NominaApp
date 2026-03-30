/**
 * Módulo de perfiles de usuario y control de acceso basado en roles (RBAC).
 *
 * Reglas de negocio:
 * - Tres roles jerárquicos: admin > analyst > client.
 * - admin: acceso total a todas las rutas.
 * - analyst: acceso a todo excepto rutas bajo /admin/*.
 * - client: acceso limitado a /dashboard y /reports (y rutas públicas).
 * - Las rutas públicas (/, /pricing, /contact, /about, /manual, /login, /auth) no requieren autenticación.
 * - La función `hasPermission` es la fuente única de verdad para permisos,
 *   utilizada tanto por el middleware Edge como por el API guard.
 * - `fetchUserRoleEdge` consulta el rol vía REST (compatible con Edge Runtime)
 *   y retorna 'client' como fallback seguro ante cualquier error.
 *
 * @module auth/user-profile
 */
import { createAdminClient } from '@/lib/supabase/admin';

/** Roles disponibles en el sistema, ordenados de mayor a menor privilegio. */
export type UserRole = 'admin' | 'analyst' | 'client';

/**
 * Perfil de usuario almacenado en la tabla `user_profiles`.
 * La clave primaria (`id`) es FK hacia `auth.users`.
 */
export interface UserProfile {
  /** UUID del usuario (PK y FK hacia auth.users). */
  id: string;
  /** Rol del usuario que determina sus permisos de acceso. */
  role: UserRole;
  /** UUID de la empresa asociada; `null` si no pertenece a ninguna. */
  company_id: string | null;
  /** Nombre para mostrar en la interfaz. */
  display_name: string | null;
  /** Locale preferido del usuario (es, en, pt). */
  preferred_locale?: string | null;
  /** Fecha de creación del perfil (ISO 8601). */
  created_at: string;
  /** Fecha de última actualización del perfil (ISO 8601). */
  updated_at: string;
}

// ─── Fuente única de verdad para reglas de acceso por rol ───────────────────

/**
 * Mapa de permisos por ruta.
 *
 * - admin  → acceso total a todas las rutas.
 * - analyst → acceso a todo excepto rutas bajo /admin/*.
 * - client  → acceso exclusivamente a /dashboard y /reports.
 */

/** Prefijo de rutas restringidas a admin */
export const ADMIN_ROUTE_PREFIX = '/admin';

/** Rutas permitidas para el rol client (whitelist) */
export const CLIENT_ALLOWED_ROUTES = ['/dashboard', '/reports'];

/** Rutas públicas exactas (sin locale) que no requieren autenticación */
export const PUBLIC_PATHS = ['/', '/pricing', '/contact', '/about', '/manual'];
/** Prefijos de rutas públicas */
export const PUBLIC_PREFIXES = ['/login', '/auth'];

/**
 * Determina si una ruta (sin prefijo de locale) es pública y no requiere autenticación.
 *
 * Compara contra `PUBLIC_PATHS` (coincidencia exacta) y `PUBLIC_PREFIXES` (startsWith).
 *
 * @param pathWithoutLocale - Ruta sin el prefijo de locale, ej: "/pricing", "/login".
 * @returns `true` si la ruta es pública y no necesita sesión activa.
 */
export function isPublicRoute(pathWithoutLocale: string): boolean {
  if (PUBLIC_PATHS.includes(pathWithoutLocale)) return true;
  return PUBLIC_PREFIXES.some((prefix) =>
    pathWithoutLocale.startsWith(prefix)
  );
}

/**
 * Verifica si un rol tiene permiso para acceder a una ruta.
 *
 * Lógica de evaluación:
 * 1. `admin` → acceso total, retorna `true` inmediatamente.
 * 2. `analyst` → acceso a todo excepto rutas bajo `/admin/*`.
 * 3. `client` → acceso solo a `/dashboard` y `/reports`.
 *
 * Esta es la ÚNICA función de permisos — usada tanto por el middleware
 * como por el API guard.
 *
 * @param role - Rol del usuario autenticado.
 * @param pathWithoutLocale - Ruta sin prefijo de locale, ej: "/upload", "/admin/usage".
 * @returns `true` si el rol tiene permiso para acceder a la ruta.
 */
export function hasPermission(role: UserRole, pathWithoutLocale: string): boolean {
  // admin → acceso total
  if (role === 'admin') return true;

  // analyst → todo excepto /admin/*
  if (role === 'analyst') {
    return !pathWithoutLocale.startsWith(ADMIN_ROUTE_PREFIX);
  }

  // client → solo /dashboard y /reports (whitelist)
  return CLIENT_ALLOWED_ROUTES.some((allowed) =>
    pathWithoutLocale.startsWith(allowed)
  );
}

/**
 * Obtiene el perfil completo de un usuario desde la tabla `user_profiles`.
 *
 * Usa el cliente admin de Supabase para saltar las políticas RLS,
 * permitiendo consultar cualquier perfil independientemente del usuario autenticado.
 *
 * @param userId - UUID del usuario (debe coincidir con `auth.users.id`).
 * @returns El perfil completo del usuario, o `null` si no existe o hay error.
 */
export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

/**
 * Obtiene únicamente el rol de un usuario.
 *
 * Wrapper sobre `getUserProfile` que extrae solo el campo `role`.
 *
 * @param userId - UUID del usuario.
 * @returns El rol del usuario, o `null` si el perfil no existe.
 */
export async function getUserRole(
  userId: string
): Promise<UserRole | null> {
  const profile = await getUserProfile(userId);
  return profile?.role ?? null;
}

/**
 * Obtiene el rol de un usuario vía REST API de Supabase (compatible con Edge Runtime).
 *
 * Usado exclusivamente por el middleware que corre en Edge Runtime, donde
 * no se puede importar el cliente admin de Supabase (requiere Node.js).
 * Consulta directamente la API REST de Supabase con la service role key.
 *
 * En caso de error (red, permisos, perfil inexistente), retorna `'client'`
 * como fallback seguro (rol más restrictivo).
 *
 * @param userId - UUID del usuario autenticado.
 * @returns El rol del usuario, o `'client'` como fallback ante cualquier error.
 */
export async function fetchUserRoleEdge(userId: string): Promise<UserRole> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = await fetch(
      `${url}/rest/v1/user_profiles?id=eq.${userId}&select=role`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        // No cachear para siempre tener el rol actualizado
        cache: 'no-store',
      }
    );

    if (res.ok) {
      const rows = await res.json();
      if (rows.length > 0 && rows[0].role) return rows[0].role as UserRole;
    }
  } catch {
    // fallback silencioso — si falla, asumimos el rol más restrictivo
  }
  return 'client';
}
