import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createMMKV } from 'react-native-mmkv';
import type { AppColors } from './colors';
import { darkColors, lightColors } from './colors';

export type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  colors: AppColors;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

const storage = createMMKV({ id: 'theme' });
const THEME_KEY = 'themeMode';

function getSavedTheme(): ThemeMode {
  const saved = storage.getString(THEME_KEY);
  return saved === 'dark' ? 'dark' : 'light';
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  themeMode: 'light',
  setThemeMode: () => {},
});

export function ThemeProvider({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getSavedTheme);

  const persistTheme = useCallback((mode: ThemeMode) => {
    storage.set(THEME_KEY, mode);
    setThemeMode(mode);
  }, [setThemeMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: themeMode === 'dark' ? darkColors : lightColors,
      themeMode,
      setThemeMode: persistTheme,
    }),
    [themeMode, persistTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
