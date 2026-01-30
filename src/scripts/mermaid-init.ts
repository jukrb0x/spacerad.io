/**
 * Initialize Mermaid diagrams client-side
 */

import { getThemeState, onThemeChange } from "./theme";

export function initMermaid() {
    const mermaidDivs = document.querySelectorAll(".mermaid");

    if (mermaidDivs.length === 0) {
        return;
    }

    // Store original source before mermaid replaces it with SVG
    for (const el of mermaidDivs) {
        el.setAttribute("data-mermaid-src", el.textContent || "");
    }

    import("mermaid").then(({ default: mermaid }) => {
        const themeForState = (theme: string) =>
            theme === "dark" ? "dark" : "default";

        mermaid.initialize({
            startOnLoad: false,
            theme: themeForState(getThemeState().theme),
        });

        mermaid.run({ querySelector: ".mermaid" });

        onThemeChange(async (state) => {
            mermaid.initialize({
                startOnLoad: false,
                theme: themeForState(state.theme),
            });

            // Render each diagram off-DOM, then swap SVG in place (no flash)
            const elements = document.querySelectorAll<HTMLElement>(".mermaid");
            for (const el of elements) {
                const src = el.getAttribute("data-mermaid-src");
                if (!src) continue;

                const id = `mermaid-rerender-${Math.random().toString(36).slice(2)}`;
                const { svg } = await mermaid.render(id, src);
                el.innerHTML = svg;
            }
        });
    });
}
