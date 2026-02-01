/**
 * Initialize Mermaid diagrams client-side
 */

import { getThemeState, onThemeChange } from "../lib/theme-effects";

let mermaidModule: typeof import("mermaid")["default"] | null = null;
let themeListenerAttached = false;

export function initMermaid() {
    const mermaidDivs = document.querySelectorAll(".mermaid");

    if (mermaidDivs.length === 0) {
        return;
    }

    // Store original source before mermaid replaces it with SVG
    for (const el of mermaidDivs) {
        if (!el.getAttribute("data-mermaid-src")) {
            el.setAttribute("data-mermaid-src", el.textContent || "");
        }
    }

    const themeForState = (theme: string) =>
        theme === "dark" ? "dark" : "default";

    const renderAll = async (mermaid: typeof mermaidModule) => {
        if (!mermaid) return;

        mermaid.initialize({
            startOnLoad: false,
            theme: themeForState(getThemeState().theme),
        });

        // Re-render from stored source to ensure clean state
        const elements = document.querySelectorAll<HTMLElement>(".mermaid");
        for (const el of elements) {
            const src = el.getAttribute("data-mermaid-src");
            if (!src) continue;

            const id = `mermaid-render-${Math.random().toString(36).slice(2)}`;
            try {
                const { svg } = await mermaid.render(id, src);
                el.innerHTML = svg;
            } catch {
                // Mermaid render can fail for invalid syntax
            }
        }
    };

    if (mermaidModule) {
        // Already loaded — just re-render current diagrams
        renderAll(mermaidModule);
    } else {
        import("mermaid").then(({ default: mermaid }) => {
            mermaidModule = mermaid;
            renderAll(mermaid);
        });
    }

    // Attach theme listener only once
    if (!themeListenerAttached) {
        themeListenerAttached = true;
        onThemeChange(async () => {
            if (!mermaidModule) return;
            await renderAll(mermaidModule);
        });
    }
}
