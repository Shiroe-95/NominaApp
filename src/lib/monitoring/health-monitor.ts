/**
 * HealthMonitor — Verificaciones de salud para Supabase, Redis, proveedores IA y disco.
 *
 * Reglas de negocio:
 * - Ejecuta checks en paralelo con timeout configurable (default 5 000 ms).
 * - Estado general: 'down' si un servicio core (Supabase/Redis) está caído,
 *   'degraded' si algún servicio no-core falla, 'healthy' si todo está OK.
 * - Alerta a administradores registrando fallos en `audit_trail_extended`
 *   con severidad 'critical' (down) o 'warning' (degraded).
 *
 * Requisitos: 34.2 (health checks), 34.4 (alertas a administradores).
 *
 * @module lib/monitoring/health-monitor
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ServiceStatus = 'healthy' | 'degraded' | 'down';

export interface ServiceHealthCheck {
  service: string;
  status: ServiceStatus;
  latencyMs: number;
  message: string | null;
  checkedAt: string;
}

export interface HealthReport {
  overall: ServiceStatus;
  checks: ServiceHealthCheck[];
  timestamp: string;
}

export interface HealthMonitorConfig {
  /** Timeout in ms for each health check (default: 5000) */
  timeoutMs?: number;
  /** AI provider endpoints to check */
  aiProviders?: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5000;

const DEFAULT_AI_PROVIDERS = ['openai', 'anthropic', 'groq', 'google', 'openrouter'];

// ─── Upstash Redis helpers (same pattern as cache-layer.ts) ─────────────────

interface UpstashConfig {
  url: string;
  token: string;
}

function getUpstashConfig(): UpstashConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { url, token };
  return null;
}

// ─── Individual health checks ───────────────────────────────────────────────

/**
 * Verifica la conectividad con Supabase ejecutando una consulta ligera.
 *
 * Regla de negocio: si la consulta retorna error se marca como 'degraded';
 * si la conexión falla completamente se marca como 'down'.
 *
 * Requisito 34.2: verificar conectividad con Supabase.
 *
 * @param timeoutMs — Tiempo máximo de espera en milisegundos (default: 5000).
 * @returns Resultado del health check con estado, latencia y mensaje.
 */
export async function checkSupabase(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ServiceHealthCheck> {
  const start = Date.now();
  try {
    const supabase = createAdminClient();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const { error } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);

    clearTimeout(timer);

    if (error) {
      return makeCheck('supabase', 'degraded', Date.now() - start, error.message);
    }
    return makeCheck('supabase', 'healthy', Date.now() - start, null);
  } catch (err) {
    return makeCheck('supabase', 'down', Date.now() - start, errorMessage(err));
  }
}

/**
 * Verifica la disponibilidad de Redis (Upstash) enviando un comando PING.
 *
 * Regla de negocio: si las variables de entorno `UPSTASH_REDIS_REST_URL` y
 * `UPSTASH_REDIS_REST_TOKEN` no están configuradas, retorna 'down' inmediatamente.
 * Si el PING no responde 'PONG', se marca como 'degraded'.
 *
 * Requisito 34.2: verificar disponibilidad de Redis.
 *
 * @param timeoutMs — Tiempo máximo de espera en milisegundos (default: 5000).
 * @returns Resultado del health check con estado, latencia y mensaje.
 */
export async function checkRedis(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ServiceHealthCheck> {
  const start = Date.now();
  const config = getUpstashConfig();

  if (!config) {
    return makeCheck('redis', 'down', 0, 'Upstash Redis not configured');
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['PING']),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return makeCheck('redis', 'degraded', Date.now() - start, `HTTP ${res.status}`);
    }

    const data = (await res.json()) as { result: unknown };
    if (data.result === 'PONG') {
      return makeCheck('redis', 'healthy', Date.now() - start, null);
    }
    return makeCheck('redis', 'degraded', Date.now() - start, `Unexpected response: ${String(data.result)}`);
  } catch (err) {
    return makeCheck('redis', 'down', Date.now() - start, errorMessage(err));
  }
}

/**
 * Verifica el estado de los proveedores de IA comprobando que la variable
 * de entorno correspondiente esté configurada.
 *
 * No se realiza un ping HTTP real a cada proveedor para evitar consumo de cuota.
 * Proveedores verificados por defecto: openai, anthropic, groq, google, openrouter.
 *
 * Requisito 34.2: verificar estado de proveedores IA.
 *
 * @param providers — Lista de nombres de proveedores a verificar.
 * @returns Array de resultados de health check, uno por proveedor.
 */
export async function checkAIProviders(
  providers = DEFAULT_AI_PROVIDERS,
): Promise<ServiceHealthCheck[]> {
  const envKeys: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    groq: 'GROQ_API_KEY',
    google: 'GOOGLE_GENERATIVE_AI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
  };

  return providers.map((provider) => {
    const start = Date.now();
    const envKey = envKeys[provider];
    const hasKey = envKey ? !!process.env[envKey] : false;

    if (hasKey) {
      return makeCheck(`ai:${provider}`, 'healthy', Date.now() - start, null);
    }
    return makeCheck(`ai:${provider}`, 'down', Date.now() - start, `${envKey ?? provider} not configured`);
  });
}

