import { atom } from "nanostores";

export type ThemeName = "light" | "dark";
export type ThemePreference = ThemeName | "system";

const STORAGE_KEY = "theme-preference";

const DEFAULT_PREFERENCE: ThemePreference = "system";

// Store for theme state that persists across navigations
export const themePreference = atom<ThemePreference>(DEFAULT_PREFERENCE);
export const activeTheme = atom<ThemeName>("light");
export const isThemeInitialized = atom<boolean>(false);

// Initialize from localStorage on client
const isClient = typeof window !== "undefined" && typeof document !== "undefined";

if (isClient) {
	// Read initial preference
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === "light" || stored === "dark" || stored === "system") {
			themePreference.set(stored);
		}
	} catch {
		// Ignore localStorage errors
	}

	// Calculate initial theme
	const getSystemTheme = (): ThemeName =>
		window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

	const calculateTheme = (preference: ThemePreference): ThemeName => {
		if (preference === "system") {
			return getSystemTheme();
		}
		return preference;
	};

	const preference = themePreference.get();
	activeTheme.set(calculateTheme(preference));

	// Apply theme to document
	const applyTheme = (theme: ThemeName, preference: ThemePreference) => {
		const root = document.documentElement;
		root.dataset.theme = theme;
		root.dataset.themeMode = preference;
	};

	// Apply initial theme
	applyTheme(activeTheme.get(), themePreference.get());

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
	});

	// Listen for system theme changes
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	const handleMediaChange = (event: MediaQueryListEvent) => {
		if (themePreference.get() === "system") {
			const newTheme = event.matches ? "dark" : "light";
			activeTheme.set(newTheme);
			applyTheme(newTheme, "system");
		}
	};

	if (typeof mediaQuery.addEventListener === "function") {
		mediaQuery.addEventListener("change", handleMediaChange);
	} else {
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
}

export const setThemePreference = (preference: ThemePreference) => {
	themePreference.set(preference);
};

export const getThemeState = () => ({
	theme: activeTheme.get(),
	preference: themePreference.get(),
});

// Helper to cycle through preferences
const cyclePreference = (preference: ThemePreference): ThemePreference => {
	switch (preference) {
		case "system":
			return "light";
		case "light":
			return "dark";
		default:
			return "system";
	}
};

export const cycleTheme = () => {
	const current = themePreference.get();
	setThemePreference(cyclePreference(current));
};
