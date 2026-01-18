/**
 * Code Block Enhancement
 * - Add copy button to code blocks
 * - Show language label
 */

const COPY_TEXT = "Copy";
const COPIED_TEXT = "Copied!";
const COPIED_DURATION = 2000;

function initCodeBlocks() {
    const codeBlocks = document.querySelectorAll<HTMLPreElement>(".prose pre");

    codeBlocks.forEach((pre) => {
        // Skip if already processed
        if (pre.dataset.codeBlockInitialized) return;
        pre.dataset.codeBlockInitialized = "true";

        // Get language from class (e.g., "language-typescript")
        const codeEl = pre.querySelector("code");
        const langClass = codeEl?.className.match(/language-(\w+)/);
        const language = langClass?.[1] || "";

        // Create wrapper
        const wrapper = document.createElement("div");
        wrapper.className = "code-block-wrapper";

        // Create header
        const header = document.createElement("div");
        header.className = "code-block-header";

        // Language label
        const langLabel = document.createElement("span");
        langLabel.className = "code-block-lang";
        langLabel.textContent = language.toUpperCase();

        // Copy button
        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "code-copy-button";
        copyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>${COPY_TEXT}</span>
        `;

        copyBtn.addEventListener("click", async () => {
            const code = codeEl?.textContent || "";

            try {
                await navigator.clipboard.writeText(code);
                copyBtn.classList.add("copied");
                copyBtn.querySelector("span")!.textContent = COPIED_TEXT;

                setTimeout(() => {
                    copyBtn.classList.remove("copied");
                    copyBtn.querySelector("span")!.textContent = COPY_TEXT;
                }, COPIED_DURATION);
            } catch (err) {
                // Fallback for older browsers
                const textarea = document.createElement("textarea");
                textarea.value = code;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);

                copyBtn.classList.add("copied");
                copyBtn.querySelector("span")!.textContent = COPIED_TEXT;

                setTimeout(() => {
                    copyBtn.classList.remove("copied");
                    copyBtn.querySelector("span")!.textContent = COPY_TEXT;
                }, COPIED_DURATION);
            }
        });

        // Assemble
        header.appendChild(langLabel);
        header.appendChild(copyBtn);

        // Wrap
        pre.parentNode?.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
    });
}

// Initialize
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCodeBlocks, { once: true });
} else {
    initCodeBlocks();
}

// Handle Astro navigation
window.addEventListener("astro:after-swap", initCodeBlocks);

export { initCodeBlocks };
