import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error';
}

const variantClasses: Record<string, string> = {
  info: 'border-blue-500/30 bg-blue-950/30 text-blue-300',
  success: 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-950/30 text-amber-300',
  error: 'border-red-500/30 bg-red-950/30 text-red-300',
};

const iconMap: Record<string, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✕',
};

export function Alert({ variant = 'info', className, children, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn('flex items-start gap-3 rounded-lg border p-4 text-sm', variantClasses[variant], className)}
      {...props}
    >
      <span className="mt-0.5 shrink-0 text-base" aria-hidden="true">{iconMap[variant]}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm opacity-90', className)} {...props} />;
}
