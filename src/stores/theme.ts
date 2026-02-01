/**
 * Theme state atoms (pure state, no side effects)
 */

import { atom } from "nanostores";

export type ThemeName = "light" | "dark";
export type ThemePreference = ThemeName | "system";

export const STORAGE_KEY = "theme-preference";
export const DEFAULT_PREFERENCE: ThemePreference = "system";

// Nanostore atoms for theme state that persists across navigations
export const themePreference = atom<ThemePreference>(DEFAULT_PREFERENCE);
export const activeTheme = atom<ThemeName>("light");
export const isThemeInitialized = atom<boolean>(false);
