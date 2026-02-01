import { type ThemeName, type ThemeState } from "../lib/theme-effects";
import { createEmbedSystem, type EmbedSystemConfig } from "../lib/embedSystem";
import { autoInit } from "../utils/spaLifecycle";

type Remark42Config = {
	host: string;
	site_id: string;
	url: string;
	components: string[];
	theme: ThemeName;
	locale: string;
	show_email_subscription: boolean;
	simple_view: boolean;
	no_footer: boolean;
};

type Remark42Global = {
	createInstance?: (config: Remark42Config) => void;
	changeTheme?: (theme: ThemeName) => void;
	destroy?: () => void;
};

declare global {
	interface Window {
		REMARK42?: Remark42Global;
		remark_config?: Remark42Config;
	}
}

const CONTAINER_SELECTOR = "[data-remark-host]";

const destroyRemark42 = () => {
	try {
		window.REMARK42?.destroy?.();
	} catch {
		// Remark42 might not have destroy in all versions
	}

	// Remove stale iframes from previous instance
	const container = document.getElementById("remark42");
	if (container) {
		const iframes = container.querySelectorAll("iframe");
		iframes.forEach((iframe) => iframe.remove());
	}
};

/**
 * Get the Remark42 host URL from the container
 */
function getRemark42Host(): string {
	const container = document.querySelector<HTMLElement>(CONTAINER_SELECTOR);
	const remarkHost = container?.dataset.remarkHost;

	if (!remarkHost) {
		console.warn("Remark42: No host found, using default");
		return "https://remark42.example.com";
	}

	return remarkHost.replace(/\/$/, "");
}

/**
 * Initialize Remark42
 * Note: We need to determine the script URL before creating the embed system
 * because Remark42 uses a dynamic script URL based on the host
 */
function initRemark42System() {
	const host = getRemark42Host();
	const scriptUrl = `${host}/web/embed.js`;

	// Create embed system configuration
	const remark42Config: EmbedSystemConfig<Remark42Config> = {
		scriptUrl,
		scriptAttr: "data-remark42",
		containerSelector: CONTAINER_SELECTOR,

		createConfig: (container: HTMLElement, themeState: ThemeState): Remark42Config => {
			const { remarkHost, remarkSiteId, remarkUrl } = container.dataset as {
				remarkHost?: string;
				remarkSiteId?: string;
				remarkUrl?: string;
			};

			if (!remarkHost || !remarkSiteId || !remarkUrl) {
				throw new Error("Missing required Remark42 configuration");
			}

			const normalizedHost = remarkHost.replace(/\/$/, "");

			return {
				host: normalizedHost,
				site_id: remarkSiteId,
				url: remarkUrl,
				components: ["embed"],
				theme: themeState.theme,
				locale: "en",
				show_email_subscription: true,
				simple_view: false,
				no_footer: true,
			};
		},

		initialize: (config: Remark42Config) => {
			const invokeCreateInstance = () => {
				window.REMARK42?.createInstance?.(config);
			};

			if (window.REMARK42 && typeof window.REMARK42.createInstance === "function") {
				invokeCreateInstance();
			} else {
				// Set config for when script loads
				window.remark_config = config;

				// Wait for script to load
				const script = document.querySelector<HTMLScriptElement>(`script[data-remark42]`);
				if (script && !window.REMARK42?.createInstance) {
					script.addEventListener("load", invokeCreateInstance, { once: true });
				}
			}
		},

		updateTheme: (themeState: ThemeState) => {
			window.REMARK42?.changeTheme?.(themeState.theme);
		},

		cleanup: destroyRemark42,
	};

	// Create and initialize the embed system
	const remark42System = createEmbedSystem(remark42Config);
	remark42System.init();
}

// Initialize using autoInit helper
autoInit(initRemark42System, "after-swap");
