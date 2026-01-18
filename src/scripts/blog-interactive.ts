/**
 * Blog Interactive Features
 * - TOC scroll synchronization
 * - Active heading tracking
 * - Mobile TOC drawer
 * - Share sidebar visibility
 */

const TOC_SELECTOR = "[data-toc-link]";
const TOC_SIDEBAR_SELECTOR = "[data-toc-sidebar]";
const SHARE_SIDEBAR_SELECTOR = "[data-share-sidebar]";
const ARTICLE_HEADER_SELECTOR = "[data-article-header]";
const MOBILE_TOC_TOGGLE_SELECTOR = "[data-toc-mobile-toggle]";
const MOBILE_TOC_DRAWER_SELECTOR = "[data-toc-mobile-drawer]";
const MOBILE_TOC_OVERLAY_SELECTOR = "[data-toc-mobile-overlay]";
const MOBILE_TOC_CONTENT_SELECTOR = "[data-toc-mobile-content]";
const MOBILE_TOC_CLOSE_SELECTOR = "[data-toc-mobile-close]";

let tocLinks: HTMLAnchorElement[] = [];
let headings: HTMLElement[] = [];
let tocSidebar: HTMLElement | null = null;
let shareSidebar: HTMLElement | null = null;
let articleHeader: HTMLElement | null = null;
let mobileDrawer: HTMLElement | null = null;
let mobileOverlay: HTMLElement | null = null;
let mobileContent: HTMLElement | null = null;
let isMobileDrawerOpen = false;

/**
 * Initialize TOC scroll tracking
 */
function initTocTracking() {
    tocLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(TOC_SELECTOR));

    if (!tocLinks.length) return;

    // Get all headings that correspond to TOC links
    headings = tocLinks
        .map((link) => {
            const id = link.dataset.headingId;
            return id ? document.getElementById(id) : null;
        })
        .filter((el): el is HTMLElement => el !== null);

    if (!headings.length) return;

    // Set up intersection observer for active heading
    const observerOptions: IntersectionObserverInit = {
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                setActiveLink(id);
            }
        });
    }, observerOptions);

    headings.forEach((heading) => observer.observe(heading));

    // Handle TOC link clicks with smooth scroll
    tocLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const id = link.dataset.headingId;
            if (!id) return;

            const target = document.getElementById(id);
            if (target) {
                const offset = 80; // Account for fixed header
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: "smooth" });

                // Close mobile drawer if open
                if (isMobileDrawerOpen) {
                    closeMobileDrawer();
                }
            }
        });
    });
}

/**
 * Set active TOC link
 */
function setActiveLink(id: string) {
    tocLinks.forEach((link) => {
        const isActive = link.dataset.headingId === id;
        link.classList.toggle("active", isActive);
    });
}

/**
 * Initialize sidebar visibility management
 */
function initSidebarVisibility() {
    tocSidebar = document.querySelector<HTMLElement>(TOC_SIDEBAR_SELECTOR);
    shareSidebar = document.querySelector<HTMLElement>(SHARE_SIDEBAR_SELECTOR);
    articleHeader = document.querySelector<HTMLElement>(ARTICLE_HEADER_SELECTOR);

    if (!articleHeader) return;

    const updateSidebarVisibility = () => {
        const headerRect = articleHeader!.getBoundingClientRect();
        const headerBottom = headerRect.bottom;
        const shouldShow = headerBottom < 100;

        if (tocSidebar) {
            tocSidebar.style.opacity = shouldShow ? "1" : "0";
        }
        if (shareSidebar) {
            shareSidebar.style.opacity = shouldShow ? "1" : "0";
        }
    };

    // Initial check
    updateSidebarVisibility();

    // Update on scroll with throttling
    let ticking = false;
    window.addEventListener("scroll", () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateSidebarVisibility();
                ticking = false;
            });
            ticking = true;
        }
    });
}

/**
 * Initialize mobile TOC drawer
 */
function initMobileDrawer() {
    const toggle = document.querySelector<HTMLButtonElement>(MOBILE_TOC_TOGGLE_SELECTOR);
    mobileDrawer = document.querySelector<HTMLElement>(MOBILE_TOC_DRAWER_SELECTOR);
    mobileOverlay = document.querySelector<HTMLElement>(MOBILE_TOC_OVERLAY_SELECTOR);
    mobileContent = document.querySelector<HTMLElement>(MOBILE_TOC_CONTENT_SELECTOR);
    const closeBtn = document.querySelector<HTMLButtonElement>(MOBILE_TOC_CLOSE_SELECTOR);

    if (!toggle || !mobileDrawer) return;

    toggle.addEventListener("click", () => {
        if (isMobileDrawerOpen) {
            closeMobileDrawer();
        } else {
            openMobileDrawer();
        }
    });

    closeBtn?.addEventListener("click", closeMobileDrawer);
    mobileOverlay?.addEventListener("click", closeMobileDrawer);

    // Close on escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && isMobileDrawerOpen) {
            closeMobileDrawer();
        }
    });
}

function openMobileDrawer() {
    if (!mobileDrawer || !mobileOverlay || !mobileContent) return;

    isMobileDrawerOpen = true;
    mobileDrawer.classList.remove("pointer-events-none");
    mobileDrawer.setAttribute("aria-hidden", "false");
    mobileOverlay.classList.remove("opacity-0", "pointer-events-none");
    mobileContent.classList.remove("translate-x-full");
    document.body.classList.add("scroll-locked");
}

function closeMobileDrawer() {
    if (!mobileDrawer || !mobileOverlay || !mobileContent) return;

    isMobileDrawerOpen = false;
    mobileDrawer.classList.add("pointer-events-none");
    mobileDrawer.setAttribute("aria-hidden", "true");
    mobileOverlay.classList.add("opacity-0", "pointer-events-none");
    mobileContent.classList.add("translate-x-full");
    document.body.classList.remove("scroll-locked");
}

/**
 * Main initialization function
 */
export function initBlogInteractive() {
    initTocTracking();
    initSidebarVisibility();
    initMobileDrawer();
}

// Auto-initialize on page load and Astro navigation
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBlogInteractive, { once: true });
} else {
    initBlogInteractive();
}

window.addEventListener("astro:after-swap", initBlogInteractive);
