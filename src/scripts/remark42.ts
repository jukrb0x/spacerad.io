import { createEmbedSystem, type EmbedSystemConfig } from "../lib/embedSystem";
import { getThemeState, type ThemeName, type ThemeState } from "../lib/theme-effects";
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

let bootstrap: AbortController | undefined;

const destroyRemark42 = () => {
    bootstrap?.abort();
    try {
        window.REMARK42?.destroy?.();
    } catch {
        // Remark42 might not have destroy in all versions
    }

    // Remove stale iframes from previous instance
    const container = document.getElementById("remark42");
    if (container) {
        const iframes = container.querySelectorAll("iframe");
        iframes.forEach((iframe) => {
            iframe.remove();
        });
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

    initialize: async (config: Remark42Config) => {
        const container = document.querySelector<HTMLElement>(CONTAINER_SELECTOR);
        if (!container) return;
        if (window.REMARK42?.createInstance) {
            window.remark_config = config;
            window.REMARK42.createInstance(config);
            return;
        }
        const controller = new AbortController();
        bootstrap = controller;
        try {
            const response = await fetch("/api/remark42-script", { signal: controller.signal });
            if (!response.ok) throw new Error("Comment script unavailable");
            const source = await response.text();
            if (controller.signal.aborted || !container.isConnected) return;
            window.remark_config = { ...config, theme: getThemeState().theme };
            // Inline classic execution is synchronous: autostart sees this live root.
            const script = document.createElement("script");
            script.setAttribute("data-remark42", config.host);
            script.textContent = source;
            document.head.appendChild(script);
        } catch {
            if (!controller.signal.aborted && container.isConnected) {
                container.textContent = "Comments are temporarily unavailable.";
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
// Third-party loading must not delay the shell's initial page-load bindings.
autoInit(() => remark42System.init(), "page-load");

// Release the vendor instance before its article DOM is replaced.
document.addEventListener("astro:before-swap", destroyRemark42);