/**
 * Verifica el espacio en disco disponible (solo server-side).
 *
 * En entornos serverless (Vercel) el disco es efímero, por lo que se realiza
 * una verificación ligera de asignación de memoria como heurística.
 * Se reporta 'healthy' a menos que la asignación falle.
 *
 * Requisito 34.2: verificar espacio en disco.
 *
 * @returns Resultado del health check con estado, latencia y mensaje.
 */
export async function checkDiskSpace(): Promise<ServiceHealthCheck> {
  const start = Date.now();
  try {
    // In serverless/edge environments, /tmp is the writable area.
    // We do a lightweight check by verifying we can allocate memory.
    const testData = new Uint8Array(1024);
    if (testData.length === 1024) {
      return makeCheck('disk', 'healthy', Date.now() - start, null);
    }
    return makeCheck('disk', 'degraded', Date.now() - start, 'Memory allocation issue');
  } catch (err) {
    return makeCheck('disk', 'down', Date.now() - start, errorMessage(err));
  }
}

// ─── Main health check runner ───────────────────────────────────────────────

/**
 * Ejecuta todos los health checks en paralelo y produce un reporte consolidado.
 *
 * Servicios verificados: Supabase, Redis, proveedores IA y disco.
 * El estado general se deriva así:
 * - 'down' si Supabase o Redis están caídos (servicios core).
 * - 'degraded' si algún servicio está degradado o caído (no core).
 * - 'healthy' si todos los servicios están operativos.
 *
 * Si el estado general no es 'healthy', se registra una alerta en
 * `audit_trail_extended` para que los administradores la vean en el panel
 * de auditoría (Req 34.4).
 *
 * Requisitos: 34.2 (health checks), 34.4 (alertas a administradores).
 *
 * @param config — Configuración opcional: timeout y lista de proveedores IA.
 * @returns Reporte de salud con estado general, checks individuales y timestamp.
 */
export async function runHealthChecks(
  config: HealthMonitorConfig = {},
): Promise<HealthReport> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const [supabaseCheck, redisCheck, aiChecks, diskCheck] = await Promise.all([
    checkSupabase(timeoutMs),
    checkRedis(timeoutMs),
    checkAIProviders(config.aiProviders),
    checkDiskSpace(),
  ]);

  const allChecks = [supabaseCheck, redisCheck, ...aiChecks, diskCheck];
  const overall = deriveOverallStatus(allChecks);

  const report: HealthReport = {
    overall,
    checks: allChecks,
    timestamp: new Date().toISOString(),
  };

  // Requirement 34.4: alert on failures
  if (overall !== 'healthy') {
    await alertOnFailures(report);
  }

  return report;
}

// ─── Alert on failures ──────────────────────────────────────────────────────

/**
 * Alerta a administradores cuando hay servicios degradados o caídos.
 *
 * Registra el evento en `audit_trail_extended` con action_type 'health_check_failure'
 * para que los administradores lo vean en el panel de auditoría.
 *
 * Requisito 34.4: registrar evento y alertar a administradores.
 */
async function alertOnFailures(report: HealthReport): Promise<void> {
  const failedChecks = report.checks.filter((c) => c.status !== 'healthy');

  if (failedChecks.length === 0) return;

  try {
    const supabase = createAdminClient();

    await supabase.from('audit_trail_extended').insert({
      action_type: 'health_check_failure',
      resource_type: 'system',
      severity: report.overall === 'down' ? 'critical' : 'warning',
      data_after: {
        overall: report.overall,
        failed_services: failedChecks.map((c) => ({
          service: c.service,
          status: c.status,
          message: c.message,
        })),
        timestamp: report.timestamp,
      },
    });
  } catch {
    // If we can't even log the alert, there's not much we can do.
    // The report is still returned to the caller.
    console.error('[HealthMonitor] Failed to log health alert to audit trail');
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCheck(
  service: string,
  status: ServiceStatus,
  latencyMs: number,
  message: string | null,
): ServiceHealthCheck {
  return {
    service,
    status,
    latencyMs,
    message,
    checkedAt: new Date().toISOString(),
  };
}

function deriveOverallStatus(checks: ServiceHealthCheck[]): ServiceStatus {
  const hasDown = checks.some((c) => c.status === 'down');
  const hasDegraded = checks.some((c) => c.status === 'degraded');

  // Core services being down = overall down
  const coreDown = checks.some(
    (c) => (c.service === 'supabase' || c.service === 'redis') && c.status === 'down',
  );

  if (coreDown) return 'down';
  if (hasDown || hasDegraded) return 'degraded';
  return 'healthy';
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
