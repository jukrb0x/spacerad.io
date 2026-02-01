import { getThemeState, initTheme, onThemeChange, type ThemeName, type ThemeState } from "../lib/theme-effects";

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

const SCRIPT_ATTR = "data-remark42";
const CONTAINER_SELECTOR = "[data-remark-host]";

let themeUnsubscribe: (() => void) | null = null;

const ensureEmbedScript = (host: string) => {
    const normalizedHost = host.replace(/\/$/, "");
    let script = document.querySelector<HTMLScriptElement>(`script[${SCRIPT_ATTR}]`);

    if (!script) {
        script = document.createElement("script");
        script.src = `${normalizedHost}/web/embed.js`;
        script.defer = true;
        script.setAttribute(SCRIPT_ATTR, normalizedHost);
        document.head.appendChild(script);
    }

    return script;
};

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

const initRemark42 = (container: HTMLElement) => {
    const { remarkHost, remarkSiteId, remarkUrl } = container.dataset as {
        remarkHost?: string;
        remarkSiteId?: string;
        remarkUrl?: string;
    };

    if (!remarkHost || !remarkSiteId || !remarkUrl) {
        return;
    }

    // Destroy previous instance before re-initializing
    destroyRemark42();

    const host = remarkHost.replace(/\/$/, "");
    const { theme } = initTheme();
    const config: Remark42Config = {
        host,
        site_id: remarkSiteId,
        url: remarkUrl,
        components: ["embed"],
        theme,
        locale: "en",
        show_email_subscription: true,
        simple_view: false,
        no_footer: true,
    };

    // Clean up previous theme listener
    if (themeUnsubscribe) {
        themeUnsubscribe();
        themeUnsubscribe = null;
    }

    const applyTheme = (state: ThemeState) => {
        config.theme = state.theme;
        window.REMARK42?.changeTheme?.(state.theme);
    };

    applyTheme(getThemeState());
    themeUnsubscribe = onThemeChange(applyTheme);

    const invokeCreateInstance = () => {
        window.REMARK42?.createInstance?.(config);
    };

    const script = ensureEmbedScript(host);

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
};

const initAllContainers = () => {
    const containers = Array.from(document.querySelectorAll<HTMLElement>(CONTAINER_SELECTOR));
    containers.forEach((container) => {
        initRemark42(container);
    });
};

// Initialize
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAllContainers, {
        once: true,
    });
} else {
    initAllContainers();
}

// Handle Astro page transitions
document.addEventListener("astro:after-swap", initAllContainers);
