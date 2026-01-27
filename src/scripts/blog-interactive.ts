/**
 * Blog post interactive features
 * Includes: responsive tables, TOC navigation, mobile drawer, etc.
 */

import { lockScroll, unlockScroll } from "../utils/scrollLock";

// ============ Timing Utilities ============
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
    let timeoutId: number | null = null;
    return ((...args: unknown[]) => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delay);
    }) as T;
}

function throttle<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
    let timeoutId: number | null = null;
    return ((...args: unknown[]) => {
        if (timeoutId !== null) return;
        timeoutId = window.setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delay);
    }) as T;
}

// ============ Responsive Table Handling ============
function unwrapCardCells(table: HTMLTableElement) {
    const cardCells = table.querySelectorAll("[data-cardified]");

    for (const cell of cardCells) {
        const wrapper = cell.querySelector(".table-card-value");
        if (wrapper) {
            while (wrapper.firstChild) {
                cell.insertBefore(wrapper.firstChild, wrapper);
            }
            wrapper.remove();
        }
        cell.removeAttribute("data-cardified");
        cell.removeAttribute("data-label");
    }
}

function applyResponsiveTables() {
    const tables = document.querySelectorAll<HTMLTableElement>(".prose table");

    for (const table of tables) {
        const headers = Array.from(table.querySelectorAll("thead th")).map((th) => {
            return (th.textContent || "").trim();
        });

        const rows = Array.from(table.querySelectorAll("tbody tr"));
        const hasBodyRows = rows.length > 0;
        const columnThreshold = 3;
        const hasWideHeader = headers.length > columnThreshold;
        const hasWideRow = rows.some((row) => {
            return row.querySelectorAll("td, th").length > columnThreshold;
        });
        const shouldCardify = headers.length > 0 && hasBodyRows && (hasWideHeader || hasWideRow);

        table.setAttribute("data-card-mode", shouldCardify ? "cards" : "table");

        if (!shouldCardify) {
            unwrapCardCells(table);
            continue;
        }

        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll("td, th"));

            cells.forEach((cell, index) => {
                const label = headers[index] || "";
                if (label.length === 0) {
                    cell.removeAttribute("data-label");
                    return;
                }
                cell.setAttribute("data-label", label);
                if (!cell.hasAttribute("data-cardified")) {
                    const valueWrapper = document.createElement("div");
                    valueWrapper.classList.add("table-card-value");
                    while (cell.firstChild) {
                        valueWrapper.appendChild(cell.firstChild);
                    }
                    cell.appendChild(valueWrapper);
                    cell.setAttribute("data-cardified", "true");
                }
            });
        }
    }
}

// ============ Iframe Embed Handling ============
function handleEmbedIframes() {
    const iframes = document.querySelectorAll('iframe[data-testid="embed-iframe"]');

    for (const iframe of iframes) {
        const iframeElement = iframe as HTMLIFrameElement;

        // Skip if already processed
        if (iframeElement.dataset.embedProcessed === "true") continue;
        iframeElement.dataset.embedProcessed = "true";

        let hasLoaded = false;
        let timeoutId: number;

        // Wrap in container for smooth transitions
        if (!iframeElement.parentElement?.classList.contains("embed-wrapper")) {
            const wrapper = document.createElement("div");
            wrapper.className = "embed-wrapper";
            wrapper.style.cssText = "transition: max-height 0.4s ease, opacity 0.4s ease; overflow: hidden;";
            iframeElement.parentNode?.insertBefore(wrapper, iframeElement);
            wrapper.appendChild(iframeElement);
        }

        const wrapper = iframeElement.parentElement as HTMLElement;

        // Handle successful load
        const handleLoad = () => {
            hasLoaded = true;
            clearTimeout(timeoutId);
            wrapper.style.maxHeight = "";
            wrapper.style.opacity = "1";
        };

        iframeElement.addEventListener("load", handleLoad, { once: true });

        // Timeout: collapse if not loaded within 5 seconds
        timeoutId = window.setTimeout(() => {
            if (!hasLoaded) {
                wrapper.style.maxHeight = "0";
                wrapper.style.opacity = "0";
                wrapper.style.marginBottom = "0";
                setTimeout(() => {
                    wrapper.style.display = "none";
                }, 400);
            }
        }, 5000);
    }
}

