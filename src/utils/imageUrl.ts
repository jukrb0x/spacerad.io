/**
 * Image URL Utilities
 * Helper functions for extracting image URLs from various formats
 */

import type { ImageMetadata } from "astro";

/**
 * Extract a string URL from an ImageMetadata object or string
 * @param img - Image source (ImageMetadata, string, or undefined)
 * @param fallback - Fallback URL if img is undefined
 * @returns String URL
 */
export function getImageUrl(
	img: ImageMetadata | string | undefined,
	fallback: string = "",
): string {
	if (!img) return fallback;
	if (typeof img === "object" && "src" in img) return img.src;
	return img;
}

/**
 * Get absolute URL for an image
 * @param img - Image source
 * @param fallback - Fallback URL
 * @returns Absolute URL
 */
export function getAbsoluteImageUrl(
	img: ImageMetadata | string | undefined,
	fallback: string = "",
): string {
	const url = getImageUrl(img, fallback);
	if (!url) return fallback;

	try {
		return new URL(url, import.meta.env.SITE || "https://spacerad.io").href;
	} catch {
		return url;
	}
}
