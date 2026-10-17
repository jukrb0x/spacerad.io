import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";

// Keep imported HTML passive. Raw-text/foreign nodes are removed before this
// policy because the pinned sanitizer predates its raw-text parser fixes.
const importedHtmlPolicy = {
    allowedTags: [
        "a",
        "b",
        "strong",
        "i",
        "em",
        "u",
        "s",
        "del",
        "strike",
        "span",
        "tg-spoiler",
        "code",
        "pre",
        "blockquote",
        "br",
        "p",
        "div",
        "ol",
        "ul",
        "li",
        "img",
    ],
    allowedAttributes: {
        "*": ["dir"],
        blockquote: ["expandable"],
        a: ["href", "target", "rel"],
        img: ["src", "alt", "loading", "class", "width", "height"],
        div: ["class"],
        span: ["class"],
        i: ["class"],
        code: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel", "tg"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
};

function telegramLink(value: string, channelUsername: string): string {
    if (!value) return "";
    try {
        const url = new URL(value, `https://t.me/s/${channelUsername}`);
        return ["https:", "http:", "mailto:", "tel:", "tg:"].includes(url.protocol) ? url.href : "";
    } catch {
        return "";
    }
}

export interface LinkPreview {
    url: string;
    siteName?: string;
    title?: string;
    description?: string;
    imageUrl?: string;
}

export interface ReplyInfo {
    replyToText?: string;
    replyToAuthor?: string;
    replyToLink?: string;
}

export interface TelegramPost {
    id: string;
    datetime: string;
    title: string;
    content: string;
    /** First posted photo, exposed for the homepage without parsing content HTML. */
    previewImage?: string;
    text: string;
    forwardedFrom?: string;
    forwardedFromLink?: string;
    linkPreview?: LinkPreview;
    replyInfo?: ReplyInfo;
    hashtags?: string[];
}

export interface TelegramChannel {
    title: string;
    /** Plain upstream description, before HTML/list formatting; keep line boundaries. */
    descriptionText: string;
    description: string;
    avatar: string;
    posts: TelegramPost[];
}

export interface FetchOptions {
    before?: string;
    after?: string;
}

/**
 * Proxy external image URLs through our image proxy API
 * This ensures images are accessible in regions where direct access may be blocked
 */
function getProxiedImageUrl(imageUrl: string): string {
    if (!imageUrl) return "";
    return `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
}

/**
 * Fetch and parse Telegram channel information from public web page
 * @param channelUsername - Telegram channel username (without @)
 * @param options - Pagination options (before/after message ID)
 * @returns Channel information including posts
 */
export async function fetchTelegramChannel(channelUsername: string, options: FetchOptions = {}): Promise<TelegramChannel> {
    const params = new URLSearchParams();
    if (options.before) params.append("before", options.before);
    if (options.after) params.append("after", options.after);

    const queryString = params.toString();
    const url = `https://t.me/s/${channelUsername}${queryString ? `?${queryString}` : ""}`;

    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) {
            throw new Error(`Failed to fetch channel: ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract channel info
        const title = $(".tgme_channel_info_header_title").text().trim();
        // Get description HTML to preserve line breaks
        const $description = $(".tgme_channel_info_description");
        $description.find("br").replaceWith("\n");

        const descriptionText = $description.text().replace(/\r\n?/g, "\n");

        // Convert numbered lists in description
        let description = $("<div>").text($description.text().trim()).html() || "";
        // Replace numbered lists with HTML
        description = description.replace(/(?:^|\n)(\d+)\.\s+(.+?)(?=\n\d+\.\s+|\n\n|$)/gs, (_match, num, text) => {
            if (num === "1") {
                return `<ol><li>${text.trim()}</li>`;
            }
            return `<li>${text.trim()}</li>`;
        });
        // Close the last <ol> tag if there was a list
        if (description.includes("<ol>")) {
            description = description.replace(/(<li>.*?<\/li>)(?!.*<li>)/s, "$1</ol>");
        }

        const avatarSrc = $(".tgme_page_photo_image img").attr("src") || "";
        const avatar = getProxiedImageUrl(avatarSrc);

        // Extract posts
        const posts: TelegramPost[] = [];
        $(".tgme_widget_message_wrap").each((_index, element) => {
            const $message = $(element).find(".tgme_widget_message");
            const id = $message.attr("data-post")?.replace(`${channelUsername}/`, "") || "";

            // Skip if no valid ID
            if (!id) return;

            // Get datetime
            const datetime = $message.find(".tgme_widget_message_date time").attr("datetime") || "";
            if (!datetime) {
                console.warn(`Missing datetime for message ${id}`);
            }

            // Check if message is forwarded
            const $forwardedFromElem = $message.find(".tgme_widget_message_forwarded_from_name");
            const forwardedFrom = $forwardedFromElem.text().trim();
            const forwardedFromLink = telegramLink($forwardedFromElem.attr("href") || "", channelUsername) || undefined;

            // Get text content (use .js-message_text to avoid matching reply/quote text)
            const $text = $message.find(".tgme_widget_message_text.js-message_text");
            const text = $text.text().trim();

            // Generate title from first sentence or first line
            const title = text.match(/^.*?(?=[。\n]|$)/)?.[0] || text.substring(0, 100);

            // Process content HTML
            const $content = $text.clone();
            $content
                .find("script, style, xmp, textarea, title, plaintext, svg, math, iframe, object, embed, noscript, noembed, noframes, template")
                .remove();

            // Convert <br> to newlines for better text formatting
            $content.find("br").replaceWith("\n");

            // Remove inline styles from emojis
            $content.find(".emoji").removeAttr("style");

            // Add target and rel to links
            $content.find("a").each((_, link) => {
                const $link = $(link);
                const href = telegramLink($link.attr("href") || "", channelUsername);
                if (href) $link.attr("href", href);
                else $link.removeAttr("href");
                $link.attr("target", "_blank").attr("rel", "noopener noreferrer");
            });

            // Get images
            const images: string[] = [];
            let photoDimensions: { width: number; height: number } | undefined;
            $message.find(".tgme_widget_message_photo_wrap").each((_, photo) => {
                const style = $(photo).attr("style") || "";
                const match = style.match(/url\(['"](.+?)['"]\)/);
                if (match?.[1]) {
                    images.push(getProxiedImageUrl(match[1]));
                    // Telegram single-photo wrappers retain the media width and
                    // proportional spacer. Album frames are cropped: never use them.
                    if (!$(photo).hasClass("grouped_media_wrap")) {
                        const widths = [...style.matchAll(/(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px\s*(?=;|$)/g)];
                        const spacer = $(photo).children(".tgme_widget_message_photo").attr("style") || "";
                        const paddings = [...spacer.matchAll(/(?:^|;)\s*padding-top\s*:\s*(\d+(?:\.\d+)?)%\s*(?=;|$)/g)];
                        if (widths.length === 1 && paddings.length === 1) {
                            const width = Number(widths[0][1]);
                            const height = (width * Number(paddings[0][1])) / 100;
                            if (
                                Number.isInteger(width) &&
                                width > 0 &&
                                width <= 32768 &&
                                height > 0 &&
                                height <= 32768 &&
                                Math.abs(height - Math.round(height)) < 0.000001
                            ) {
                                photoDimensions = { width, height: Math.round(height) };
                            }
                        }
                    }
                }
            });

            // Build content HTML and convert numbered lists
            let contentHtml = $content.html() || "";

            // Convert numbered lists (1. 2. 3.) to proper HTML lists
            contentHtml = contentHtml.replace(/(?:^|\n)(\d+)\.\s+(.+?)(?=\n\d+\.\s+|\n\n|$)/gs, (_match, num, text) => {
                if (num === "1") {
                    return `<ol><li>${text.trim()}</li>`;
                }
                return `<li>${text.trim()}</li>`;
            });
            // Close the last <ol> tag if there was a list
            if (contentHtml.includes("<ol>")) {
                contentHtml = contentHtml.replace(/(<li>.*?<\/li>)(?!.*<li>)/s, "$1</ol>");
            }

            // Add images if any
            if (images.length > 0) {
                const imagesHtml = images
                    .map((img) => {
                        const image = $("<img>").attr({ src: img, alt: title, loading: "lazy", class: "telegram-post-image" });
                        if (images.length === 1 && photoDimensions) {
                            image.attr({ width: String(photoDimensions.width), height: String(photoDimensions.height) });
                        }
                        return image.toString();
                    })
                    .join("");
                contentHtml = `<div class="telegram-images">${imagesHtml}</div>${contentHtml}`;
            }

            // Extract link preview
            let linkPreview: LinkPreview | undefined;
            const $linkPreview = $message.find(".tgme_widget_message_link_preview");
            if ($linkPreview.length) {
                const previewUrl = telegramLink($linkPreview.attr("href") || "", channelUsername);
                const siteName = $linkPreview.find(".link_preview_site_name").text().trim();
                const previewTitle = $linkPreview.find(".link_preview_title").text().trim();
                const previewDescription = $linkPreview.find(".link_preview_description").text().trim();

                // Extract image from style or img tag
                let previewImageUrl = "";
                const $previewImage = $linkPreview.find(".link_preview_image, .link_preview_right_image");
                if ($previewImage.length) {
                    const style = $previewImage.attr("style") || "";
                    const imgMatch = style.match(/url\(['"](.+?)['"]\)/);
                    if (imgMatch?.[1]) {
                        previewImageUrl = getProxiedImageUrl(imgMatch[1]);
                    } else {
                        const imgSrc = $previewImage.find("img").attr("src") || $previewImage.attr("src");
                        if (imgSrc) {
                            previewImageUrl = getProxiedImageUrl(imgSrc);
                        }
                    }
                }

                if (previewUrl || previewTitle) {
                    linkPreview = {
                        url: previewUrl,
                        ...(siteName && { siteName }),
                        ...(previewTitle && { title: previewTitle }),
                        ...(previewDescription && { description: previewDescription }),
                        ...(previewImageUrl && { imageUrl: previewImageUrl }),
                    };
                }
            }

            // Extract reply info
            let replyInfo: ReplyInfo | undefined;
            const $reply = $message.find(".tgme_widget_message_reply");
            if ($reply.length) {
                const replyToAuthor = $reply.find(".tgme_widget_message_author_name").text().trim();
                const replyToText = $reply.find(".tgme_widget_message_metatext, .tgme_widget_message_text").text().trim();
                const replyToLink = telegramLink($reply.attr("href") || "", channelUsername) || undefined;

                if (replyToAuthor || replyToText) {
                    replyInfo = {
                        ...(replyToAuthor && { replyToAuthor }),
                        ...(replyToText && { replyToText }),
                        ...(replyToLink && { replyToLink }),
                    };
                }
            }

            // Extract hashtags
            const hashtags: string[] = [];
            $content.find("a").each((_, link) => {
                const href = $(link).attr("href") || "";
                const linkText = $(link).text().trim();
                if (linkText.startsWith("#") && (href.includes("?q=") || href.includes("/s/"))) {
                    hashtags.push(linkText.slice(1));
                }
            });

            posts.push({
                id,
                datetime,
                title,
                content: sanitizeHtml(contentHtml, importedHtmlPolicy),
                text,
                ...(images[0] && { previewImage: images[0] }),
                ...(forwardedFrom && { forwardedFrom }),
                ...(forwardedFromLink && { forwardedFromLink }),
                ...(linkPreview && { linkPreview }),
                ...(replyInfo && { replyInfo }),
                ...(hashtags.length > 0 && { hashtags }),
            });
        });

        return {
            title,
            description,
            descriptionText,
            avatar,
            posts: posts.reverse(), // Reverse to show newest first
        };
    } catch (error) {
        console.error("Error fetching Telegram channel:", error);
        throw error;
    }
}