// ============ TOC Navigation Highlighting ============
let currentTocCleanup: (() => void) | null = null;

function initTocObserver() {
    // Cleanup previous observer
    if (currentTocCleanup) {
        currentTocCleanup();
        currentTocCleanup = null;
    }

    const tocLinks = document.querySelectorAll("[data-toc-link]");
    if (tocLinks.length === 0) return;

    const headingElements = Array.from(tocLinks)
        .map((link) => {
            const id = link.getAttribute("data-heading-id");
            return id ? document.getElementById(id) : null;
        })
        .filter((el): el is HTMLElement => el !== null);

    if (headingElements.length === 0) return;

    // Track all currently visible headings
    const visibleHeadings = new Set<string>();

    const observerOptions = {
        rootMargin: "-100px 0px -66% 0px",
        threshold: [0, 1],
    };

    const setActiveLink = (id: string) => {
        // Remove active class from all links (includes both desktop and mobile TOCs)
        for (const link of tocLinks) {
            link.classList.remove("active");
        }

        // Add active class to all matching links for the same heading
        const matches = document.querySelectorAll(`[data-heading-id="${id}"]`);
        for (const el of matches) {
            el.classList.add("active");
        }
    };

    const updateActiveHeading = () => {
        if (visibleHeadings.size === 0) return;

        // Find the first visible heading (top to bottom)
        let firstVisibleId: string | null = null;
        for (const heading of headingElements) {
            if (visibleHeadings.has(heading.id)) {
                firstVisibleId = heading.id;
                break;
            }
        }

        if (firstVisibleId) {
            setActiveLink(firstVisibleId);
        }
    };

    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            const id = entry.target.id;
            if (entry.isIntersecting) {
                visibleHeadings.add(id);
            } else {
                visibleHeadings.delete(id);
            }
        }

        updateActiveHeading();
    }, observerOptions);

    for (const heading of headingElements) {
        observer.observe(heading);
    }

    // Click handler map for cleanup
    const clickHandlers = new Map<Element, () => void>();

    // Add click event handlers
    for (const link of tocLinks) {
        const handler = () => {
            const id = link.getAttribute("data-heading-id");
            if (id) {
                setActiveLink(id);
            }
        };
        clickHandlers.set(link, handler);
        link.addEventListener("click", handler);
    }

    // Cleanup function
    currentTocCleanup = () => {
        observer.disconnect();
        for (const [link, handler] of clickHandlers) {
            link.removeEventListener("click", handler);
        }
        clickHandlers.clear();
    };
}

// ============ Mobile TOC Drawer ============
function initMobileTocDrawer() {
    const toggleBtn = document.querySelector("[data-toc-mobile-toggle]");
    const drawer = document.querySelector("[data-toc-mobile-drawer]");
    const overlay = document.querySelector("[data-toc-mobile-overlay]");
    const content = document.querySelector("[data-toc-mobile-content]");
    const closeBtn = document.querySelector("[data-toc-mobile-close]");
    const tocLinks = drawer?.querySelectorAll("[data-toc-link]");

    if (!toggleBtn || !drawer || !overlay || !content || !closeBtn) return;

    let isOpen = false;

    const openDrawer = () => {
        isOpen = true;
        drawer.classList.remove("pointer-events-none");
        drawer.setAttribute("aria-hidden", "false");
        overlay.classList.remove("opacity-0", "pointer-events-none");
        content.classList.remove("translate-x-full");
        lockScroll();
    };

    const closeDrawer = () => {
        isOpen = false;
        overlay.classList.add("opacity-0", "pointer-events-none");
        content.classList.add("translate-x-full");
        unlockScroll();
        // Wait for animation to complete before hiding
        setTimeout(() => {
            if (!isOpen) {
                drawer.classList.add("pointer-events-none");
                drawer.setAttribute("aria-hidden", "true");
            }
        }, 300);
    };

    toggleBtn.addEventListener("click", openDrawer);
    closeBtn.addEventListener("click", closeDrawer);
    overlay.addEventListener("click", closeDrawer);

    // Auto-close drawer when clicking TOC links
    tocLinks?.forEach((link) => {
        link.addEventListener("click", closeDrawer);
    });

    // Close on ESC key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && isOpen) {
            closeDrawer();
        }
    });
}

