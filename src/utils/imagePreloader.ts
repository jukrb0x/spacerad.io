/**
 * Image Preloader Utility
 * Manages image preloading with state tracking to prevent duplicate requests
 */

export type ImageLoadState = "idle" | "loading" | "loaded" | "error";

// Image cache: tracks load state to prevent duplicate requests
const imageCache = new Map<string, ImageLoadState>();

/**
 * Preload an image and update cache state
 * @param src - Image source URL
 * @returns Promise that resolves when image is loaded or fails
 */
export function preloadImage(src: string): Promise<void> {
	const state = imageCache.get(src);

	// Already loaded or loading
	if (state === "loaded") return Promise.resolve();
	if (state === "loading") {
		return new Promise((resolve) => {
			const check = () => {
				const s = imageCache.get(src);
				if (s === "loaded" || s === "error") resolve();
				else requestAnimationFrame(check);
			};
			check();
		});
	}

	// Start loading
	imageCache.set(src, "loading");

	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			imageCache.set(src, "loaded");
			resolve();
		};
		img.onerror = () => {
			imageCache.set(src, "error");
			resolve();
		};
		img.src = src;
	});
}

/**
 * Get the current load state of an image
 * @param src - Image source URL
 * @returns Current load state or undefined if not in cache
 */
export function getImageState(src: string): ImageLoadState | undefined {
	return imageCache.get(src);
}

/**
 * Clear the image cache (useful for testing or memory management)
 */
export function clearImageCache(): void {
	imageCache.clear();
}
