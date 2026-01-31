// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = "Spacerad.io by Jabriel";
export const SITE_TITLE_ALT = ["太空来电", "宇宙频道", "星际广播", "I'm Jabriel", "智人大冲浪"] as const;
export const SITE_DESCRIPTION = "Space Radio by Jabriel, another random blog.";
export const SITE_SOCIAL_IMAGE = "/og-image.png";
export const DEFAULT_POST_SOCIAL_IMAGE = "/og-image.png";

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

// Navigation links
export const NAV_LINKS: NavLink[] = [
    { href: "/", label: "Home" },
    { href: "/posts", label: "Blog" },
    { href: "/tags", label: "Tags" },
    { href: "/channel", label: "Channel" },
    { href: "/friends", label: "Links" },
    { href: "/me", label: "About" },
];
