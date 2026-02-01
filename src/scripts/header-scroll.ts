/**
 * Header Scroll Behavior - Space Radio Design System
 *
 * Features:
 * - Auto-hide header when scrolling down
 * - Show header when scrolling up (with threshold to avoid jitter)
 * - Blur backdrop when scrolled
 * - Reading progress indicator
 * - Exposes --header-offset CSS variable for sticky elements
 * - Respects prefers-reduced-motion
 */

let lastScrollY = 0;
let ticking = false;

let header = document.querySelector("[data-header]") as HTMLElement;
let progressBar = document.querySelector("[data-reading-progress]") as HTMLElement;

// Set header height CSS variable (only on page-load, not during scroll)
function updateHeaderOffset() {
    const headerHeight = header?.offsetHeight || 0;
    document.documentElement.style.setProperty("--header-offset", `${headerHeight}px`);
}

// Scroll threshold before hiding header
const SCROLL_THRESHOLD = 100;
const BLUR_THRESHOLD = 10;
// Minimum scrollable distance (in vh) to show progress bar
const MIN_SCROLL_DISTANCE_VH = 1.5;
// Minimum scroll-up distance (px) before showing header again
const SCROLL_UP_THRESHOLD = 500;

// Track the highest scroll position since last direction change
let scrollDirectionAnchor = 0;
let isHeaderHidden = false;

// Check if user prefers reduced motion
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Update header state based on scroll position
 */
function updateHeader() {
    const scrollY = window.scrollY;

    // Don't animate if user prefers reduced motion
    if (!prefersReducedMotion && header) {
        // Auto-hide logic - only after scrolling past threshold
        if (scrollY > SCROLL_THRESHOLD) {
            if (scrollY > lastScrollY) {
                // Scrolling down — update anchor and hide
                scrollDirectionAnchor = scrollY;
                if (!isHeaderHidden) {
                    isHeaderHidden = true;
                    header.classList.add("header--hidden");
                }
            } else {
                // Scrolling up — only show after scrolling up SCROLL_UP_THRESHOLD px
                const scrolledUp = scrollDirectionAnchor - scrollY;
                if (scrolledUp >= SCROLL_UP_THRESHOLD && isHeaderHidden) {
                    isHeaderHidden = false;
                    header.classList.remove("header--hidden");
                }
            }
        } else {
            // At top - always show header
            scrollDirectionAnchor = scrollY;
            if (isHeaderHidden) {
                isHeaderHidden = false;
                header.classList.remove("header--hidden");
            }
        }

        // Add scrolled state for blur backdrop
        header.classList.toggle("is-scrolled", scrollY > BLUR_THRESHOLD);
    }

    // Update reading progress (visual feedback, works even with reduced motion)
    if (progressBar) {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY;
        const trackLength = documentHeight - windowHeight;

        // Hide progress bar if page is not long enough
        const minScrollDistance = windowHeight * MIN_SCROLL_DISTANCE_VH;
        const isPageLongEnough = trackLength >= minScrollDistance;

        progressBar.style.opacity = isPageLongEnough ? "1" : "0";

        if (isPageLongEnough) {
            const percentScrolled = (scrollTop / trackLength) * 100;
            progressBar.style.transform = `scaleX(${Math.min(percentScrolled / 100, 1)})`;
            progressBar.setAttribute("aria-valuenow", Math.round(percentScrolled).toString());
        }
    }

    lastScrollY = scrollY;
    ticking = false;
}

/**
 * Request animation frame for smooth updates
 */
function onScroll() {
    if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
    }
}

// Initialize on page load
if (header) {
    updateHeaderOffset();
    updateHeader();
    window.addEventListener("scroll", onScroll, { passive: true });
}

// Update on page navigation (for SPAs or view transitions)
document.addEventListener("astro:page-load", () => {
    header = document.querySelector("[data-header]") as HTMLElement;
    progressBar = document.querySelector("[data-reading-progress]") as HTMLElement;
    if (header) {
        lastScrollY = 0;
        scrollDirectionAnchor = 0;
        isHeaderHidden = false;
        header.classList.remove("header--hidden");
        updateHeaderOffset();
        updateHeader();
    }
});
