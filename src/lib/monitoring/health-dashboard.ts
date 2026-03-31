/**
 * Health Dashboard — Service health state management, notifications, and incident history.
 *
 * Provides:
 * - Per-service health detail tracking (status, latency, last check, error message)
 * - Critical notifications when service status transitions (healthy→degraded/down)
 * - 24h incident history with aggregated metrics (uptime, avg latency, incident count)
 * - Integration with MetricsCollector for historical analysis
 *
 * Requirements: 21.1–21.5
 * Properties: 52, 53, 54, 55
 *
 * @module lib/monitoring/health-dashboard
 */

import type { ServiceHealthCheck, HealthReport, ServiceStatus } from './health-monitor';
import { metricsCollector } from './metrics-collector';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ServiceDetail {
  service: string;
  status: ServiceStatus;
  latencyMs: number;
  lastCheckAt: string;
  message: string | null;
}

export interface HealthNotification {
  id: string;
  service: string;
  previousStatus: ServiceStatus;
  newStatus: ServiceStatus;
  severity: 'critical' | 'warning';
  message: string;
  timestamp: string;
}

export interface HealthIncident {
  service: string;
  status: ServiceStatus;
  message: string | null;
  timestamp: string;
  latencyMs: number;
}

export interface AggregatedMetrics {
  service: string;
  uptimePercent: number;
  avgLatencyMs: number;
  incidentCount: number;
  totalChecks: number;
  successfulChecks: number;
}

// ─── HealthDashboardState ───────────────────────────────────────────────────

export class HealthDashboardState {
  private previousStatuses: Map<string, ServiceStatus> = new Map();
  private notifications: HealthNotification[] = [];
  private incidents: HealthIncident[] = [];
  private checkHistory: Map<string, { status: ServiceStatus; latencyMs: number; timestamp: string }[]> = new Map();

  /**
   * Extracts per-service details from a HealthReport.
   * Property 52: Each service must have status, latency, lastCheck, and message.
   */
  extractServiceDetails(report: HealthReport): ServiceDetail[] {
    return report.checks.map((check) => ({
      service: check.service,
      status: check.status,
      latencyMs: check.latencyMs,
      lastCheckAt: check.checkedAt,
      message: check.message,
    }));
  }

  /**
   * Processes a health report and generates notifications for status transitions.
   * Property 53: Notification created when service transitions from healthy to degraded/down.
   */
  processReport(report: HealthReport): HealthNotification[] {
    const newNotifications: HealthNotification[] = [];

    for (const check of report.checks) {
      const prev = this.previousStatuses.get(check.service);

      // Record in check history for aggregated metrics
      const history = this.checkHistory.get(check.service) ?? [];
      history.push({ status: check.status, latencyMs: check.latencyMs, timestamp: check.checkedAt });
      this.checkHistory.set(check.service, history);

      // Record incident if not healthy
      if (check.status !== 'healthy') {
        this.incidents.push({
          service: check.service,
          status: check.status,
          message: check.message,
          timestamp: check.checkedAt,
          latencyMs: check.latencyMs,
        });
      }

      // Generate notification on status transition
      if (prev && prev === 'healthy' && check.status !== 'healthy') {
        const notification: HealthNotification = {
          id: crypto.randomUUID(),
          service: check.service,
          previousStatus: prev,
          newStatus: check.status,
          severity: check.status === 'down' ? 'critical' : 'warning',
          message: `Service ${check.service} changed from ${prev} to ${check.status}${check.message ? ': ' + check.message : ''}`,
          timestamp: check.checkedAt,
        };
        newNotifications.push(notification);
        this.notifications.push(notification);
      }

      this.previousStatuses.set(check.service, check.status);

      // Integrate with MetricsCollector (Property 55)
      this.recordToMetricsCollector(check);
    }

    return newNotifications;
  }

  /**
   * Returns incidents from the last 24 hours.
   */
  getIncidentHistory(windowMs = 24 * 60 * 60 * 1000): HealthIncident[] {
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    return this.incidents.filter((i) => i.timestamp >= cutoff);
  }

  /**
   * Computes aggregated metrics for a service over a given window.
   * Property 54: uptime = (successful / total) * 100, avgLatency = mean, incidents = transitions to non-healthy.
   */
  getAggregatedMetrics(service: string, windowMs = 7 * 24 * 60 * 60 * 1000): AggregatedMetrics {
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    const history = (this.checkHistory.get(service) ?? []).filter((h) => h.timestamp >= cutoff);

    const totalChecks = history.length;
    const successfulChecks = history.filter((h) => h.status === 'healthy').length;
    const uptimePercent = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;
    const avgLatencyMs = totalChecks > 0
      ? history.reduce((sum, h) => sum + h.latencyMs, 0) / totalChecks
      : 0;

    // Count incidents as transitions to non-healthy
    let incidentCount = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i - 1].status === 'healthy' && history[i].status !== 'healthy') {
        incidentCount++;
      }
    }
    // Count first entry as incident if non-healthy
    if (history.length > 0 && history[0].status !== 'healthy') {
      incidentCount++;
    }

    return { service, uptimePercent, avgLatencyMs, incidentCount, totalChecks, successfulChecks };
  }

  /**
   * Records health check to MetricsCollector for historical analysis.
   * Property 55: Every health check must be registered with timestamp, service, status, latency.
   */
  private recordToMetricsCollector(check: ServiceHealthCheck): void {
    metricsCollector.recordAPIMetric({
      endpoint: `/health/${check.service}`,
      method: 'HEALTH_CHECK',
      statusCode: check.status === 'healthy' ? 200 : check.status === 'degraded' ? 503 : 500,
      latencyMs: check.latencyMs,
      timestamp: Date.now(),
    });
  }

  getNotifications(): HealthNotification[] {
    return [...this.notifications];
  }

  reset(): void {
    this.previousStatuses.clear();
    this.notifications = [];
    this.incidents = [];
    this.checkHistory.clear();
  }
}

export const healthDashboard = new HealthDashboardState();
