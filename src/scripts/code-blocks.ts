/**
 * Code Block Enhancement
 * - Add copy button to code blocks
 * - Show language label (or filename from rehype-pretty-code title)
 * - Works with rehype-pretty-code's [data-rehype-pretty-code-figure] wrapper
 */

const COPY_TEXT = "Copy";
const COPIED_TEXT = "Copied!";
const COPIED_DURATION = 2000;

function createCopyButton(codeEl: HTMLElement | null): HTMLButtonElement {
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
        } catch {
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

    return copyBtn;
}

function initCodeBlocks() {
    const codeBlocks = document.querySelectorAll<HTMLPreElement>(".prose pre");

    codeBlocks.forEach((pre) => {
        // Skip if already processed
        if (pre.dataset.codeBlockInitialized) return;
        pre.dataset.codeBlockInitialized = "true";

        const codeEl = pre.querySelector("code");
        const figure = pre.closest("[data-rehype-pretty-code-figure]");
        const existingTitle = figure?.querySelector("[data-rehype-pretty-code-title]");

        // Get language from data attribute or class
        const language = codeEl?.dataset.language ||
            codeEl?.className.match(/language-(\w+)/)?.[1] || "";

        if (existingTitle) {
            // rehype-pretty-code has a title - just add copy button to it
            existingTitle.classList.add("code-block-header");
            const copyBtn = createCopyButton(codeEl);
            existingTitle.appendChild(copyBtn);

            // Add wrapper class to figure for consistent styling
            figure?.classList.add("code-block-wrapper");
        } else {
            // No title - create our own wrapper with header
            const wrapper = document.createElement("div");
            wrapper.className = "code-block-wrapper";

            const header = document.createElement("div");
            header.className = "code-block-header";

            // Language label
            const langLabel = document.createElement("span");
            langLabel.className = "code-block-lang";
            langLabel.textContent = language.toUpperCase();

            // Copy button
            const copyBtn = createCopyButton(codeEl);

            // Assemble
            header.appendChild(langLabel);
            header.appendChild(copyBtn);

            // Wrap - handle both figure and standalone pre
            const target = figure || pre;
            target.parentNode?.insertBefore(wrapper, target);
            wrapper.appendChild(header);
            wrapper.appendChild(target);
        }
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
