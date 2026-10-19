import type { ChannelDescriptionMode } from "./utils/channelDescription";

// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = "Spacerad.io";
export const SITE_TITLE_OG = "Space Radio / On my wavelength @Jabriel";
export const SITE_TITLE_ALT = ["太空来电", "宇宙频道", "星际广播", "I'm Jabriel", "智人大冲浪"] as const;
export const SITE_DESCRIPTION = "Notes, experiments, and observations from a life in progress.";
export const SITE_SOCIAL_IMAGE = "/og-image.png";
export const DEFAULT_POST_SOCIAL_IMAGE = "/placeholder.png";

// Social links - customize these to your own links
export const SOCIAL_LINKS = {
    github: "https://github.com/jukrb0x",
    email: "mailto:fm@spacerad.io",
    telegram: "https://t.me/SpaceRad_io",
    rss: "/rss.xml",
} as const;

type NavLink = {
    href: string;
    label: string;
    drawer_only?: boolean;
};

// Only published collections belong here; the local preview entry is dev-only in CollectionsNav.
export const COLLECTION_LINKS = [{ href: "/beer-collection", label: "Beer Log" }];

// Navigation links
export const NAV_LINKS: NavLink[] = [
    { href: "/", label: "Home", drawer_only: true },
    { href: "/posts", label: "Blog" },
    { href: "/channel", label: "Channel" },
    { href: "/tags", label: "Topics", drawer_only: true },
    { href: "/friends", label: "Links" },
    { href: "/me", label: "About" },
];

// Channel profile only: first-line | full (keep blank lines) | merged (join lines).
// The cut circle never grows. Use full/merged only when the bio fits at normal
// text size; oversized text can be clipped by the shape, so verify desktop/mobile
// after changing this setting or the Telegram bio. No automatic overflow fallback.
// See memory/architecture.md → Channel profile description.
export const CHANNEL_DESCRIPTION_MODE: ChannelDescriptionMode = "first-line";
