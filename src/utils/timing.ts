/**
 * Timing Utilities
 * Reusable debounce and throttle functions for rate-limiting function calls
 */

/**
 * Debounce a function - delays execution until after a period of inactivity
 * @param fn - The function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
	let timeoutId: number | null = null;
	return ((...args: unknown[]) => {
		if (timeoutId !== null) clearTimeout(timeoutId);
		timeoutId = window.setTimeout(() => {
			fn(...args);
			timeoutId = null;
		}, delay);
	}) as T;
}

/**
 * Throttle a function - limits execution to once per time period
 * @param fn - The function to throttle
 * @param delay - Minimum delay between executions in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
	let timeoutId: number | null = null;
	return ((...args: unknown[]) => {
		if (timeoutId !== null) return;
		timeoutId = window.setTimeout(() => {
			fn(...args);
			timeoutId = null;
		}, delay);
	}) as T;
}
