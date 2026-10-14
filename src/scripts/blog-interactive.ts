/**
 * Blog post interactive features
 * Includes: responsive tables, TOC navigation, mobile drawer, etc.
 */

import { lockScrollForDialog, unlockScrollForDialog } from "../utils/scrollLock";
import { debounce } from "../utils/timing";

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
let disposeMobileTocDrawer: (() => void) | undefined;

function initMobileTocDrawer() {
    disposeMobileTocDrawer?.();
    disposeMobileTocDrawer = undefined;
    const toggleBtn = document.querySelector("[data-toc-mobile-toggle]");
    const dialog = document.querySelector<HTMLDialogElement>("[data-toc-mobile-drawer]");
    if (!toggleBtn || !dialog) return;

    const controller = new AbortController();
    const options = { signal: controller.signal };
    let locked = false;
    let frame: number | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    const openDrawer = () => {
        if (locked || controller.signal.aborted) return;
        clearTimeout(closeTimer);
        if (!dialog.open) dialog.showModal();
        locked = true;
        lockScrollForDialog();
        frame = requestAnimationFrame(() => {
            frame = undefined;
            if (locked && !controller.signal.aborted) dialog.classList.add("is-open");
        });
    };
    const closeDrawer = (immediate = false) => {
        clearTimeout(closeTimer);
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = undefined;
        dialog.classList.remove("is-open");
        if (locked) {
            locked = false;
            unlockScrollForDialog();
        }
        if (immediate) dialog.close();
        else
            closeTimer = setTimeout(() => {
                if (!locked && dialog.isConnected) dialog.close();
            }, 300);
    };

    toggleBtn.addEventListener("click", openDrawer, options);
    dialog.querySelectorAll("[data-toc-mobile-close]").forEach((button) => {
        button.addEventListener("click", () => closeDrawer(), options);
    });
    dialog.addEventListener(
        "cancel",
        (event) => {
            event.preventDefault();
            closeDrawer();
        },
        options,
    );
    dialog.addEventListener(
        "close",
        () => {
            if (!dialog.open && locked) closeDrawer(true);
        },
        options,
    );
    dialog.querySelectorAll("[data-toc-link]").forEach((link) => {
        link.addEventListener("click", () => closeDrawer(true), options);
    });
    disposeMobileTocDrawer = () => {
        closeDrawer(true);
        controller.abort();
        clearTimeout(closeTimer);
    };
}

document.addEventListener("astro:before-swap", () => {
    disposeMobileTocDrawer?.();
    disposeMobileTocDrawer = undefined;
});

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
let blogInteractiveInitialized = false;

export function initBlogInteractive() {
    // Run feature init immediately for current DOM
    window.requestAnimationFrame(applyResponsiveTables);
    handleEmbedIframes();
    initTocObserver();
    initMobileTocDrawer();
    initSidebars();

    // Only add persistent listeners once
    if (!blogInteractiveInitialized) {
        blogInteractiveInitialized = true;
        window.addEventListener("resize", debouncedAdjustTocPosition);
        window.addEventListener("scroll", adjustSidebarPositions, { passive: true });
    }
}
