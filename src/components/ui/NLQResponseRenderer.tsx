'use client';

/**
 * NLQ Response Renderer
 *
 * Renders enriched NLQ responses in the AI sidebar:
 * - Tables for tabular data
 * - Highlighted metrics for individual values
 * - Inline bar charts for comparisons
 * - Clarification buttons for ambiguous queries
 * - Data source badges
 *
 * Requirements: 12.2, 12.3, 12.6
 */

import { colors } from '@/lib/design-tokens';
import type {
  NLQResponse,
  NLQDataSource,
  NLQClarificationOption,
} from '@/lib/ai/nlq-response-handler';

interface NLQResponseRendererProps {
  response: NLQResponse;
  onClarificationSelect?: (option: NLQClarificationOption) => void;
}

/** Renders a single NLQ metric card */
function MetricCard({ label, value, unit, trend }: {
  label: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
}) {
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? colors.success : trend === 'down' ? '#ef4444' : '#958ea0';

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-1"
      style={{ backgroundColor: colors.surfaceContainer.high }}
    >
      <span className="text-[10px] uppercase tracking-wider" style={{ color: '#958ea0' }}>
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold" style={{ color: colors.onSurface }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-xs" style={{ color: '#958ea0' }}>{unit}</span>}
        {trend && (
          <span className="text-xs font-medium" style={{ color: trendColor }}>
            {trendIcon}
          </span>
        )}
      </div>
    </div>
  );
}

/** Renders a data table from NLQ response */
function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg" style={{ backgroundColor: colors.surfaceContainer.high }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(73,68,84,0.3)' }}>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold" style={{ color: '#958ea0' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid rgba(73,68,84,0.15)' }}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2" style={{ color: colors.onSurface }}>
                  {typeof cell === 'number' ? cell.toLocaleString() : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Renders an inline bar chart from NLQ response */
function InlineChart({ data }: { data: { label: string; value: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex flex-col gap-2 py-1">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] w-20 truncate text-right" style={{ color: '#958ea0' }}>
            {d.label}
          </span>
          <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(73,68,84,0.2)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(d.value / maxVal) * 100}%`,
                background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`,
              }}
            />
          </div>
          <span className="text-[10px] w-16 text-right font-medium" style={{ color: colors.onSurface }}>
            {d.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Renders clarification buttons for ambiguous queries */
function ClarificationButtons({ options, onSelect }: {
  options: NLQClarificationOption[];
  onSelect?: (option: NLQClarificationOption) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: '#958ea0' }}>
        ¿Qué quieres consultar?
      </span>
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onSelect?.(opt)}
          className="text-left text-xs px-3 py-2.5 rounded-lg transition-colors"
          style={{ backgroundColor: colors.surfaceContainer.default, color: '#cbc3d7' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.surfaceContainer.high;
            e.currentTarget.style.color = colors.secondary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.surfaceContainer.default;
            e.currentTarget.style.color = '#cbc3d7';
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Renders data source badges */
function SourceBadges({ sources }: { sources: NLQDataSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      <span className="text-[10px]" style={{ color: '#958ea0' }}>Fuentes:</span>
      {sources.map((s, i) => (
        <span
          key={i}
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'rgba(73,68,84,0.3)', color: '#958ea0' }}
        >
          {s.table}{s.period ? ` · ${s.period}` : ''}{s.company ? ` · ${s.company}` : ''}
        </span>
      ))}
    </div>
  );
}

/** Main NLQ response renderer component */
export default function NLQResponseRenderer({ response, onClarificationSelect }: NLQResponseRendererProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Text response */}
      {response.text && (
        <p className="text-sm whitespace-pre-line leading-relaxed" style={{ color: '#cbc3d7' }}>
          {response.text}
        </p>
      )}

      {/* Metrics */}
      {response.metrics && response.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {response.metrics.map((m, i) => (
            <MetricCard key={i} {...m} />
          ))}
        </div>
      )}

      {/* Table */}
      {response.table && (
        <DataTable headers={response.table.headers} rows={response.table.rows} />
      )}

      {/* Chart */}
      {response.chart && response.chart.length > 0 && (
        <InlineChart data={response.chart} />
      )}

      {/* Clarification */}
      {response.clarificationOptions && response.clarificationOptions.length > 0 && (
        <ClarificationButtons
          options={response.clarificationOptions}
          onSelect={onClarificationSelect}
        />
      )}

      {/* Data sources */}
      <SourceBadges sources={response.sources} />
    </div>
  );
}
