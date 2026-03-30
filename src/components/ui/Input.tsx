'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, disabled, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-lg border bg-[#181b26] px-3 py-1 text-sm text-white placeholder:text-slate-500 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40 focus-visible:ring-offset-1',
          error
            ? 'border-red-500 focus-visible:ring-red-500/40'
            : 'border-white/10 hover:border-white/20',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
        disabled={disabled}
        ref={ref}
        aria-invalid={error || undefined}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