// ============ Sidebar Positioning (TOC + Share Bar) ============
// Dynamically calculate sidebar starting position, implementing scroll floating effect
let sidebarPositionRAF: number | null = null;
let sidebarsInitialized = false;

// Cache DOM elements to avoid repeated queries
let cachedTocSidebar: HTMLElement | null = null;
let cachedShareSidebar: HTMLElement | null = null;
let cachedArticleHeader: HTMLElement | null = null;

function initSidebarCache(): void {
    cachedTocSidebar = document.querySelector<HTMLElement>("[data-toc-sidebar]");
    cachedShareSidebar = document.querySelector<HTMLElement>("[data-share-sidebar]");
    cachedArticleHeader = document.querySelector<HTMLElement>("[data-article-header]");
    sidebarsInitialized = false;
}

function adjustSidebarPositions(): void {
    // Skip if RAF already pending
    if (sidebarPositionRAF !== null) return;

    sidebarPositionRAF = requestAnimationFrame(() => {
        sidebarPositionRAF = null;

        if (!cachedArticleHeader) return;

        const headerBottom = cachedArticleHeader.getBoundingClientRect().bottom;
        const minTop = 64; // header navigation bar height
        const padding = 24; // spacing from separator line

        // Scroll floating logic: when header scrolls out of viewport, sidebar floats to top
        const targetTop = headerBottom < minTop ? minTop + padding : Math.max(minTop + padding, headerBottom + padding);

        const topValue = `${targetTop}px`;

        // Update positions using cached elements
        if (cachedTocSidebar) {
            cachedTocSidebar.style.top = topValue;
        }
        if (cachedShareSidebar) {
            cachedShareSidebar.style.top = topValue;
        }

        // Only set opacity once on first position update
        if (!sidebarsInitialized) {
            sidebarsInitialized = true;
            if (cachedTocSidebar) cachedTocSidebar.style.opacity = "1";
            if (cachedShareSidebar) cachedShareSidebar.style.opacity = "1";
        }
    });
}

// Backward compatibility alias
function adjustTocPosition(): void {
    adjustSidebarPositions();
}

const debouncedAdjustTocPosition = debounce(adjustTocPosition, 150);

// Initialize sidebar cache and position on page navigation
function initSidebars(): void {
    initSidebarCache();
    adjustSidebarPositions();
}

// ============ Initialize All Features ============
export function initBlogInteractive() {
    // Responsive tables
    const ensureResponsiveTables = () => window.requestAnimationFrame(applyResponsiveTables);
    ensureResponsiveTables();
    window.addEventListener("astro:after-swap", ensureResponsiveTables);

    // Iframe handling
    handleEmbedIframes();
    window.addEventListener("astro:after-swap", handleEmbedIframes);

    // TOC features
    initTocObserver();
    window.addEventListener("astro:after-swap", initTocObserver);

    initMobileTocDrawer();
    window.addEventListener("astro:after-swap", initMobileTocDrawer);

    // Sidebar positioning - use RAF directly for scroll (no throttle needed, RAF handles timing)
    initSidebars();
    window.addEventListener("resize", debouncedAdjustTocPosition);
    window.addEventListener("scroll", adjustSidebarPositions, { passive: true });
    window.addEventListener("astro:after-swap", initSidebars);
}
