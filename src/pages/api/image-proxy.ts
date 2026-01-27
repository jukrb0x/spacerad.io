/**
 * Image Proxy API
 *
 * This endpoint proxies external images through Cloudflare to ensure accessibility
 * in regions where direct access to the image source may be blocked.
 *
 * Security: Only allows proxying from approved Telegram domains to prevent abuse.
 *
 * Usage: /api/image-proxy?url=<encoded_image_url>
 */

import type { APIRoute } from "astro";

export const prerender = false;

// Allowed domains for image proxying (Telegram CDN and related domains)
const ALLOWED_DOMAINS = [
    "cdn.telegram-cdn.org",
    "cdn1.telegram-cdn.org",
    "cdn2.telegram-cdn.org",
    "cdn4.telegram-cdn.org",
    "cdn5.telegram-cdn.org",
    "t.me",
    "telegram.org",
    "telesco.pe",
];

/**
 * Validates if a URL is allowed to be proxied
 */
function isAllowedUrl(urlString: string): boolean {
    try {
        const url = new URL(urlString);
        // Only allow HTTPS
        if (url.protocol !== "https:") return false;
        // Check against allowlist
        return ALLOWED_DOMAINS.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    } catch {
        return false;
    }
}

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get("url");

    if (!imageUrl) {
        return new Response("Missing url parameter", { status: 400 });
    }

    // Validate URL against allowlist
    if (!isAllowedUrl(imageUrl)) {
        return new Response("URL not allowed", { status: 403 });
    }

    try {
        // Fetch the image from the original source
        const response = await fetch(imageUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; Cloudflare)",
            },
        });

        if (!response.ok) {
            return new Response("Failed to fetch image", { status: response.status });
        }

        // Get the image data
        const imageData = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") || "image/jpeg";

        // Return the proxied image with appropriate headers
        return new Response(imageData, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (error) {
        console.error("Error proxying image:", error);
        return new Response("Internal server error", { status: 500 });
    }
};
