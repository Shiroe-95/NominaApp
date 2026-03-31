/**
 * WorkerProgress — Progress indicator for Web Worker tasks.
 *
 * Shows a progress bar with percentage and a cancel button.
 * Used when heavy computations (Excel parsing, anomaly detection, forecasting)
 * are running in a Web Worker.
 *
 * Requirements: 3.4, 3.7
 *
 * @module components/ui/WorkerProgress
 */

'use client';

import { X } from 'lucide-react';
import { ProgressBar } from './ProgressBar';

export interface WorkerProgressProps {
  /** Current progress percentage (0–100). */
  percent: number;
  /** Label describing the current operation. */
  label?: string;
  /** Called when the user clicks the cancel button. */
  onCancel?: () => void;
  /** Whether the cancel button is visible. Defaults to true. */
  showCancel?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Displays a progress bar with percentage and an optional cancel button
 * for long-running Web Worker tasks.
 */
export function WorkerProgress({
  percent,
  label,
  onCancel,
  showCancel = true,
  className = '',
}: WorkerProgressProps) {
  const isComplete = percent >= 100;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex-1 min-w-0">
        <ProgressBar
          value={percent}
          label={label}
          showPercentage
          variant={isComplete ? 'success' : 'default'}
          animated={!isComplete}
        />
      </div>

      {showCancel && !isComplete && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="flex-shrink-0 rounded-md p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
          aria-label="Cancelar operación"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
