'use client';

export interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: { direction: 'up' | 'down'; value: string };
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ label, value, trend, icon, className = '' }: MetricCardProps) {
  return (
    <div
      className={`
        bg-[#1c1f2a]/60 backdrop-blur-md rounded-2xl p-5 border border-[#4a4455]/[0.1]
        transition-all duration-200 hover:border-[#4a4455]/[0.25]
        animate-fade-in ${className}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#958da1] mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-[#e0e2f1] truncate">{value}</p>
        </div>
        {icon && (
          <div className="shrink-0 w-10 h-10 rounded-xl bg-[#7C3AED]/10 flex items-center justify-center text-[#d2bbff]">
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={`
              inline-flex items-center gap-0.5 text-xs font-semibold
              ${trend.direction === 'up' ? 'text-[#4edea3]' : 'text-[#ffb3b6]'}
            `}
          >
            <svg
              className={`w-3.5 h-3.5 ${trend.direction === 'down' ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
            {trend.value}
          </span>
          <span className="text-[10px] text-[#4a4455]">vs período anterior</span>
        </div>
      )}
    </div>
  );
}
