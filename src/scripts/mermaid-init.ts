/**
 * Initialize Mermaid diagrams client-side
 */

export function initMermaid() {
    // Check if there are any mermaid code blocks
    const mermaidBlocks = document.querySelectorAll("pre > code.language-mermaid");

    if (mermaidBlocks.length === 0) {
        return; // No mermaid diagrams on this page
    }

    // Dynamically import mermaid
    import("mermaid").then(({ default: mermaid }) => {
        // Initialize mermaid with theme that respects dark mode
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";

        mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? "dark" : "default",
        });

        // Convert code blocks to mermaid diagrams
        mermaidBlocks.forEach((block, index) => {
            const pre = block.parentElement;
            if (!pre) return;

            const code = block.textContent || "";
            const id = `mermaid-${index}`;

            // Create a div with the mermaid class
            const div = document.createElement("div");
            div.className = "mermaid";
            div.id = id;
            div.textContent = code;

            // Replace the pre block with the mermaid div
            pre.replaceWith(div);
        });

        // Render all mermaid diagrams
        mermaid.run({
            querySelector: ".mermaid",
        });

        // Re-initialize on theme change
        document.addEventListener("theme-changed", () => {
            const isDark = document.documentElement.getAttribute("data-theme") === "dark";
            mermaid.initialize({
                startOnLoad: false,
                theme: isDark ? "dark" : "default",
            });

            // Re-render all diagrams
            document.querySelectorAll(".mermaid").forEach((el) => {
                const code = el.getAttribute("data-processed");
                if (code) {
                    el.removeAttribute("data-processed");
                }
            });

            mermaid.run({
                querySelector: ".mermaid",
            });
        });
    });
}
