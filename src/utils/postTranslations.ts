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
