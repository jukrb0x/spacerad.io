import { getThemeState, initTheme, onThemeChange, type ThemeState } from "./theme";

type CusdisGlobal = {
    setTheme?: (theme: "light" | "dark") => void;
    initial?: () => void;
};

declare global {
    interface Window {
        CUSDIS?: CusdisGlobal;
        cusdisConfig?: {
            host: string;
            appId: string;
            pageId: string;
            pageTitle: string;
            theme: "light" | "dark";
        };
    }
}

const SCRIPT_ATTR = "data-cusdis";
const CONTAINER_SELECTOR = "[data-cusdis-host]";

let themeUnsubscribe: (() => void) | null = null;

const ensureEmbedScript = (host: string) => {
    const normalizedHost = host.replace(/\/$/, "");
    let script = document.querySelector<HTMLScriptElement>(`script[${SCRIPT_ATTR}]`);

    if (!script) {
        script = document.createElement("script");
        script.src = `${normalizedHost}/js/cusdis.es.js`;
        script.async = true;
        script.setAttribute(SCRIPT_ATTR, normalizedHost);
        document.head.appendChild(script);
    }

    return script;
};

const initCusdis = (container: HTMLElement) => {
    const { cusdisHost, cusdisAppId, cusdisPageId, cusdisPageTitle } = container.dataset as {
        cusdisHost?: string;
        cusdisAppId?: string;
        cusdisPageId?: string;
        cusdisPageTitle?: string;
    };

    if (!cusdisHost || !cusdisAppId || !cusdisPageId) {
        return;
    }

    const host = cusdisHost.replace(/\/$/, "");
    const { theme } = initTheme();

    // Clear stale content from previous navigation
    container.innerHTML = "";

    // Set up the iframe container with data attributes
    container.setAttribute("data-host", host);
    container.setAttribute("data-app-id", cusdisAppId);
    container.setAttribute("data-page-id", cusdisPageId);
    container.setAttribute("data-page-title", cusdisPageTitle || document.title);
    container.setAttribute("data-theme", theme);

    // Clean up previous theme listener
    if (themeUnsubscribe) {
        themeUnsubscribe();
        themeUnsubscribe = null;
    }

    const applyTheme = (state: ThemeState) => {
        container.setAttribute("data-theme", state.theme);
        window.CUSDIS?.setTheme?.(state.theme);
    };

    applyTheme(getThemeState());
    themeUnsubscribe = onThemeChange(applyTheme);

    const script = ensureEmbedScript(host);

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
};

const initAllContainers = () => {
    const containers = Array.from(document.querySelectorAll<HTMLElement>(CONTAINER_SELECTOR));
    containers.forEach((container) => {
        initCusdis(container);
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
