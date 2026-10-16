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
        if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
        // Check against allowlist
        return ALLOWED_DOMAINS.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    } catch {
        return false;
    }
}

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function failure(message: string, status: number): Response {
    return new Response(message, {
        status,
        headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
}

// Require both a passive raster MIME type and its signature, never upstream HTML/SVG.
function matchesImageType(bytes: Uint8Array, contentType: string): boolean {
    const startsWith = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
    const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
    switch (contentType) {
        case "image/jpeg":
            return startsWith([0xff, 0xd8, 0xff]);
        case "image/png":
            return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        case "image/gif":
            return ["GIF87a", "GIF89a"].includes(ascii(0, 6));
        case "image/webp":
            return bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
        case "image/avif":
            return bytes.length >= 16 && ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12));
        default:
            return false;
    }
}

async function fetchImage(imageUrl: string, signal: AbortSignal): Promise<Response> {
    let currentUrl = imageUrl;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
        if (!isAllowedUrl(currentUrl)) return failure("URL not allowed", 403);
        const response = await fetch(currentUrl, {
            redirect: "manual",
            signal,
            headers: { "User-Agent": "Mozilla/5.0 (compatible; Cloudflare)" },
        });
        if (REDIRECT_STATUSES.has(response.status)) {
            // Do not consume redirect bodies or request a destination before validation.
            void response.body?.cancel().catch(() => {});
            const location = response.headers.get("location");
            if (!location || redirects === MAX_REDIRECTS) return failure("Invalid image redirect", 502);
            try {
                currentUrl = new URL(location, currentUrl).href;
            } catch {
                return failure("Invalid image redirect", 502);
            }
            continue;
        }
        if (!response.ok) {
            void response.body?.cancel().catch(() => {});
            return failure("Failed to fetch image", response.status >= 400 ? response.status : 502);
        }
        const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (!["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"].includes(contentType)) {
            void response.body?.cancel().catch(() => {});
            return failure("Unsupported image type", 415);
        }
        if (Number(response.headers.get("content-length")) > MAX_BYTES) {
            void response.body?.cancel().catch(() => {});
            return failure("Image too large", 413);
        }
        if (!response.body) return failure("Invalid image body", 415);
        const reader = response.body.getReader();
        const cancel = () => {
            void reader.cancel().catch(() => {});
        };
        signal.addEventListener("abort", cancel, { once: true });
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.byteLength;
                if (size > MAX_BYTES) {
                    cancel();
                    return failure("Image too large", 413);
                }
                chunks.push(value);
            }
        } finally {
            signal.removeEventListener("abort", cancel);
            reader.releaseLock();
        }
        const imageData = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
            imageData.set(chunk, offset);
            offset += chunk.byteLength;
        }
        if (!matchesImageType(imageData, contentType)) return failure("Invalid image data", 415);
        return new Response(imageData, {
            headers: {
                "Content-Type": contentType,
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": "*",
            },
        });
    }
    return failure("Too many image redirects", 502);
}

export const GET: APIRoute = async ({ request }) => {
    const imageUrl = new URL(request.url).searchParams.get("url");
    if (!imageUrl) return failure("Missing url parameter", 400);
    if (!isAllowedUrl(imageUrl)) return failure("URL not allowed", 403);

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            fetchImage(imageUrl, controller.signal),
            new Promise<Response>((resolve) => {
                timer = setTimeout(() => {
                    controller.abort();
                    resolve(failure("Image fetch timed out", 504));
                }, TIMEOUT_MS);
            }),
        ]);
    } catch {
        return failure("Failed to fetch image", 502);
    } finally {
        clearTimeout(timer);
        controller.abort();
    }
};
