import { z, type ImageFunction } from "astro:content";
const text = z.object({ en: z.string().min(1), zh: z.string().min(1) }).strict();
export const collectionPageSchema = z.object({
    title: text, subtitle: text, aboutLabel: text, sourceNote: text,
}).strict();
// Explicit public-content schema: private log fields must never be copied into entries.
export const collectionItemSchema = (image: ImageFunction) => z.object({
    collection: z.string().min(1), order: z.number().int().nonnegative(),
    title: z.string().min(1), maker: z.string().default(""),
    image: image().optional(), imageFit: z.enum(["badge", "wordmark"]).default("badge"), imageLabel: text,
    crop: z.object({ scale: z.number().positive(), height: z.number().positive().optional(), left: z.number(), top: z.number(), round: z.boolean().default(false) }).strict().optional(),
    facts: z.array(z.object({ label: text, value: text }).strict()).min(1).max(6),
    summary: text,
    sources: z.array(z.object({ label: text, url: z.string().url() }).strict()).default([]),
    noteLanguage: z.enum(["en", "zh"]).default("zh"),
}).strict();
