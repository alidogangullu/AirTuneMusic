/**
 * Theme context: provides the app color palette.
 */

import React, {createContext, useContext} from 'react';
import type {AppColors} from './colors';
import {colors} from './colors';

type ThemeContextValue = {
  colors: AppColors;
};

const themeValue: ThemeContextValue = {colors};
const ThemeContext = createContext<ThemeContextValue>(themeValue);

export function ThemeProvider({
  children,
}: Readonly<{children: React.ReactNode}>): React.JSX.Element {
  return (
    <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
