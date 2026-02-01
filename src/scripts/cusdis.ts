import { type ThemeState } from "../lib/theme-effects";
import { createEmbedSystem, type EmbedSystemConfig } from "../lib/embedSystem";
import { autoInit } from "../utils/spaLifecycle";

type CusdisGlobal = {
	setTheme?: (theme: "light" | "dark") => void;
	initial?: () => void;
};

declare global {
	interface Window {
		CUSDIS?: CusdisGlobal;
	}
}

interface CusdisConfig {
	container: HTMLElement;
	host: string;
	appId: string;
	pageId: string;
	pageTitle: string;
	theme: "light" | "dark";
}

const CONTAINER_SELECTOR = "[data-cusdis-host]";

// Create embed system configuration
const cusdisConfig: EmbedSystemConfig<CusdisConfig> = {
	scriptUrl: "", // Will be set dynamically based on host
	scriptAttr: "data-cusdis",
	containerSelector: CONTAINER_SELECTOR,

	createConfig: (container: HTMLElement, themeState: ThemeState): CusdisConfig => {
		const { cusdisHost, cusdisAppId, cusdisPageId, cusdisPageTitle } = container.dataset as {
			cusdisHost?: string;
			cusdisAppId?: string;
			cusdisPageId?: string;
			cusdisPageTitle?: string;
		};

		if (!cusdisHost || !cusdisAppId || !cusdisPageId) {
			throw new Error("Missing required Cusdis configuration");
		}

		const host = cusdisHost.replace(/\/$/, "");

		// Clear stale content from previous navigation
		container.innerHTML = "";

		// Set up the iframe container with data attributes
		container.setAttribute("data-host", host);
		container.setAttribute("data-app-id", cusdisAppId);
		container.setAttribute("data-page-id", cusdisPageId);
		container.setAttribute("data-page-title", cusdisPageTitle || document.title);
		container.setAttribute("data-theme", themeState.theme);

		return {
			container,
			host,
			appId: cusdisAppId,
			pageId: cusdisPageId,
			pageTitle: cusdisPageTitle || document.title,
			theme: themeState.theme,
		};
	},

	initialize: (config: CusdisConfig) => {
		// Update script URL dynamically based on host
		const normalizedHost = config.host.replace(/\/$/, "");
		const scriptUrl = `${normalizedHost}/js/cusdis.es.js`;

		// Check if script exists, if not create it
		let script = document.querySelector<HTMLScriptElement>(`script[data-cusdis]`);
		if (!script) {
			script = document.createElement("script");
			script.src = scriptUrl;
			script.async = true;
			script.setAttribute("data-cusdis", normalizedHost);
			document.head.appendChild(script);
		}

		const initializeCusdis = () => {
			if (window.CUSDIS?.initial) {
				window.CUSDIS.initial();
			}
		};

		if (window.CUSDIS) {
			initializeCusdis();
		} else {
			script?.addEventListener("load", initializeCusdis, { once: true });
		}
	},

	updateTheme: (themeState: ThemeState) => {
		// Update all containers
		const containers = document.querySelectorAll<HTMLElement>(CONTAINER_SELECTOR);
		containers.forEach((container) => {
			container.setAttribute("data-theme", themeState.theme);
		});
		// Update Cusdis theme
		window.CUSDIS?.setTheme?.(themeState.theme);
	},
};

// Create and initialize the embed system
const cusdisSystem = createEmbedSystem(cusdisConfig);

// Initialize using autoInit helper
autoInit(() => cusdisSystem.init(), "after-swap");
