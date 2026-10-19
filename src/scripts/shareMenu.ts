/**
 * Share Menu System
 * Manages mobile share menu toggle and copy link functionality
 *
 * Uses a module-level AbortController so every call to initShareMenu()
 * tears down all previous listeners before re-binding.
 * This makes double-init harmless (direct page load fires both
 * DOMContentLoaded and astro:page-load) and prevents listener leaks
 * across SPA navigations.
 */

import { autoInit } from "../utils/spaLifecycle";

let menuOpen = false;
let toastTimeout: number;
let cleanupController: AbortController | null = null;

/**
 * Set menu open state
 */
function setMenuOpen(open: boolean): void {
    const mobileToggle = document.querySelector<HTMLElement>("[data-share-mobile-toggle]");
    const shareMenu = document.querySelector<HTMLElement>("[data-share-menu]");
    if (!shareMenu || !mobileToggle) return;

    const restoreFocus = !open && shareMenu.contains(document.activeElement);
    menuOpen = open;
    if (restoreFocus) mobileToggle.focus({ preventScroll: true });
    shareMenu.hidden = !open;
    shareMenu.inert = !open;
    mobileToggle.setAttribute("aria-expanded", String(open));
    shareMenu.setAttribute("aria-hidden", String(!open));
}

/**
 * Show toast notification
 */
function showToast(): void {
    const toast = document.querySelector<HTMLElement>("[data-copy-toast]");
    if (!toast) return;

    clearTimeout(toastTimeout);
    toast.classList.remove("opacity-0", "pointer-events-none", "translate-y-2");
    toastTimeout = window.setTimeout(() => {
        toast.classList.add("opacity-0", "pointer-events-none", "translate-y-2");
    }, 2000);
}

/**
 * Copy link to clipboard
 */
async function copyLink(url: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(url);
        showToast();
    } catch {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        showToast();
    }
}

/**
 * Initialize share menu
 *
 * Idempotent — safe to call multiple times. Each call aborts every
 * listener from the previous call via AbortController before binding
 * fresh ones.
 */
function initShareMenu(): void {
    // Abort all listeners from the previous init (handles double-fire
    // on direct load and SPA re-init)
    cleanupController?.abort();
    cleanupController = new AbortController();
    const { signal } = cleanupController;

    const mobileToggle = document.querySelector<HTMLElement>("[data-share-mobile-toggle]");
    const copyButtons = document.querySelectorAll<HTMLElement>("[data-copy-link]");
    const shareMenuItems = document.querySelectorAll<HTMLElement>("[data-share-menu-item]");

    // Reset state
    menuOpen = false;

    // Mobile toggle
    mobileToggle?.addEventListener(
        "click",
        () => {
            setMenuOpen(!menuOpen);
        },
        { signal },
    );

    // Close on outside click
    document.addEventListener(
        "click",
        (e) => {
            const target = e.target as HTMLElement;
            if (menuOpen && !target.closest("[data-share-menu]") && !target.closest("[data-share-mobile-toggle]")) {
                setMenuOpen(false);
            }
        },
        { signal },
    );

    // Close on Escape
    document.addEventListener(
        "keydown",
        (e) => {
            if ((e as KeyboardEvent).key === "Escape" && menuOpen) {
                setMenuOpen(false);
                mobileToggle?.focus();
            }
        },
        { signal },
    );

    // Copy link buttons — close menu after copy
    copyButtons.forEach((btn) => {
        btn.addEventListener(
            "click",
            () => {
                const url = btn.dataset.url;
                if (url) copyLink(url);
                setMenuOpen(false);
            },
            { signal },
        );
    });

    // Share links close the expanded menu after click; copy handles itself above.
    shareMenuItems.forEach((item) => {
        if (!item.hasAttribute("data-copy-link")) {
            item.addEventListener(
                "click",
                () => {
                    setMenuOpen(false);
                },
                { signal },
            );
        }
    });
}

// Initialize on page load
autoInit(initShareMenu, "page-load");
document.addEventListener("astro:before-swap", () => {
    cleanupController?.abort();
    clearTimeout(toastTimeout);
    menuOpen = false;
});

export { initShareMenu, setMenuOpen, copyLink };
