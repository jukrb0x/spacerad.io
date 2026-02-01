/**
 * Like API - Post like endpoint (supports multiple likes)
 *
 * GET /api/like?slug=xxx - Get like count and current user's like count
 * POST /api/like { slug } - Like (+1 per click, max 16 per user)
 */

import type { APIRoute } from "astro";

export const prerender = false;

// Maximum likes per user
const MAX_LIKES_PER_USER = 16;

interface LikeData {
    count: number;
    // Like count per IP hash
    likes: Record<string, number>;
}

/**
 * Convert IP address to SHA-256 hash (privacy protection)
 */
async function hashIP(ip: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get client IP address
 */
function getClientIP(request: Request): string {
    // Real IP provided by Cloudflare
    const cfIP = request.headers.get("CF-Connecting-IP");
    if (cfIP) return cfIP;

    // Standard proxy headers
    const forwardedFor = request.headers.get("X-Forwarded-For");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();

    // Local development environment
    return "127.0.0.1";
}

export const GET: APIRoute = async ({ request, locals }) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
        return new Response(JSON.stringify({ error: "Missing slug parameter" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const kv = locals.runtime.env.LIKES;

        // Local dev environment has no KV, return mock data
        if (!kv) {
            return new Response(JSON.stringify({ count: 0, userLikes: 0, maxLikes: MAX_LIKES_PER_USER }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        const data = await kv.get<LikeData>(`like:${slug}`, "json");
        const clientIP = getClientIP(request);
        const ipHash = await hashIP(clientIP);

        const count = data?.count ?? 0;
        const userLikes = data?.likes?.[ipHash] ?? 0;

        return new Response(JSON.stringify({ count, userLikes, maxLikes: MAX_LIKES_PER_USER }), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
            },
        });
    } catch (error) {
        console.error("Error getting like data:", error);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const body = await request.json();
        const { slug } = body as { slug?: string };

        if (!slug) {
            return new Response(JSON.stringify({ error: "Missing slug" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const kv = locals.runtime.env.LIKES;

        // Mock data for local KV
        if (!kv) {
            return new Response(JSON.stringify({ count: 1, userLikes: 1, maxLikes: MAX_LIKES_PER_USER }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        const clientIP = getClientIP(request);
        const ipHash = await hashIP(clientIP);

        // Get current data
        const data: LikeData = (await kv.get<LikeData>(`like:${slug}`, "json")) ?? {
            count: 0,
            likes: {},
        };

        const currentUserLikes = data.likes[ipHash] ?? 0;

        // Check if limit reached
        if (currentUserLikes >= MAX_LIKES_PER_USER) {
            return new Response(
                JSON.stringify({
                    count: data.count,
                    userLikes: currentUserLikes,
                    maxLikes: MAX_LIKES_PER_USER,
                    maxReached: true,
                }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": "no-cache",
                    },
                },
            );
        }

        // Increment like
        data.count += 1;
        data.likes[ipHash] = currentUserLikes + 1;

        // Save data
        await kv.put(`like:${slug}`, JSON.stringify(data));

        return new Response(
            JSON.stringify({
                count: data.count,
                userLikes: data.likes[ipHash],
                maxLikes: MAX_LIKES_PER_USER,
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                },
            },
        );
    } catch (error) {
        console.error("Error processing like:", error);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
