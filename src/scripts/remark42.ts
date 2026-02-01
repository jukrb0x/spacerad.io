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
		iframes.forEach((iframe) => {iframe.remove()});
	}
};

// Create embed system configuration
// Note: Remark42 uses dynamic script URLs based on the host from each container,
// so we pass a placeholder and handle script loading in the initialize function
const remark42Config: EmbedSystemConfig<Remark42Config> = {
	scriptUrl: "placeholder", // Script URL is dynamic, loaded in initialize
	scriptAttr: "data-remark42",
	containerSelector: CONTAINER_SELECTOR,

	createConfig: (container: HTMLElement, themeState: ThemeState): Remark42Config => {
		const { remarkHost, remarkSiteId, remarkUrl } = container.dataset as {
			remarkHost?: string;
			remarkSiteId?: string;
			remarkUrl?: string;
		};

		if (!remarkHost || !remarkSiteId || !remarkUrl) {
			console.error("Remark42: Missing required configuration attributes on container", container);
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
		// Dynamically load script based on config.host
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
			if (window.REMARK42?.createInstance) {
				window.REMARK42.createInstance(config);
			}
		};

		if (window.REMARK42 && typeof window.REMARK42.createInstance === "function") {
			// Script already loaded
			invokeCreateInstance();
		} else {
			// Set config for when script loads
			window.remark_config = config;

			// Wait for script to load
			if (script && !script.hasAttribute("data-remark42-loaded")) {
				script.addEventListener("load", () => {
					script.setAttribute("data-remark42-loaded", "true");
					invokeCreateInstance();
				}, { once: true });
			}
		}
	},

	updateTheme: (themeState: ThemeState) => {
		window.REMARK42?.changeTheme?.(themeState.theme);
	},

	cleanup: destroyRemark42,
};

// Create the embed system
const remark42System = createEmbedSystem(remark42Config);

// Initialize using autoInit helper
autoInit(() => remark42System.init(), "after-swap");
