/**
 * Theme side effects and initialization (client-only)
 */

import { activeTheme, isThemeInitialized, themePreference } from "../stores/theme";
import type { ThemeName, ThemePreference, ThemeState } from "./theme-core";
import { calculateTheme, cyclePreference, describeState, getSystemTheme, isValidPreference } from "./theme-core";

export type { ThemeName, ThemePreference, ThemeState };

const STORAGE_KEY = "theme-preference";

type Listener = (state: ThemeState) => void;
const listeners = new Set<Listener>();

/**
 * Apply theme to the DOM
 */
const applyTheme = (theme: ThemeName, preference: ThemePreference) => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.themeMode = preference;
};

/**
 * Initialize the theme system (call once on app start)
 */
export const initTheme = (): ThemeState => {
    // Guard against double initialization
    if (isThemeInitialized.get()) {
        return getThemeState();
    }

    // Read initial preference from localStorage
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (isValidPreference(stored)) {
            themePreference.set(stored);
        }
    } catch {
        // Ignore localStorage errors
    }

    // Calculate and apply initial theme
    const preference = themePreference.get();
    const theme = calculateTheme(preference);
    activeTheme.set(theme);
    applyTheme(theme, preference);

    isThemeInitialized.set(true);

    // Listen for preference changes and update active theme + document
    themePreference.subscribe((preference) => {
        const theme = calculateTheme(preference);
        activeTheme.set(theme);
        applyTheme(theme, preference);

        // Persist to localStorage
        try {
            localStorage.setItem(STORAGE_KEY, preference);
        } catch {
            // Ignore localStorage errors
        }

        // Notify listeners
        const state = { theme, preference };
        listeners.forEach((listener) => {
            listener(state);
        });
    });

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleMediaChange = (event: MediaQueryListEvent) => {
        if (themePreference.get() === "system") {
            const newTheme = (event.matches ? "dark" : "light") as ThemeName;
            activeTheme.set(newTheme);
            applyTheme(newTheme, "system");

            // Notify listeners
            const state = { theme: newTheme, preference: "system" as ThemePreference };
            listeners.forEach((listener) => {
                listener(state);
            });
        }
    };

    if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", handleMediaChange);
    } else {
        // Legacy Safari support
        const legacyAddListener = Reflect.get(mediaQuery, "addListener");
        if (typeof legacyAddListener === "function") {
            legacyAddListener.call(mediaQuery, handleMediaChange);
        }
    }

    // Ensure theme is re-applied before DOM swap to prevent flash
    document.addEventListener("astro:before-swap", () => {
        const theme = activeTheme.get();
        const preference = themePreference.get();
        applyTheme(theme, preference);
    });

    // Also apply after swap as a backup
    document.addEventListener("astro:after-swap", () => {
        const theme = activeTheme.get();
        const preference = themePreference.get();
        applyTheme(theme, preference);
    });

    return getThemeState();
};

/**
 * Get the current theme state
 */
export const getThemeState = (): ThemeState => ({
    theme: activeTheme.get(),
    preference: themePreference.get(),
});

/**
 * Set the theme preference (triggers side effects)
 */
export const setThemePreference = (preference: ThemePreference) => {
    themePreference.set(preference);
};

/**
 * Cycle to the next theme preference
 */
export const cycleTheme = () => {
    const current = themePreference.get();
    setThemePreference(cyclePreference(current));
};

/**
 * Subscribe to theme changes
 */
export const onThemeChange = (listener: Listener) => {
    listeners.add(listener);
    listener(getThemeState());

    // Subscribe to nanostore changes
    const unsubscribeTheme = themePreference.subscribe(() => {
        listener(getThemeState());
    });

    return () => {
        listeners.delete(listener);
        unsubscribeTheme();
    };
};

/**
 * Bind theme toggle buttons to the theme system
 */
export const bindThemeToggles = (root: ParentNode = document) => {
    const toggles = Array.from(root.querySelectorAll<HTMLElement>("[data-theme-toggle]"));
    if (!toggles.length) return;

    // Filter to only unbound toggles to prevent duplicate listeners
    const unboundToggles = toggles.filter((t) => !t.dataset.themeBound);

    const update = (state: ThemeState) => {
        const { nextPreference, message } = describeState(state);
        // Always update ALL toggles (including previously bound ones)
        toggles.forEach((toggle) => {
            toggle.dataset.themePreference = state.preference;
            toggle.dataset.themeState = state.theme;
            toggle.dataset.themeNext = nextPreference;
            toggle.setAttribute("aria-label", message);
            toggle.setAttribute("title", message);

            const srLabel = toggle.querySelector<HTMLElement>("[data-theme-toggle-label]");
            if (srLabel) {
                srLabel.textContent = message;
            }
        });
    };

    const handleClick = (event: Event) => {
        event.preventDefault();
        cycleTheme();
    };

    unboundToggles.forEach((toggle) => {
        toggle.dataset.themeBound = "true";
        toggle.addEventListener("click", handleClick);
    });

    // Initial update
    update(getThemeState());

    // Subscribe to changes
    const unsubscribe = onThemeChange(update);

    return () => {
        unsubscribe();
        unboundToggles.forEach((toggle) => {
            delete toggle.dataset.themeBound;
            toggle.removeEventListener("click", handleClick);
        });
    };
};
