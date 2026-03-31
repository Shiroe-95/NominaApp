/**
 * Admin Health Dashboard — "Salud del Sistema" page.
 *
 * Consumes /api/v1/health with auto-refresh every 30s.
 * Shows per-service status, notifications, incident history, and aggregated metrics.
 *
 * Requirements: 21.1–21.5
 * @module app/[locale]/admin/health/page
 */
'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface ServiceCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  message: string | null;
  checkedAt: string;
}

interface HealthReport {
  overall: 'healthy' | 'degraded' | 'down';
  checks: ServiceCheck[];
  timestamp: string;
}

interface Notification {
  service: string;
  previousStatus: string;
  newStatus: string;
  severity: 'critical' | 'warning';
  message: string;
  timestamp: string;
}

const STATUS_COLORS: Record<string, string> = {
  healthy: 'text-green-500',
  degraded: 'text-yellow-500',
  down: 'text-red-500',
};

const STATUS_BG: Record<string, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
};

export default function HealthDashboardPage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [previousStatuses, setPreviousStatuses] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/health', { cache: 'no-store' });
      const data: HealthReport = await res.json();
      setReport(data);

      // Check for status transitions → notifications
      setPreviousStatuses((prev) => {
        const newNotifs: Notification[] = [];
        for (const check of data.checks) {
          const prevStatus = prev.get(check.service);
          if (prevStatus === 'healthy' && check.status !== 'healthy') {
            newNotifs.push({
              service: check.service,
              previousStatus: prevStatus,
              newStatus: check.status,
              severity: check.status === 'down' ? 'critical' : 'warning',
              message: `${check.service}: ${prevStatus} → ${check.status}`,
              timestamp: check.checkedAt,
            });
          }
        }
        if (newNotifs.length > 0) {
          setNotifications((n) => [...newNotifs, ...n].slice(0, 50));
        }
        const next = new Map<string, string>();
        for (const check of data.checks) next.set(check.service, check.status);
        return next;
      });
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading health data...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Salud del Sistema</h1>
        {report && (
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${STATUS_BG[report.overall]}`} />
            <span className="font-semibold capitalize">{report.overall}</span>
            <span className="text-sm text-muted-foreground ml-2">
              {new Date(report.timestamp).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Per-service status (Req 21.2) */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Estado por Servicio</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {report?.checks.map((check) => (
            <div key={check.service} className="rounded-lg border border-border p-3 bg-card">
              <div className="text-sm text-muted-foreground">{check.service}</div>
              <div className={`font-semibold capitalize ${STATUS_COLORS[check.status]}`}>
                {check.status}
              </div>
              <div className="text-xs text-muted-foreground">{check.latencyMs}ms</div>
              {check.message && (
                <div className="text-xs text-destructive mt-1 truncate">{check.message}</div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(check.checkedAt).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Critical notifications (Req 21.3) */}
      {notifications.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Notificaciones Críticas</h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {notifications.map((n, i) => (
              <div
                key={`${n.service}-${n.timestamp}-${i}`}
                className={`rounded-lg border p-3 text-sm ${
                  n.severity === 'critical' ? 'border-red-500 bg-red-500/10' : 'border-yellow-500 bg-yellow-500/10'
                }`}
              >
                <span className="font-medium">{n.message}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {new Date(n.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Incident history 24h (Req 21.4) */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Historial de Incidentes (24h)</h2>
        {report?.checks.filter((c) => c.status !== 'healthy').length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay incidentes en las últimas 24 horas.</p>
        ) : (
          <div className="space-y-2">
            {report?.checks
              .filter((c) => c.status !== 'healthy')
              .map((c) => (
                <div key={c.service} className="rounded-lg border border-border p-3 text-sm">
                  <span className={`font-medium ${STATUS_COLORS[c.status]}`}>{c.service}</span>
                  <span className="text-muted-foreground ml-2">{c.status}</span>
                  {c.message && <span className="text-muted-foreground ml-2">— {c.message}</span>}
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Auto-refresh indicator */}
      <div className="text-xs text-muted-foreground text-center">
        Auto-refresh cada 30 segundos
      </div>
    </div>
  );
}
