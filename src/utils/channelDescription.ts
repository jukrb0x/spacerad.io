export type ChannelDescriptionMode = "first-line" | "full" | "merged";

/** Presentation only: never apply this to Telegram posts or stored source text. */
export function formatChannelDescription(text: string, mode: ChannelDescriptionMode): string {
    const normalized = text.replace(/\r\n?/g, "\n");
    if (mode === "first-line") return normalized.split("\n", 1)[0];
    if (mode === "merged")
        return normalized
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .join(" ");
    return normalized;
}
