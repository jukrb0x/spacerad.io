import { type CollectionEntry, getCollection } from "astro:content";

const isDev = import.meta.env.DEV;

export type BlogPost = CollectionEntry<"blog">;

/**
 * Returns published blog posts: excludes hidden, and excludes drafts in production.
 * Sorted by publication date descending (newest first).
 */
export async function getPublishedPosts(): Promise<BlogPost[]> {
	const posts = await getCollection("blog", (post) => {
		if (post.data.hidden) return false;
		if (post.data.draft && !isDev) return false;
		return true;
	});

	return posts.sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);
}

/**
 * Returns all renderable blog posts (for static path generation).
 * Excludes drafts in production but keeps hidden posts (they have routes, just aren't listed).
 */
export async function getAllRenderablePosts(): Promise<BlogPost[]> {
	return getCollection("blog", (post) => {
		if (post.data.draft && !isDev) return false;
		return true;
	});
}

/** Group posts by year, preserving insertion order (assumes pre-sorted). */
export function groupPostsByYear(
	posts: BlogPost[],
): [string, BlogPost[]][] {
	const byYear = new Map<string, BlogPost[]>();
	for (const post of posts) {
		const year = String(post.data.pubDate.getFullYear());
		let group = byYear.get(year);
		if (!group) {
			group = [];
			byYear.set(year, group);
		}
		group.push(post);
	}
	return Array.from(byYear.entries());
}
