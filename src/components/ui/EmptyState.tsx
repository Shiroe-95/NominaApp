'use client';

import { Link } from '@/i18n/routing';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  /** Click handler for the action button */
  onAction?: () => void;
  /** Link href — when provided, renders a Link instead of a button (Req 2.5) */
  actionHref?: string;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  actionHref,
  className = '',
}: EmptyStateProps) {
  const actionClasses = `
    px-4 py-2 text-sm font-medium rounded-[var(--radius-sm)]
    bg-violet text-white hover:bg-violet-dark
    transition-all duration-200
    shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_20px_rgba(124,58,237,0.4)]
  `;

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in ${className}`}>
      {icon ? (
        <div className="w-16 h-16 rounded-full bg-violet/10 flex items-center justify-center text-violet-light mb-5">
          {icon}
        </div>
      ) : (
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
      )}

      <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 max-w-sm mb-5">{description}</p>
      )}

      {actionLabel && actionHref && (
        <Link href={actionHref as any} className={actionClasses}>
          {actionLabel}
        </Link>
      )}

      {actionLabel && onAction && !actionHref && (
        <button onClick={onAction} className={actionClasses}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
