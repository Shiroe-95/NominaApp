'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';

export interface ComparativeRow {
  label: string;
  periodA: number;
  periodB: number;
}

export interface ComparativeViewProps {
  periodALabel: string;
  periodBLabel: string;
  rows: ComparativeRow[];
  highlightThreshold?: number;
  className?: string;
}

export function ComparativeView({ periodALabel, periodBLabel, rows, highlightThreshold = 5, className }: ComparativeViewProps) {
  const getChange = (a: number, b: number) => {
    if (a === 0) return 0;
    return ((b - a) / a) * 100;
  };

  return (
    <div className={cn('rounded-xl border border-white/10 bg-[#181b26]', className)}>
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Period Comparison</h3>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-[#958da1]">
            <th className="px-4 py-3">Metric</th>
            <th className="px-4 py-3 text-right">{periodALabel}</th>
            <th className="px-4 py-3 text-right">{periodBLabel}</th>
            <th className="px-4 py-3 text-right">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const change = getChange(row.periodA, row.periodB);
            const isSignificant = Math.abs(change) > highlightThreshold;
            return (
              <tr key={i} className={cn('border-b border-white/5', isSignificant && 'bg-[#7C3AED]/5')}>
                <td className="px-4 py-3 text-white">{row.label}</td>
                <td className="px-4 py-3 text-right text-white/80">{row.periodA.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-white/80">{row.periodB.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <Badge variant={isSignificant ? (change > 0 ? 'destructive' : 'outline') : 'secondary'}>
                    {change > 0 ? '↑' : change < 0 ? '↓' : '—'} {Math.abs(change).toFixed(1)}%
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
