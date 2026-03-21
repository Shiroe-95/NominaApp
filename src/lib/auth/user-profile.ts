import { createAdminClient } from '@/lib/supabase/admin';

export type UserRole = 'admin' | 'analyst' | 'client';

export interface UserProfile {
  id: string;
  role: UserRole;
  company_id: string | null;
  display_name: string | null;
  preferred_locale?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Route access rules by role.
 * Paths are matched as prefixes against the pathname (without locale).
 */
const ADMIN_ONLY_ROUTES = ['/admin', '/settings/providers', '/settings/users'];
const ANALYST_ROUTES = ['/upload', '/reconcile', '/rules'];

/**
 * Routes that don't require authentication.
 * Matched as prefixes against the full pathname (without locale).
 */
const PUBLIC_ROUTE_PREFIXES = ['/login', '/auth'];

/**
 * Determina si una ruta (sin prefijo de locale) es pública y no requiere autenticación.
 *
 * Se consideran públicas:
 * - Rutas del grupo `(public)`: `/`, `/pricing`, `/contact`, `/about`
 * - Rutas que comienzan con prefijos públicos: `/login`, `/auth`
 *
 * @param pathWithoutLocale - Ruta sin prefijo de locale (ej: `/pricing`, `/about`)
 * @returns `true` si la ruta es pública y accesible sin autenticación
 */
export function isPublicRoute(pathWithoutLocale: string): boolean {
  // Rutas del route group (public) — no llevan /public en la URL,
  // están en la raíz: /, /pricing, /contact, /about
  const publicGroupPaths = ['/', '/pricing', '/contact', '/about'];
  if (publicGroupPaths.includes(pathWithoutLocale)) return true;

  return PUBLIC_ROUTE_PREFIXES.some((prefix) =>
    pathWithoutLocale.startsWith(prefix)
  );
}

/**
 * Fetch the full user profile from the `user_profiles` table.
 * Uses the admin client to bypass RLS.
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
 * Fetch only the user's role string.
 */
export async function getUserRole(
  userId: string
): Promise<UserRole | null> {
  const profile = await getUserProfile(userId);
  return profile?.role ?? null;
}

/**
 * Check if a given role has permission to access a path.
 * The path should be stripped of the locale prefix (e.g. "/upload", "/admin/usage").
 */
export function hasPermission(role: UserRole, pathWithoutLocale: string): boolean {
  // Admin has access to everything
  if (role === 'admin') return true;

  // Check if the route is admin-only
  const isAdminOnly = ADMIN_ONLY_ROUTES.some((prefix) =>
    pathWithoutLocale.startsWith(prefix)
  );
  if (isAdminOnly) return false;

  // Analyst can access analyst routes + general authenticated routes
  if (role === 'analyst') return true;

  // Client cannot access analyst-specific routes
  const isAnalystRoute = ANALYST_ROUTES.some((prefix) =>
    pathWithoutLocale.startsWith(prefix)
  );
  if (isAnalystRoute) return false;

  // Client can access everything else (dashboard, reports, settings profile)
  return true;
}
