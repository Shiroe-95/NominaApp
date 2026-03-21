'use client';

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  animated?: boolean;
  className?: string;
}

const VARIANT_COLORS: Record<string, string> = {
  default: 'bg-violet',
  success: 'bg-emerald',
  warning: 'bg-amber',
  danger:  'bg-rose',
};

const VARIANT_GLOWS: Record<string, string> = {
  default: 'shadow-[0_0_10px_rgba(124,58,237,0.4)]',
  success: 'shadow-[0_0_10px_rgba(16,185,129,0.4)]',
  warning: 'shadow-[0_0_10px_rgba(245,158,11,0.4)]',
  danger:  'shadow-[0_0_10px_rgba(225,29,72,0.4)]',
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  variant = 'default',
  animated = true,
  className = '',
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs font-medium text-slate-400">{label}</span>}
          {showPercentage && (
            <span className="text-xs font-semibold text-slate-300">{Math.round(pct)}%</span>
          )}
        </div>
      )}
      <div
        className="w-full h-2 rounded-full bg-white/5 overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={`
            h-full rounded-full transition-all duration-500 ease-out
            ${VARIANT_COLORS[variant]}
            ${animated ? VARIANT_GLOWS[variant] : ''}
            ${animated && pct > 0 && pct < 100
              ? 'bg-gradient-to-r from-current via-white/20 to-current bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]'
              : ''
            }
          `}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
