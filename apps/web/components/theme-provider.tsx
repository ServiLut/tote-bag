'use client';

import * as React from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';
type Attribute = 'class' | `data-${string}` | Array<'class' | `data-${string}`>;

interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: Attribute;
  defaultTheme?: Theme;
  disableTransitionOnChange?: boolean;
  enableColorScheme?: boolean;
  enableSystem?: boolean;
  forcedTheme?: Theme;
  storageKey?: string;
  themes?: Theme[];
  value?: Partial<Record<Theme, string>>;
}

interface ThemeContextValue {
  forcedTheme?: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  systemTheme: ResolvedTheme;
  theme: Theme;
  themes: Theme[];
}

const DEFAULT_THEMES: Theme[] = ['light', 'dark'];

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined,
);

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'light';
}

function disableTransitions() {
  const style = document.createElement('style');
  style.appendChild(
    document.createTextNode(
      '*,*::before,*::after{transition:none!important}',
    ),
  );
  document.head.appendChild(style);

  return () => {
    window.getComputedStyle(document.body);
    window.setTimeout(() => document.head.removeChild(style), 1);
  };
}

export function ThemeProvider({
  attribute = 'data-theme',
  children,
  defaultTheme = 'system',
  disableTransitionOnChange = false,
  enableColorScheme = true,
  enableSystem = true,
  forcedTheme,
  storageKey = 'theme',
  themes = DEFAULT_THEMES,
  value,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>('light');
  const allThemes = React.useMemo<Theme[]>(
    () => (enableSystem ? [...themes, 'system'] : themes),
    [enableSystem, themes],
  );
  const activeTheme = forcedTheme ?? theme;
  const resolvedTheme: ResolvedTheme =
    activeTheme === 'dark'
      ? 'dark'
      : activeTheme === 'light'
        ? 'light'
        : systemTheme;

  const setTheme = React.useCallback<React.Dispatch<React.SetStateAction<Theme>>>(
    (nextTheme) => {
      setThemeState((currentTheme) => {
        const resolvedNextTheme =
          typeof nextTheme === 'function' ? nextTheme(currentTheme) : nextTheme;

        try {
          window.localStorage.setItem(storageKey, resolvedNextTheme);
        } catch {
          // Ignore storage failures and keep the in-memory theme.
        }

        return resolvedNextTheme;
      });
    },
    [storageKey],
  );

  React.useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(storageKey) as Theme | null;
      if (storedTheme && allThemes.includes(storedTheme)) {
        setThemeState(storedTheme);
      } else {
        setThemeState(defaultTheme);
      }
    } catch {
      setThemeState(defaultTheme);
    }
  }, [allThemes, defaultTheme, storageKey]);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => setSystemTheme(getSystemTheme());

    updateSystemTheme();
    mediaQuery.addEventListener('change', updateSystemTheme);

    return () => {
      mediaQuery.removeEventListener('change', updateSystemTheme);
    };
  }, []);

  React.useEffect(() => {
    const cleanupTransitions = disableTransitionOnChange
      ? disableTransitions()
      : undefined;
    const root = document.documentElement;
    const attributes = Array.isArray(attribute) ? attribute : [attribute];
    const classValues = allThemes
      .map((themeName) => value?.[themeName] ?? themeName)
      .filter(Boolean);
    const resolvedValue = value?.[resolvedTheme] ?? resolvedTheme;

    for (const themeAttribute of attributes) {
      if (themeAttribute === 'class') {
        root.classList.remove(...classValues);
        root.classList.add(resolvedValue);
      } else {
        root.setAttribute(themeAttribute, resolvedValue);
      }
    }

    if (enableColorScheme) {
      root.style.colorScheme = resolvedTheme;
    }

    cleanupTransitions?.();
  }, [
    allThemes,
    attribute,
    disableTransitionOnChange,
    enableColorScheme,
    resolvedTheme,
    value,
  ]);

  const contextValue = React.useMemo<ThemeContextValue>(
    () => ({
      forcedTheme,
      resolvedTheme,
      setTheme,
      systemTheme,
      theme,
      themes: allThemes,
    }),
    [allThemes, forcedTheme, resolvedTheme, setTheme, systemTheme, theme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
