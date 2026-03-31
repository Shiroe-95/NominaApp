/**
 * ThemeToggle — Selector de tema con iconos sol/luna/monitor.
 *
 * Renderiza un grupo de radio buttons para alternar entre los 3 modos
 * de tema: light (sol), dark (luna), auto (monitor).
 *
 * Usa lucide-react para los iconos según Requisito 7.6.
 */
'use client';

import * as React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type Theme } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';

const options: { value: Theme; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'auto', label: 'Auto', Icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn('inline-flex items-center rounded-lg bg-white/5 p-0.5', className)}
      role="radiogroup"
      aria-label="Theme selector"
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          onClick={() => setTheme(value)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
            theme === value
              ? 'bg-[var(--primary)]/20 text-white'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
