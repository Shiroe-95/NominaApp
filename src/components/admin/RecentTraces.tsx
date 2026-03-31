/**
 * RecentTraces — "Traces Recientes" view for the Health Dashboard.
 *
 * Shows the last 50 API requests with expandable detail (spans, duration, status).
 *
 * Requirements: 23.5
 * @module components/admin/RecentTraces
 */
'use client';

import React, { useState } from 'react';

interface TraceSummary {
  traceId: string;
  totalDuration: number;
  spanCount: number;
  status: 'ok' | 'error';
  operations: string[];
  startTime: string;
}

interface RecentTracesProps {
  traces: TraceSummary[];
}

export function RecentTraces({ traces }: RecentTracesProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Traces Recientes</h2>
      {traces.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay traces recientes.</p>
      ) : (
        <div className="space-y-1">
          {traces.map((trace) => (
            <div key={trace.traceId} className="border border-border rounded-lg">
              <button
                className="w-full flex items-center justify-between p-3 text-sm hover:bg-accent/50"
                onClick={() => setExpandedId(expandedId === trace.traceId ? null : trace.traceId)}
              >
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${trace.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <code className="text-xs font-mono">{trace.traceId.slice(0, 8)}...</code>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>{trace.spanCount} spans</span>
                  <span>{trace.totalDuration}ms</span>
                  <span>{new Date(trace.startTime).toLocaleTimeString()}</span>
                </div>
              </button>
              {expandedId === trace.traceId && (
                <div className="border-t border-border p-3 bg-muted/30">
                  <div className="text-xs space-y-1">
                    <div><span className="text-muted-foreground">Trace ID:</span> <code>{trace.traceId}</code></div>
                    <div><span className="text-muted-foreground">Duration:</span> {trace.totalDuration}ms</div>
                    <div><span className="text-muted-foreground">Status:</span> <span className={trace.status === 'ok' ? 'text-green-500' : 'text-red-500'}>{trace.status}</span></div>
                    <div className="mt-2">
                      <span className="text-muted-foreground">Operations:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {trace.operations.map((op, i) => (
                          <span key={i} className="px-2 py-0.5 bg-accent rounded text-xs">{op}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
