/**
 * Extract description from Markdown content
 * @param content - Markdown content
 * @param maxLength - Maximum length (default 80 characters)
 * @returns Extracted description text
 */
export function extractDescription(content: string, maxLength: number = 80): string {
    // Remove frontmatter
    const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\s*/m, "");

    // Remove Markdown syntax
    const plainText = contentWithoutFrontmatter
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, "")
        // Remove inline code
        .replace(/`[^`]*`/g, "")
        // Remove links
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        // Remove images
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
        // Remove heading markers
        .replace(/^#{1,6}\s+/gm, "")
        // Remove bold and italic markers
        .replace(/(\*{1,2}|_{1,2})([^*_]+)\1/g, "$2")
        // Remove quote markers
        .replace(/^>\s+/gm, "")
        // Remove list markers
        .replace(/^[\s]*[-*+]\s+/gm, "")
        .replace(/^[\s]*\d+\.\s+/gm, "")
        // Remove horizontal rules
        .replace(/^(-{3,}|_{3,}|\*{3,})$/gm, "")
        // Remove HTML tags
        .replace(/<[^>]+>/g, "")
        // Remove extra whitespace
        .replace(/\s+/g, " ")
        .trim();

    // Return default description if content is empty
    if (!plainText) {
        return "No description";
    }

    // Return text if within max length
    if (plainText.length <= maxLength) {
        return plainText;
    }

    // Truncate at last complete sentence or word boundary
    let truncated = plainText.substring(0, maxLength);

    // Try to truncate at sentence endings
    const lastSentenceEnd = Math.max(
        truncated.lastIndexOf("."),
        truncated.lastIndexOf("!"),
        truncated.lastIndexOf("?"),
    );

    if (lastSentenceEnd > maxLength * 0.8) {
        truncated = truncated.substring(0, lastSentenceEnd + 1);
    } else {
        // If no suitable sentence ending, truncate at last space
        const lastSpace = truncated.lastIndexOf(" ");
        if (lastSpace > maxLength * 0.8) {
            truncated = truncated.substring(0, lastSpace);
        }
        truncated += "...";
    }

    return truncated;
}
