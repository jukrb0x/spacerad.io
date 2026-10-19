import type { BlogPost } from "./posts";

// Verified translations of the same essay, rather than similarly named posts.
export const translationPairs = [
    ["ue5-landscape-grass", "ue5-landscape-grass-en"],
    ["ue5-landscape-grass-memory-optimization-visibility-culling", "ue5-landscape-grass-memory-optimization-visibility-culling-en"],
] as const;

export function getPostTranslation(id: string, posts: BlogPost[]): BlogPost | undefined {
    const pair = translationPairs.find((pair) => pair.some((candidate) => candidate === id));
    const counterpart = pair?.find((candidate) => candidate !== id);
    return posts.find((post) => post.id === counterpart);
}

/** Keep each original's ordering and select only independently authored counterparts. */
export function getHomePosts(posts: BlogPost[], language: "en" | "zh", limit = 5): BlogPost[] {
    const published = posts.filter((post) => !post.data.draft);
    const originals = published.filter((post) => post.data.lang !== "en" || !getPostTranslation(post.id, published));
    return originals.slice(0, limit).map((post) => {
        const translation = getPostTranslation(post.id, published);
        return post.data.lang === language ? post : translation?.data.lang === language ? translation : post;
    });
}
