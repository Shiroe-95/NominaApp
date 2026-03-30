'use client';

import * as React from 'react';

export type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: 'auto',
  resolvedTheme: 'dark',
  setTheme: () => {},
});

export function useTheme() {
  return React.useContext(ThemeContext);
}

const STORAGE_KEY = 'nominasmart-theme';

const semanticTokens = {
  light: {
    '--background': '255 255 255',
    '--foreground': '15 23 42',
    '--primary': '124 58 237',
    '--primary-foreground': '255 255 255',
    '--secondary': '241 245 249',
    '--secondary-foreground': '15 23 42',
    '--muted': '241 245 249',
    '--muted-foreground': '100 116 139',
    '--accent': '241 245 249',
    '--accent-foreground': '15 23 42',
    '--destructive': '225 29 72',
    '--destructive-foreground': '255 255 255',
    '--border': '226 232 240',
    '--ring': '124 58 237',
  },
  dark: {
    '--background': '19 21 30',
    '--foreground': '226 232 240',
    '--primary': '124 58 237',
    '--primary-foreground': '255 255 255',
    '--secondary': '24 27 38',
    '--secondary-foreground': '204 195 216',
    '--muted': '28 31 42',
    '--muted-foreground': '149 141 161',
    '--accent': '28 31 42',
    '--accent-foreground': '226 232 240',
    '--destructive': '225 29 72',
    '--destructive-foreground': '255 255 255',
    '--border': '255 255 255 / 0.1',
    '--ring': '124 58 237',
  },
} as const;

function applyTokens(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  const tokens = semanticTokens[resolved];
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>('auto');
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>('dark');

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored || 'auto';
    setThemeState(initial);
    const resolved = initial === 'auto' ? getSystemTheme() : initial;
    setResolvedTheme(resolved);
    applyTokens(resolved);
  }, []);

  React.useEffect(() => {
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyTokens(resolved);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    const resolved = newTheme === 'auto' ? getSystemTheme() : newTheme;
    setResolvedTheme(resolved);
    applyTokens(resolved);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
