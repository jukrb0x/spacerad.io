import { defineCollection, z, type ImageFunction } from "astro:content";
import { glob } from "astro/loaders";

const createSharedSchema = (image: ImageFunction) => z.object({
    title: z.string(),
    description: z.string().optional(),
    // Transform string to Date object
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    // socialImage: local image (resolved by image()), external URL, or /public/ path
    socialImage: z.union([image(), z.string()]).optional(),
    tags: z.array(z.string()).optional().default([]),
    hidden: z.boolean().optional().default(false),
    // Language field for Chinese post detection
    lang: z.enum(['en', 'zh']).optional().default('en'),
    // Comment system override: "cusdis" | "remark42" | false (to disable)
    commentSystem: z.union([z.literal("cusdis"), z.literal("remark42")]).optional(),
    comment: z.boolean().optional().default(true),
});

const blog = defineCollection({
    loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
    schema: ({ image }) => createSharedSchema(image),
});

export const collections = { blog };
