/**
 * Scroll lock utility for modals, drawers, and overlays
 * Compensates for scrollbar width to prevent layout shift
 */

let lockCount = 0;

function getScrollbarWidth(): number {
    return window.innerWidth - document.documentElement.clientWidth;
}

export function lockScroll(): void {
    if (lockCount === 0) {
        const scrollbarWidth = getScrollbarWidth();

        // Set scrollbar width for CSS compensation
        document.documentElement.style.setProperty("--scrollbar-width", `${scrollbarWidth}px`);
        document.documentElement.classList.add("scroll-locked");
        document.body.classList.add("scroll-locked");
    }
    lockCount++;
}

export function unlockScroll(): void {
    lockCount--;
    if (lockCount <= 0) {
        lockCount = 0;
        document.documentElement.classList.remove("scroll-locked");
        document.body.classList.remove("scroll-locked");
        document.documentElement.style.removeProperty("--scrollbar-width");
    }
}
