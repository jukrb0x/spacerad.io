/**
 * Pure theme functions (SSR-safe, no side effects)
 */

export type ThemeName = "light" | "dark";
export type ThemePreference = ThemeName | "system";

export interface ThemeState {
	theme: ThemeName;
	preference: ThemePreference;
}

/**
 * Get the system's preferred color scheme
 */
export const getSystemTheme = (): ThemeName => {
	if (typeof window === "undefined" || !window.matchMedia) {
		return "light";
	}
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

/**
 * Calculate the active theme based on preference
 */
export const calculateTheme = (preference: ThemePreference, systemTheme?: ThemeName): ThemeName => {
	if (preference === "system") {
		return systemTheme ?? getSystemTheme();
	}
	return preference;
};

/**
 * Cycle to the next preference in the sequence: system → light → dark → system
 */
export const cyclePreference = (preference: ThemePreference): ThemePreference => {
	switch (preference) {
		case "system":
			return "light";
		case "light":
			return "dark";
		default:
			return "system";
	}
};

/**
 * Type guard to check if a value is a valid preference
 */
export const isValidPreference = (value: unknown): value is ThemePreference => {
	return value === "light" || value === "dark" || value === "system";
};

/**
 * Human-readable labels for each preference
 */
export const preferenceLabel = {
	light: "Light Mode",
	dark: "Dark Mode",
	system: "System",
} satisfies Record<ThemePreference, string>;

/**
 * Generate UI description for current theme state
 */
export const describeState = (state: ThemeState) => {
	const { preference, theme } = state;
	const nextPreference = cyclePreference(preference);
	const currentLabel =
		preference === "system"
			? `${preferenceLabel.system} (currently ${theme === "dark" ? "dark" : "light"})`
			: preferenceLabel[preference];

	return {
		nextPreference,
		message: `Current theme: ${currentLabel}. Click to switch to ${preferenceLabel[nextPreference]}`,
	};
};
