/**
 * Scroll lock utility for modals, drawers, and overlays
 */

let lockCount = 0;

export function lockScroll(): void {
    if (lockCount === 0) {
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
    }
}
