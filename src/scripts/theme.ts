import { activeTheme, themePreference, cycleTheme, type ThemeState, type ThemeName } from "../stores/theme";

export type { ThemeState };

type Listener = (state: ThemeState) => void;

const listeners = new Set<Listener>();

// Helper to get theme state from nanostores
export const getThemeState = (): ThemeState => ({
	theme: activeTheme.get(),
	preference: themePreference.get(),
});

export const getActiveTheme = () => activeTheme.get();
export const getThemePreference = () => themePreference.get();

// Export ThemeName for compatibility
export type { ThemeName };

// Initialize theme and return state for compatibility with remark42 and cusdis
export const initTheme = (): ThemeState => getThemeState();

export const setThemePreference = (preference: "light" | "dark" | "system") => {
	themePreference.set(preference);
};

// Subscribe to theme changes
export const onThemeChange = (listener: Listener) => {
	listeners.add(listener);
	listener(getThemeState());

	// Subscribe to nanostore changes
	const unsubscribeTheme = activeTheme.subscribe(() => {
		listener(getThemeState());
	});

	return () => {
		listeners.delete(listener);
		unsubscribeTheme();
	};
};

const preferenceLabel = {
	light: "Light Mode",
	dark: "Dark Mode",
	system: "System",
} satisfies Record<"light" | "dark" | "system", string>;

const cyclePreference = (preference: "light" | "dark" | "system"): "light" | "dark" | "system" => {
	switch (preference) {
		case "system":
			return "light";
		case "light":
			return "dark";
		default:
			return "system";
	}
};

const describeState = (state: ThemeState) => {
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
