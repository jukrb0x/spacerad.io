/**
 * Calculate reading time for a given text content.
 * Uses 200 words per minute as the average reading speed.
 */
export function calculateReadingTime(content: string): string {
    const wordsPerMinute = 200;
    // Strip markdown/HTML and count words
    const cleanContent = content
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/`[^`]+`/g, '') // Remove inline code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with text
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/[#*_~]/g, '') // Remove markdown formatting
        .trim();

    const wordCount = cleanContent.split(/\s+/).filter(word => word.length > 0).length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);

    return `${minutes} min read`;
}
