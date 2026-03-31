'use client';

import { cn } from '@/lib/utils';

export interface BulkProgressBarProps {
  total: number;
  processed: number;
  failed: number;
  startedAt?: number;
  className?: string;
}

/**
 * Progress bar for bulk operations showing percentage, processed count,
 * and estimated time remaining.
 *
 * Requirements: 17.3
 */
export function BulkProgressBar({ total, processed, failed, startedAt, className }: BulkProgressBarProps) {
  const percent = total > 0 ? Math.round(((processed + failed) / total) * 100) : 0;
  const elapsed = startedAt ? (Date.now() - startedAt) / 1000 : 0;
  const rate = elapsed > 0 ? (processed + failed) / elapsed : 0;
  const remaining = rate > 0 ? Math.ceil((total - processed - failed) / rate) : 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-white">{percent}% complete</span>
        <span className="text-[#958da1]">
          {processed + failed}/{total} processed
          {failed > 0 && <span className="text-red-400 ml-2">({failed} failed)</span>}
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <div className="flex h-full">
          <div
            className="bg-[#7C3AED] transition-all duration-300"
            style={{ width: `${total > 0 ? (processed / total) * 100 : 0}%` }}
          />
          {failed > 0 && (
            <div
              className="bg-red-500 transition-all duration-300"
              style={{ width: `${(failed / total) * 100}%` }}
            />
          )}
        </div>
      </div>

      {remaining > 0 && (
        <p className="text-xs text-[#958da1]">
          ~{remaining}s remaining
        </p>
      )}
    </div>
  );
}
