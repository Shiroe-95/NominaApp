/**
 * ThemeProvider — Motor de temas (Claro/Oscuro/Auto)
 *
 * Provee contexto de tema a toda la aplicación con soporte para:
 * - 3 modos: light, dark (Obsidian Ledger), auto (prefers-color-scheme)
 * - Persistencia en localStorage (key: nominasmart-theme)
 * - Detección de prefers-color-scheme con listener en tiempo real
 * - Transición < 100ms sin recarga de página via CSS custom properties
 *
 * Anti-FOUC: El script inline en layout.tsx aplica la clase antes del primer render.
 * Este provider sincroniza el estado React con lo que el script ya aplicó.
 *
 * Requisito 7: Motor de Temas
 */
'use client';

import * as React from 'react';

export type Theme = 'light' | 'dark' | 'auto';

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: 'auto',
  resolvedTheme: 'dark',
  setTheme: () => {},
});

export function useTheme(): ThemeContextValue {
  return React.useContext(ThemeContext);
}

export const STORAGE_KEY = 'nominasmart-theme';

/** All valid theme values for validation */
export const VALID_THEMES: readonly Theme[] = ['light', 'dark', 'auto'] as const;

function isValidTheme(value: unknown): value is Theme {
  return typeof value === 'string' && VALID_THEMES.includes(value as Theme);
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'auto' ? getSystemTheme() : theme;
}

function applyThemeClass(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    if (typeof window === 'undefined') return 'auto';
    const stored = localStorage.getItem(STORAGE_KEY);
    return isValidTheme(stored) ? stored : 'auto';
  });

  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial = isValidTheme(stored) ? stored : 'auto';
    return resolveTheme(initial);
  });

  // Sync on mount (SSR hydration)
  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial = isValidTheme(stored) ? stored : 'auto';
    setThemeState(initial);
    const resolved = resolveTheme(initial);
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  // Listen for system theme changes when in auto mode
  React.useEffect(() => {
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyThemeClass(resolved);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = React.useCallback((newTheme: Theme) => {
    if (!isValidTheme(newTheme)) return;
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
