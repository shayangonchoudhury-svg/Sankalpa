import { useState, useEffect } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'sankalpa-theme';

export function getStoredTheme(): ThemePreference {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val;
    }
  } catch {
    // ignore
  }
  return 'system';
}

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(pref: ThemePreference) {
  if (typeof document === 'undefined') return;
  const resolved = pref === 'system' ? getSystemTheme() : pref;
  document.documentElement.setAttribute('data-theme', resolved);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    const current = getStoredTheme();
    return current === 'system' ? getSystemTheme() : current;
  });

  const setTheme = (newTheme: ThemePreference) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // ignore
    }
    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;
    setResolvedTheme(resolved);
    applyTheme(newTheme);
  };

  useEffect(() => {
    // Initial sync
    applyTheme(theme);

    // Listener for system changes when set to system
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const resolved = getSystemTheme();
        setResolvedTheme(resolved);
        document.documentElement.setAttribute('data-theme', resolved);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [theme]);

  return { theme, resolvedTheme, setTheme };
}
