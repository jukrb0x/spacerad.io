import type { APIRoute } from "astro";
export const prerender = false;
export const GET: APIRoute = async ({ request }) => {
    const host = (import.meta.env.PUBLIC_REMARK_URL || "https://remark42.example.com").replace(/\/$/, "");
    try {
        const response = await fetch(`${host}/web/embed.js`, { signal: request.signal });
        if (!response.ok) throw new Error("Comment script unavailable");
        return new Response(response.body, {
            headers: {
                "Content-Type": "application/javascript; charset=utf-8",
                "Cache-Control": "public, max-age=14400",
            },
        });
    } catch {
        return new Response("", { status: 502 });
    }
};
