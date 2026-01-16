import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Schema compatible with old blog frontmatter
const postSchema = z.object({
  title: z.string(),
  date: z.string().transform((str) => {
    // Support YYYY/M/D and YYYY-MM-DD formats
    const normalized = str.replace(/\//g, '-');
    return new Date(normalized);
  }),
  description: z.string().optional(),
  tag: z.union([z.string(), z.array(z.string())]).optional().transform((val) => {
    if (!val) return [];
    return typeof val === 'string' ? val.split(',').map(t => t.trim()) : val;
  }),
  author: z.string().optional().default('Jabriel'),
  lang: z.enum(['en', 'zh']).optional().default('en'),
  draft: z.boolean().optional().default(false),
  comment: z.boolean().optional().default(true),
  image: z.string().optional(),
  heroImage: z.string().optional(),
});

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
  schema: postSchema,
});

export const collections = { posts };
