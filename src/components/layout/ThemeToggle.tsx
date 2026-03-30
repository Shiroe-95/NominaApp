'use client';

import * as React from 'react';
import { useTheme, type Theme } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';

const options: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'auto', label: 'Auto', icon: '💻' },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn('inline-flex items-center rounded-lg bg-white/5 p-0.5', className)}
      role="radiogroup"
      aria-label="Theme selector"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={theme === opt.value}
          aria-label={opt.label}
          onClick={() => setTheme(opt.value)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
            theme === opt.value
              ? 'bg-[#7C3AED]/20 text-white'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <span aria-hidden="true">{opt.icon}</span>
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
