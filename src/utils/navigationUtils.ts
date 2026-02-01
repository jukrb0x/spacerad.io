/**
 * Navigation Utilities
 * Helper functions for navigation and active link detection
 */

/**
 * Check if a link is active based on the current pathname
 *
 * @param href - The link href to check
 * @param pathname - The current pathname
 * @returns True if the link is active
 */
export function isActiveLink(href: string, pathname: string): boolean {
	// Normalize pathname by removing base URL
	const normalizedPath = pathname.replace(import.meta.env.BASE_URL || "", "");

	// Exact match
	if (href === normalizedPath) return true;

	// Match first path segment (e.g., /posts matches /posts/*)
	const subpath = normalizedPath.match(/[^/]+/g);
	const firstSegment = subpath?.[0] || "";

	return href === `/${firstSegment}`;
}

/**
 * Get the parent path from a given pathname
 * Useful for "Back" navigation
 *
 * @param pathname - The current pathname
 * @returns The parent path
 */
export function getParentPath(pathname: string): string {
	const segments = pathname.split("/").filter(Boolean);
	segments.pop(); // Remove last segment
	return segments.length > 0 ? `/${segments.join("/")}` : "/";
}
