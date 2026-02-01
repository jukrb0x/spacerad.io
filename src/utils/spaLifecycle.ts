/**
 * SPA Lifecycle Utilities
 * Standardize SPA initialization patterns and listener management
 */

/**
 * Auto-initialize a function on DOMContentLoaded and astro:after-swap
 * This is the standard pattern for re-initializing features after SPA navigation
 *
 * @param initFn - Function to call on initialization
 * @param event - Which Astro event to listen for ('after-swap' or 'page-load')
 */
export function autoInit(initFn: () => void, event: "after-swap" | "page-load" = "after-swap"): void {
	const astroEvent = event === "after-swap" ? "astro:after-swap" : "astro:page-load";

	// Run on initial load
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initFn, { once: true });
	} else {
		initFn();
	}

	// Re-run after SPA navigation
	document.addEventListener(astroEvent, initFn);
}

/**
 * Create a persistent listener that only attaches once across navigations
 * Use this for global listeners (scroll, resize) that should persist
 *
 * @param target - Event target (window, document, etc.)
 * @param event - Event name
 * @param handler - Event handler
 * @param options - Event listener options
 * @returns Cleanup function to remove the listener
 */
export function createPersistentListener(
	target: EventTarget,
	event: string,
	handler: EventListener,
	options?: AddEventListenerOptions,
): () => void {
	let attached = false;

	const attach = () => {
		if (!attached) {
			attached = true;
			target.addEventListener(event, handler, options);
		}
	};

	// Attach immediately
	attach();

	// Return cleanup function
	return () => {
		if (attached) {
			target.removeEventListener(event, handler, options);
			attached = false;
		}
	};
}

/**
 * Create a listener that auto-cleans up on navigation
 * Use this for page-specific listeners that should be removed on navigation
 *
 * @param target - Event target
 * @param event - Event name
 * @param handler - Event handler
 * @param options - Event listener options
 */
export function createNavigationListener(
	target: EventTarget,
	event: string,
	handler: EventListener,
	options?: AddEventListenerOptions,
): void {
	const controller = new AbortController();
	const signal = controller.signal;

	// Add listener with abort signal
	target.addEventListener(event, handler, { ...options, signal });

	// Clean up on navigation
	document.addEventListener(
		"astro:before-swap",
		() => {
			controller.abort();
		},
		{ once: true },
	);
}

/**
 * Guard pattern for ensuring initialization happens only once
 * Returns a wrapped function that only executes once
 *
 * @param fn - Function to guard
 * @returns Guarded function that only executes once
 */
export function once<T extends (...args: unknown[]) => void>(fn: T): T {
	let called = false;
	return ((...args: unknown[]) => {
		if (!called) {
			called = true;
			fn(...args);
		}
	}) as T;
}
