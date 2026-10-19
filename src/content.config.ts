import { defineCollection, type ImageFunction, z } from "astro:content";
import { glob } from "astro/loaders";
import { withGitModifiedTime } from "../scripts/git-modified-time.mjs";

import { collectionItemSchema, collectionPageSchema } from "./utils/collectionSchema";

const createSharedSchema = (image: ImageFunction) =>
    z.object({
        title: z.string(),
        description: z.string().optional(),
        // Transform string to Date object
        published: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        // Derived by the loader; authored values are always replaced.
        lastModified: z.string().optional(),
        lastModifiedCommitUrl: z.string().optional(),
        // socialImage: local image (resolved by image()), external URL, or /public/ path
        socialImage: z.union([image(), z.string()]).optional(),
        tags: z.array(z.string()).optional().default([]),
        hidden: z.boolean().optional().default(false),
        draft: z.boolean().optional().default(false),
        // Language field for Chinese post detection
        lang: z.enum(["en", "zh"]).optional().default("en"),
        // Comment system override: "cusdis" | "remark42" | false (to disable)
        commentSystem: z.union([z.literal("cusdis"), z.literal("remark42")]).optional(),
        comment: z.boolean().optional().default(true),
    });

const blog = defineCollection({
    loader: withGitModifiedTime(glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" })),
    schema: ({ image }) => createSharedSchema(image),
});

const collectionItems = defineCollection({
    loader: glob({ base: "./src/content/collections/items", pattern: "**/*.md" }),
    schema: ({ image }) => collectionItemSchema(image),
});
const collectionPages = defineCollection({
    loader: glob({ base: "./src/content/collections/pages", pattern: "*.yaml" }),
    schema: collectionPageSchema,
});
export const collections = { blog, collectionItems, collectionPages };
