export type UILanguage = "en" | "zh";
export const LANGUAGE_STORAGE_KEY = "ui-language";

export function resolveLanguage(stored: string | null, languages: readonly string[]): UILanguage {
    if (stored === "en" || stored === "zh") return stored;
    for (const language of languages) {
        const base = language.toLowerCase().split("-")[0];
        if (base === "en" || base === "zh") return base;
    }
    return "en";
}

export const navChinese: Record<string, string> = {
    "/": "首页", "/posts": "博客", "/channel": "电台", "/tags": "话题", "/friends": "友链", "/me": "关于",
};
