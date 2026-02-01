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

// Create embed system configuration
const remark42Config: EmbedSystemConfig<Remark42Config> = {
	scriptUrl: "", // Will be set dynamically based on host
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

		const host = remarkHost.replace(/\/$/, "");

		return {
			host,
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
		// Update script URL dynamically based on host
		const normalizedHost = config.host.replace(/\/$/, "");
		const scriptUrl = `${normalizedHost}/web/embed.js`;

		// Check if script exists, if not create it
		let script = document.querySelector<HTMLScriptElement>(`script[data-remark42]`);
		if (!script) {
			script = document.createElement("script");
			script.src = scriptUrl;
			script.defer = true;
			script.setAttribute("data-remark42", normalizedHost);
			document.head.appendChild(script);
		}

		const invokeCreateInstance = () => {
			window.REMARK42?.createInstance?.(config);
		};

		if (window.REMARK42 && typeof window.REMARK42.createInstance === "function") {
			invokeCreateInstance();
		} else {
			window.remark_config = config;
			window.REMARK42 = window.REMARK42 || {};

			if (typeof window.REMARK42.createInstance !== "function") {
				window.REMARK42.createInstance = (cfg: Remark42Config) => {
					window.remark_config = cfg;
				};
			}

			script?.addEventListener("load", invokeCreateInstance, { once: true });
		}
	},

	updateTheme: (themeState: ThemeState) => {
		window.REMARK42?.changeTheme?.(themeState.theme);
	},

	cleanup: destroyRemark42,
};

// Create and initialize the embed system
const remark42System = createEmbedSystem(remark42Config);

// Initialize using autoInit helper
autoInit(() => remark42System.init(), "after-swap");
