/**
 * API Route: /api/notifications/:id/read
 *
 * Marca una notificación como leída.
 * Requiere autenticación. Valida UUID del parámetro.
 *
 * - PATCH — Marca la notificación como leída para el usuario autenticado
 *
 * @module api/notifications/[id]/read
 */
import { NextResponse } from 'next/server';
import { markAsRead } from '@/lib/notifications/notification-service';
import { applyRateLimit, requireAuth, isValidUuid, RATE_LIMITS } from '@/lib/api/guard';

/**
 * PATCH /api/notifications/[id]/read
 *
 * Marca una notificación como leída para el usuario autenticado.
 *
 * - Rate limit: `notifications-write` (preset write)
 * - Requiere autenticación (session Supabase)
 * - Valida que `id` sea un UUID válido
 *
 * @param req - Request entrante (solo se usa para rate limiting)
 * @param params - Parámetros dinámicos de la ruta (`id`: UUID de la notificación)
 * @returns `{ ok: true }` (200) si se marcó correctamente
 * @returns `{ error: string }` (400) si el UUID es inválido
 * @returns `{ error: string }` (401) si no hay sesión activa
 * @returns `{ error: string }` (429) si se excede el rate limit
 * @returns `{ error: string }` (500) en caso de error interno
 *
 * Requirement: 5.5
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = await applyRateLimit(req, 'notifications-write', RATE_LIMITS.write);
  if (rl) return rl;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    if (!id || !isValidUuid(id)) {
      return NextResponse.json(
        { error: 'Valid notification id is required' },
        { status: 400 },
      );
    }

    await markAsRead(id, auth.userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Notification mark-as-read error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
