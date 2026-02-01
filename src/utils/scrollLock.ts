/**
 * Scroll lock utility for modals, drawers, and overlays
 *
 * All overlays (drawers, lightbox) use <dialog> with showModal()/close(),
 * which leverages the browser's native top layer. iOS Safari handles viewport
 * recalculation correctly for top-layer elements, avoiding the address bar gap.
 *
 * lockScrollForDialog() provides light touch-event prevention for iOS Safari,
 * since showModal() already handles most background interaction blocking.
 */

interface ScrollLockState {
  lockCount: number;
  scrollY: number;
}

const state: ScrollLockState = {
  lockCount: 0,
  scrollY: 0,
};

// Event handler for cleanup
let touchMoveHandler: ((e: TouchEvent) => void) | null = null;

/**
 * Scroll lock for dialog elements (drawers, lightbox, modals)
 * Dialogs with showModal() already prevent background interaction,
 * but we still need to prevent iOS Safari touch scrolling on the backdrop
 */
export function lockScrollForDialog(): void {
  if (state.lockCount === 0) {
    state.scrollY = window.scrollY;

    // Only add touch prevention for iOS
    touchMoveHandler = (e: TouchEvent) => {
      const target = e.target as Element;
      // Allow scrolling inside the dialog (scroll containers, dialog content)
      if (target.closest('dialog')) {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
  }
  state.lockCount++;
}

export function unlockScrollForDialog(): void {
  state.lockCount--;
  if (state.lockCount <= 0) {
    state.lockCount = 0;

    if (touchMoveHandler) {
      document.removeEventListener('touchmove', touchMoveHandler);
      touchMoveHandler = null;
    }
  }
}
