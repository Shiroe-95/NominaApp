'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, Terminal, ArrowRight } from 'lucide-react';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { colors, spacing, elevation } from '@/lib/design-tokens';
import type { LogEntry } from '@/lib/types/pipeline';

export interface LiveLogsPanelProps {
  logs: LogEntry[];
  onClear: () => void;
  maxHeight?: string;
}

/**
 * Panel de logs en tiempo real para el dashboard.
 *
 * Muestra entradas de log con timestamp formateado, avatar del agente,
 * mensaje y metadata. Diferencia visualmente los tipos de entrada y
 * hace auto-scroll hacia la entrada más reciente.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6
 */
export function LiveLogsPanel({ logs, onClear, maxHeight = '400px' }: LiveLogsPanelProps) {
  const t = useTranslations('Dashboard.logs');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs.length]);

  return (
    <Card data-testid="live-logs-panel" style={{ boxShadow: elevation.low }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Terminal className="h-4 w-4" style={{ color: colors.primary }} />
          {t('title')}
        </CardTitle>
        {logs.length > 0 && (
          <Button
            data-testid="logs-clear-button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onClear}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            {t('clear')}
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {logs.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            ref={scrollRef}
            className="overflow-y-auto flex flex-col"
            style={{ maxHeight, gap: spacing.xs }}
          >
            {logs.map((entry) => (
              <LogEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


/** Estado vacío cuando no hay entradas de log. */
function EmptyState() {
  const t = useTranslations('Dashboard.logs');

  return (
    <div
      data-testid="logs-empty-state"
      className="flex flex-col items-center text-center py-6"
      style={{ gap: spacing.md }}
    >
      <div
        className="rounded-full p-3"
        style={{ backgroundColor: `${colors.primary}15` }}
      >
        <Terminal className="h-6 w-6" style={{ color: colors.primary }} />
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: colors.onSurface }}>
          {t('emptyTitle')}
        </p>
        <p className="text-xs mt-1" style={{ color: `${colors.onSurface}99` }}>
          {t('emptyDescription')}
        </p>
      </div>
    </div>
  );
}

/** Color accent por tipo de entrada de log. */
function getEntryColor(type: LogEntry['type']): string {
  switch (type) {
    case 'agent-complete':
      return colors.success;
    case 'error':
      return colors.error;
    case 'agent-communication':
      return '#60a5fa'; // blue accent
    case 'agent-start':
    default:
      return `${colors.onSurface}88`;
  }
}

/** Formatea un timestamp epoch ms a HH:MM:SS. */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toTimeString().slice(0, 8); // HH:MM:SS
}

/** Fila individual de una entrada de log. */
function LogEntryRow({ entry }: { entry: LogEntry }) {
  const t = useTranslations('Dashboard.logs');
  const accentColor = getEntryColor(entry.type);

  return (
    <div
      data-testid={`log-entry-${entry.id}`}
      className="flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors"
      style={{ backgroundColor: colors.surfaceContainer.low }}
    >
      {/* Color indicator bar */}
      <div
        className="w-0.5 self-stretch rounded-full shrink-0 mt-0.5"
        style={{ backgroundColor: accentColor }}
      />

      {/* Agent avatar or type icon */}
      <div className="shrink-0 pt-0.5">
        {entry.agentId ? (
          <AgentAvatar agentId={entry.agentId} size={22} animate={false} />
        ) : (
          <div
            className="w-[22px] h-[22px] rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}22` }}
          >
            <Terminal className="w-3 h-3" style={{ color: accentColor }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {/* Timestamp */}
          <span
            className="text-[10px] font-mono shrink-0"
            style={{ color: `${colors.onSurface}66` }}
          >
            {formatTimestamp(entry.timestamp)}
          </span>

          {/* Type badge */}
          <span
            className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              color: accentColor,
              backgroundColor: `${accentColor}15`,
            }}
          >
            {t(`type_${entry.type}`)}
          </span>

          {entry.agentName && (
            <span
              className="text-[10px] font-medium truncate"
              style={{ color: `${colors.onSurface}aa` }}
            >
              {entry.agentName}
            </span>
          )}
        </div>

        {/* Message */}
        <p
          className="text-xs leading-relaxed"
          style={{ color: colors.onSurface }}
        >
          {entry.message}
        </p>

        {/* Metadata for agent-complete: tokens + latency */}
        {entry.type === 'agent-complete' && entry.metadata && (
          <div className="flex items-center gap-3 mt-1">
            {entry.metadata.tokensUsed != null && (
              <span
                className="text-[10px]"
                style={{ color: `${colors.onSurface}77` }}
              >
                {t('tokens', { count: entry.metadata.tokensUsed })}
              </span>
            )}
            {entry.metadata.latencyMs != null && (
              <span
                className="text-[10px]"
                style={{ color: `${colors.onSurface}77` }}
              >
                {t('latency', { ms: entry.metadata.latencyMs })}
              </span>
            )}
          </div>
        )}

        {/* Metadata for agent-communication: from → to */}
        {entry.type === 'agent-communication' && entry.metadata?.fromAgent && entry.metadata?.toAgent && (
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="text-[10px] font-medium"
              style={{ color: `${colors.onSurface}aa` }}
            >
              {entry.metadata.fromAgent}
            </span>
            <ArrowRight className="w-3 h-3" style={{ color: `${colors.onSurface}55` }} />
            <span
              className="text-[10px] font-medium"
              style={{ color: `${colors.onSurface}aa` }}
            >
              {entry.metadata.toAgent}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
