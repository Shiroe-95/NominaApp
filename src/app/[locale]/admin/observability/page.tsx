/**
 * Admin Observability Panel — API metrics, service status, cache hit rate, webhook queue.
 *
 * Requirements: 34.3
 * @module app/[locale]/admin/observability/page
 */

import { metricsCollector } from '@/lib/monitoring/metrics-collector';
import { runHealthChecks } from '@/lib/monitoring/health-monitor';

export const dynamic = 'force-dynamic';

export default async function ObservabilityPage() {
  const [metrics, health] = await Promise.all([
    Promise.resolve(metricsCollector.getSummary(300_000)),
    runHealthChecks({ timeoutMs: 3000 }),
  ]);

  const apiEndpoints = Object.entries(metrics.api);
  const cacheRate = (metrics.cache.hitRate * 100).toFixed(1);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Observability</h1>

      {/* Service Status */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Service Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {health.checks.map((check) => (
            <div
              key={check.service}
              className="rounded-lg border p-3"
            >
              <div className="text-sm text-muted-foreground">{check.service}</div>
              <div className={`font-semibold ${
                check.status === 'healthy' ? 'text-green-600' :
                check.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {check.status}
              </div>
              <div className="text-xs text-muted-foreground">{check.latencyMs}ms</div>
            </div>
          ))}
        </div>
      </section>

      {/* Cache Hit Rate */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Cache Performance</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-sm text-muted-foreground">Hit Rate</div>
            <div className="text-2xl font-bold">{cacheRate}%</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-sm text-muted-foreground">Hits / Misses</div>
            <div className="text-2xl font-bold">{metrics.cache.hits} / {metrics.cache.misses}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-sm text-muted-foreground">Errors</div>
            <div className="text-2xl font-bold">{metrics.cache.errors}</div>
          </div>
        </div>
      </section>

      {/* API Metrics */}
      <section>
        <h2 className="text-lg font-semibold mb-3">API Metrics (5min window)</h2>
        {apiEndpoints.length === 0 ? (
          <p className="text-muted-foreground">No API traffic recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Endpoint</th>
                  <th className="text-right p-2">p50</th>
                  <th className="text-right p-2">p95</th>
                  <th className="text-right p-2">p99</th>
                  <th className="text-right p-2">Req/s</th>
                  <th className="text-right p-2">Error Rate</th>
                </tr>
              </thead>
              <tbody>
                {apiEndpoints.map(([endpoint, stats]) => (
                  <tr key={endpoint} className="border-b">
                    <td className="p-2 font-mono text-xs">{endpoint}</td>
                    <td className="text-right p-2">{stats.p50.toFixed(0)}ms</td>
                    <td className="text-right p-2">{stats.p95.toFixed(0)}ms</td>
                    <td className="text-right p-2">{stats.p99.toFixed(0)}ms</td>
                    <td className="text-right p-2">{stats.requestsPerSecond.toFixed(2)}</td>
                    <td className="text-right p-2">{(stats.errorRate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Rate Limiting */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Rate Limiting</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-sm text-muted-foreground">Total Requests</div>
            <div className="text-2xl font-bold">{metrics.rateLimit.totalRequests}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-sm text-muted-foreground">Blocked</div>
            <div className="text-2xl font-bold">{metrics.rateLimit.limitedRequests}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-sm text-muted-foreground">Block Rate</div>
            <div className="text-2xl font-bold">{(metrics.rateLimit.limitRate * 100).toFixed(1)}%</div>
          </div>
        </div>
      </section>

      {/* Overall Status */}
      <section className="rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${
            health.overall === 'healthy' ? 'bg-green-500' :
            health.overall === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
          <span className="font-semibold">Overall: {health.overall}</span>
          <span className="text-sm text-muted-foreground ml-auto">
            Last checked: {new Date(health.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </section>
    </div>
  );
}
