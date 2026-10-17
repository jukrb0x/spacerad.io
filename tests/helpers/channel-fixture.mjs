const channel = {
    title: "SpaceRadio FM",
    descriptionText: "FM 466.6\n\nWe Know Nothing. 🪐",
    description: "FM 466.6 We Know Nothing. 🪐",
    avatar: "/favicon.svg",
    posts: Array.from({ length: 8 }, (_, index) => ({
        id: String(100 - index),
        ...(index === 0 ? { previewImage: "/og-image.png" } : {}),
        datetime: "2026-10-01T12:00:00Z",
        title: "Channel layout fixture",
        text: "A channel post with a local image and reading content.",
        content:
            '<div class="telegram-images"><img src="/og-image.png" alt="Channel layout fixture" loading="lazy" class="telegram-post-image" /></div><p>A channel post with a local image and reading content.</p>',
    })),
};

// Keep browser regressions independent of Telegram availability.
export function channelFixturePlugin() {
    return {
        name: "browser-channel-fixture",
        enforce: "pre",
        transform(_source, id) {
            if (id.split("?")[0].endsWith("/src/utils/telegram.ts")) {
                return `export async function fetchTelegramChannel() { return ${JSON.stringify(channel)}; }`;
            }
        },
    };
}
