'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

    const handleInput = () => {
      const el = innerRef.current;
      if (el) {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      }
    };

    return (
      <textarea
        className={cn(
          'flex min-h-[60px] w-full rounded-lg border bg-[#181b26] px-3 py-2 text-sm text-white placeholder:text-slate-500 resize-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-red-500' : 'border-white/10',
          className
        )}
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        onInput={handleInput}
        aria-invalid={error || undefined}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
