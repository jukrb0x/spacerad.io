/**
 * Scroll lock utility for modals, drawers, and overlays
 *
 * All overlays (drawers, lightbox) use <dialog> with showModal()/close(),
 * which leverages the browser's native top layer. This utility adds additional
 * scroll prevention for cases where the browser's native blocking isn't sufficient.
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
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

// Keys that cause scrolling
const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];

/**
 * Scroll lock for dialog elements (drawers, lightbox, modals)
 * Prevents scrolling on the background page while dialog is open
 */
export function lockScrollForDialog(): void {
	if (state.lockCount === 0) {
		state.scrollY = window.scrollY;

		// Prevent body scroll by adding overflow: hidden
		document.body.style.overflow = "hidden";
		document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`;
		document.documentElement.style.scrollBehavior = "auto";

		// Touch prevention for mobile
		touchMoveHandler = (e: TouchEvent) => {
			const target = e.target as Element;
			// Allow scrolling inside the dialog
			const dialog = target.closest("dialog");
			if (dialog) {
				// Check if the content inside dialog is scrollable
				const scrollContainer = target.closest("[data-scroll-container]");
				if (scrollContainer) return;
			}
			e.preventDefault();
		};
		document.addEventListener("touchmove", touchMoveHandler, { passive: false });

		// Wheel prevention for desktop
		wheelHandler = (e: WheelEvent) => {
			const target = e.target as Element;
			// Allow scrolling inside dialog scroll containers
			const dialog = target.closest("dialog");
			if (dialog) {
				const scrollContainer = target.closest("[data-scroll-container]");
				if (scrollContainer) return;
			}
			e.preventDefault();
		};
		document.addEventListener("wheel", wheelHandler, { passive: false });

		// Keyboard scroll prevention
		keydownHandler = (e: KeyboardEvent) => {
			// Allow these keys inside dialogs
			const target = e.target as Element;
			const dialog = target.closest("dialog");
			if (dialog) {
				const scrollContainer = target.closest("[data-scroll-container]");
				if (scrollContainer) return;
			}

			// Prevent scroll keys on body
			if (SCROLL_KEYS.includes(e.key)) {
				e.preventDefault();
			}
		};
		document.addEventListener("keydown", keydownHandler, { passive: false });
	}
	state.lockCount = Math.max(0, state.lockCount + 1);
}

export function unlockScrollForDialog(): void {
	state.lockCount = Math.max(0, state.lockCount - 1);
	if (state.lockCount === 0) {
		// Remove overflow hidden and padding
		document.body.style.overflow = "";
		document.body.style.paddingRight = "";
		document.documentElement.style.scrollBehavior = "";

		// Remove touch handler
		if (touchMoveHandler) {
			document.removeEventListener("touchmove", touchMoveHandler);
			touchMoveHandler = null;
		}

		// Remove wheel handler
		if (wheelHandler) {
			document.removeEventListener("wheel", wheelHandler);
			wheelHandler = null;
		}

		// Remove keyboard handler
		if (keydownHandler) {
			document.removeEventListener("keydown", keydownHandler);
			keydownHandler = null;
		}

		// Restore scroll position
		window.scrollTo(0, state.scrollY);
	}
}
