// @ts-check

import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import UnoCSS from "unocss/astro";
import icon from "astro-icon";
import pagefind from "astro-pagefind";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeFigure from "rehype-figure";
import rehypeImgSize from "rehype-img-size";
import rehypePicture from "rehype-picture";
import rehypeSlug from "rehype-slug";
import {
    rehypePrettyCode,
} from "rehype-pretty-code";
import { remarkAlert } from "remark-github-blockquote-alert";
import { remarkModifiedTime } from "./remark-modified-time.mjs";

import vue from "@astrojs/vue";

/** @type {import("rehype-pretty-code").Options} */
const rehypePrettyCodeOptions = {
    // Use dual themes for light/dark mode support
    theme: {
        light: "github-light",
        dark: "github-dark",
    },
    // Keep the background from the theme
    keepBackground: true,
    // Enable grid layout for line highlighting
    grid: true,
    // Filter meta for code blocks (language specification)
    filterMetaString: (string) => string.replace(/filename="[^"]*"/, ""),
    // Add data attributes for CSS styling
    onVisitLine(node) {
        // Prevent lines from collapsing in `display: grid` mode
        if (node.children.length === 0) {
            node.children = [{ type: "text", value: " " }];
        }
    },
    onVisitHighlightedLine(node) {
        if (!node.properties.className) {
            node.properties.className = [];
        }
        node.properties.className.push("highlighted");
    },
    onVisitHighlightedChars(node) {
        if (!node.properties.className) {
            node.properties.className = [];
        }
        node.properties.className.push("highlighted-chars");
    },
};

// https://astro.build/config
export default defineConfig({
    adapter: cloudflare({
        imageService: "compile",
    }),
    site: "https://example.com",
    output: "static",
    integrations: [
        mdx(),
        sitemap(),
        UnoCSS({ injectReset: true }),
        icon({
            include: {
                // Only include icons we actually use to reduce bundle size
                ri: [
                    "twitter-fill",
                    "telegram-fill",
                    "github-fill",
                    "steam-fill",
                    "douban-fill",
                    "mail-fill",
                    "rss-fill",
                    "link",
                    "share-line",
                    "check-line",
                    "heart-line",
                    "heart-fill",
                    "creative-commons-fill",
                    "creative-commons-by-fill",
                    "creative-commons-nc-fill",
                    "creative-commons-sa-fill",
                ],
                "simple-icons": ["folo"],
            },
        }),
        pagefind(),
        vue(),
    ],

    markdown: {
        remarkPlugins: [remarkAlert, remarkModifiedTime],
        // Disable Astro's built-in syntax highlighting - using rehype-pretty-code instead
        syntaxHighlight: false,
        rehypePlugins: [
            [rehypePrettyCode, rehypePrettyCodeOptions],
            rehypeSlug,
            [
                rehypeAutolinkHeadings,
                {
                    behavior: "prepend",
                    properties: {
                        class: "anchor-link",
                        ariaHidden: true,
                        tabIndex: -1,
                    },
                },
            ],
            rehypePicture,
            [rehypeImgSize, { dir: "./public" }],
            rehypeFigure,
        ],
    },
});
