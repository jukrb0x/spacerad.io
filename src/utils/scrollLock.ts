/**
 * Scroll lock utility for modals, drawers, and overlays
 * Designed to work with iOS Safari without triggering viewport recalculation
 *
 * Key insight: Modifying overflow on html/body triggers iOS Safari to recalculate
 * the viewport (showing/hiding address bar). Instead, we prevent scrolling via:
 * 1. Touch event prevention for iOS
 * 2. Wheel event prevention for desktop
 * 3. CSS touch-action for additional prevention
 */

interface ScrollLockState {
  lockCount: number;
  scrollY: number;
}

const state: ScrollLockState = {
  lockCount: 0,
  scrollY: 0,
};

// Event handlers for cleanup
let touchMoveHandler: ((e: TouchEvent) => void) | null = null;
let wheelHandler: ((e: WheelEvent) => void) | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;

function isScrollableElement(el: Element | null): boolean {
  while (el && el !== document.body) {
    if (el.hasAttribute('data-scroll-container')) {
      return true;
    }
    // Check for dialogs (lightbox)
    if (el.tagName === 'DIALOG') {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

function canScrollInDirection(el: Element, deltaY: number): boolean {
  const scrollableEl = el.closest('[data-scroll-container]') as HTMLElement;
  if (!scrollableEl) return false;

  const { scrollTop, scrollHeight, clientHeight } = scrollableEl;
  const atTop = scrollTop <= 0;
  const atBottom = scrollTop + clientHeight >= scrollHeight;

  // Allow scroll if not at boundary
  if (deltaY < 0 && !atTop) return true;
  if (deltaY > 0 && !atBottom) return true;

  return false;
}

export function lockScroll(): void {
  if (state.lockCount === 0) {
    state.scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;

    // Add scroll-locked class (CSS applies touch-action: none)
    html.classList.add('scroll-locked');
    body.classList.add('scroll-locked');

    // Prevent touch scrolling on iOS
    touchMoveHandler = (e: TouchEvent) => {
      const target = e.target as Element;

      // Allow scrolling inside scroll containers
      if (isScrollableElement(target)) {
        // Check if we should allow the scroll (not at boundary)
        const touch = e.touches[0];
        const startY = (e as any)._startY ?? touch.clientY;
        const deltaY = startY - touch.clientY;

        if (canScrollInDirection(target, deltaY)) {
          return;
        }
      }

      e.preventDefault();
    };

    // Track touch start for direction detection
    const touchStartHandler = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        (e as any)._startY = e.touches[0].clientY;
      }
    };

    // Prevent wheel scrolling on desktop (but allow in scroll containers)
    wheelHandler = (e: WheelEvent) => {
      const target = e.target as Element;

      if (isScrollableElement(target)) {
        if (canScrollInDirection(target, e.deltaY)) {
          return;
        }
      }

      e.preventDefault();
    };

    // Prevent keyboard scrolling (arrow keys, space, page up/down)
    keyHandler = (e: KeyboardEvent) => {
      const scrollKeys = ['ArrowUp', 'ArrowDown', 'Space', 'PageUp', 'PageDown', 'Home', 'End'];
      if (scrollKeys.includes(e.code)) {
        const target = e.target as Element;
        if (!isScrollableElement(target)) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('touchstart', touchStartHandler, { passive: true });
    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
    document.addEventListener('wheel', wheelHandler, { passive: false });
    document.addEventListener('keydown', keyHandler);

    // Store touchstart handler for cleanup
    (touchMoveHandler as any)._touchStartHandler = touchStartHandler;
  }
  state.lockCount++;
}

export function unlockScroll(): void {
  state.lockCount--;
  if (state.lockCount <= 0) {
    state.lockCount = 0;
    const html = document.documentElement;
    const body = document.body;

    // Remove scroll-locked class
    html.classList.remove('scroll-locked');
    body.classList.remove('scroll-locked');

    // Remove event handlers
    if (touchMoveHandler) {
      const touchStartHandler = (touchMoveHandler as any)._touchStartHandler;
      if (touchStartHandler) {
        document.removeEventListener('touchstart', touchStartHandler);
      }
      document.removeEventListener('touchmove', touchMoveHandler);
      touchMoveHandler = null;
    }
    if (wheelHandler) {
      document.removeEventListener('wheel', wheelHandler);
      wheelHandler = null;
    }
    if (keyHandler) {
      document.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }

    // Restore scroll position
    window.scrollTo(0, state.scrollY);
  }
}

/**
 * Light scroll lock for dialog elements
 * Dialogs with showModal() already prevent background interaction,
 * but we still need to prevent iOS Safari touch scrolling on the backdrop
 */
export function lockScrollForDialog(): void {
  if (state.lockCount === 0) {
    state.scrollY = window.scrollY;

    // Only add touch prevention for iOS
    touchMoveHandler = (e: TouchEvent) => {
      const target = e.target as Element;
      // Allow scrolling inside the dialog
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
