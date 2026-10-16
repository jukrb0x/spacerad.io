import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { load } from "cheerio";
import { translationPairs } from "../src/utils/postTranslations.ts";

function routeKey(path) {
    let decoded = path;
    try {
        decoded = decodeURIComponent(path);
    } catch {
        // Literal percent signs are valid filenames; keep malformed escapes literal.
    }
    return decoded.replace(/\/index\.html$/, "/").replace(/\/$/, "") || "/";
}

// Cloudflare's current rules use exact paths and a single wildcard (:splat).
function parseRedirects(text) {
    return text.split(/\r?\n/).flatMap((line) => {
        const [from, to, status = "302", ...extra] = line.trim().split(/\s+/);
        if (!from || from.startsWith("#")) return [];
        if (
            !to ||
            extra.length ||
            !["301", "302", "303", "307", "308"].includes(status) ||
            !from.startsWith("/") ||
            /[:?#]/.test(from) ||
            (from.match(/\*/g) || []).length > 1 ||
            !/^(?:\/|https?:\/\/)/.test(to)
        ) {
            throw new Error(`Unsupported _redirects rule: ${line}; extend the checker before using it`);
        }
        const pattern = from
            .split("*")
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("(.*)");
        return [{ pattern: new RegExp(`^${pattern}/?$`), to }];
    });
}

export function checkPublishing({ pages, files = new Set(), routes = [], redirects = "", pairs = translationPairs, site = "https://spacerad.io" }) {
    const origin = new URL(site).origin;
    const documents = new Map([...pages].map(([path, html]) => [routeKey(path), { path, $: load(html) }]));
    const assets = new Set([...files].map(routeKey));
    const rules = parseRedirects(redirects);
    const diagnostics = [];
    const report = (severity, code, message) => diagnostics.push({ severity, code, message });
    const articles = [...documents].filter(([path, { $ }]) => path.startsWith("/posts/") && $("article").length);

    for (const [, { path, $ }] of articles) {
        const base = new URL($("link[rel=canonical]").attr("href") || path, origin);
        const links = new Set(
            $("article a[href]")
                .map((_, node) => $(node).attr("href"))
                .get(),
        );
        for (const href of links) {
            let target;
            try {
                target = new URL(href, base);
            } catch {
                report("error", "invalid-url", `${path}: invalid href ${JSON.stringify(href)}`);
                continue;
            }
            if (!/^https?:$/.test(target.protocol) || target.origin !== origin) continue;
            const visited = new Set();
            let loop = false;
            while (target.origin === origin) {
                const key = routeKey(target.pathname);
                const rule = rules.find(({ pattern }) => pattern.test(target.pathname));
                if (!rule) break;
                if (visited.has(key) || visited.size >= 20) {
                    report("error", "redirect-loop", `${path}: ${JSON.stringify(href)} loops or exceeds 20 redirects at ${target.pathname}`);
                    loop = true;
                    break;
                }
                visited.add(key);
                const match = target.pathname.match(rule.pattern);
                const next = new URL(rule.to.replace(":splat", match[1] || ""), target);
                if (!rule.to.includes("#")) next.hash = target.hash;
                target = next;
            }
            if (loop || target.origin !== origin) continue;
            const key = routeKey(target.pathname);
            const document = documents.get(key);
            const dynamic = routes.some(({ routeData }) => !routeData.prerender && routeData.pattern.test(target.pathname));
            if (!document && !assets.has(key) && !dynamic) {
                report("error", "missing-route", `${path}: ${JSON.stringify(href)} → ${target.pathname} has no published route or asset`);
                continue;
            }
            // Text fragments are browser-managed; validate an optional preceding element ID.
            const fragment = target.hash.slice(1).split(":~:")[0];
            if (!fragment) continue;
            let anchor;
            try {
                anchor = decodeURIComponent(fragment);
            } catch {
                report("error", "invalid-url", `${path}: ${JSON.stringify(href)} has an invalid encoded fragment`);
                continue;
            }
            if (document) {
                const found = document
                    .$("[id], a[name]")
                    .toArray()
                    .some((node) => document.$(node).attr("id") === anchor || document.$(node).attr("name") === anchor);
                if (!found && anchor.toLowerCase() !== "top")
                    report("error", "missing-anchor", `${path}: ${JSON.stringify(href)} → ${target.pathname} has no anchor #${anchor}`);
            } else if (dynamic && !assets.has(key)) {
                report("warning", "dynamic-anchor", `${path}: ${JSON.stringify(href)} matches a server route; anchor requires runtime verification`);
            }
        }
    }

    const paired = new Set();
    for (const pair of pairs) {
        const entries = pair.map((id) => documents.get(routeKey(`/posts/${id}`)));
        if (entries.every((entry) => !entry)) continue; // Neither side is published (e.g. both drafts).
        if (pair.length !== 2 || new Set(pair).size !== 2 || pair.some((id) => paired.has(id))) {
            report("error", "translation-duplicate", `Translation pair ${pair.join(" ↔ ")}: each article must belong to exactly one distinct pair`);
        }
        for (const id of pair) paired.add(id);
        if (entries.some((entry) => !entry)) {
            report(
                "error",
                "translation-missing",
                `Translation pair ${pair.join(" ↔ ")}: missing published article ${pair.filter((_, index) => !entries[index]).join(", ")}`,
            );
            continue;
        }
        const languages = entries.map(({ $ }) => $("html").attr("lang")?.split("-")[0]);
        if (languages.length !== 2 || !languages.includes("zh") || !languages.includes("en")) {
            report("error", "translation-language", `Translation pair ${pair.join(" ↔ ")}: expected zh/en, found ${languages.join("/")}`);
        }
    }

    const tags = new Map();
    for (const [, { path, $ }] of articles) {
        $("[data-article-header] a[href^='/tags/']").each((_, node) => {
            const tag = $(node).text().trim();
            const variants = tags.get(tag.toLowerCase()) || new Map();
            const sources = variants.get(tag) || new Set();
            sources.add(path);
            variants.set(tag, sources);
            tags.set(tag.toLowerCase(), variants);
        });
    }
    for (const variants of tags.values()) {
        if (variants.size > 1) {
            report(
                "warning",
                "tag-case",
                `Case-only tag collision: ${[...variants].map(([tag, sources]) => `${tag} (${[...sources].join(", ")})`).join("; ")}. Review spelling; public tag routes are unchanged`,
            );
        }
    }
    return diagnostics;
}

export async function checkBuild(output = resolve("dist")) {
    const worker = resolve(output, "_worker.js");
    const name = (await readdir(worker)).find((file) => /^manifest_.*\.mjs$/.test(file));
    if (!name) throw new Error("No production route manifest; run pnpm build first");
    const { manifest } = await import(pathToFileURL(resolve(worker, name)));
    const paths = (await readdir(output, { recursive: true, withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => relative(output, resolve(entry.parentPath, entry.name)))
        .filter((path) => !path.startsWith("_worker.js/"));
    const pages = new Map();
    for (const path of paths.filter((path) => path.endsWith(".html"))) {
        pages.set(`/${path.replace(/index\.html$/, "")}`, await readFile(resolve(output, path), "utf8"));
    }
    if (![...pages.keys()].some((path) => path.startsWith("/posts/"))) throw new Error("No built articles; run pnpm build first");
    const redirects = paths.includes("_redirects") ? await readFile(resolve(output, "_redirects"), "utf8") : "";
    return checkPublishing({ pages, files: new Set(paths.map((path) => `/${path}`)), routes: manifest.routes, site: manifest.site, redirects });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        const args = process.argv.slice(2);
        if (args.some((arg) => arg !== "--report-only")) throw new Error("Usage: pnpm check:publishing [--report-only]");
        const diagnostics = await checkBuild();
        for (const { severity, code, message } of diagnostics) console.log(`${severity.toUpperCase()} [${code}] ${message}`);
        const errors = diagnostics.filter(({ severity }) => severity === "error").length;
        console.log(`Publishing preflight: ${errors} error(s), ${diagnostics.length - errors} warning(s)`);
        process.exitCode = errors && !args.includes("--report-only") ? 1 : 0;
    } catch (error) {
        console.error(`Publishing preflight failed: ${error.message}`);
        process.exitCode = 1;
    }
}
