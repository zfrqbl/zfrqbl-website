import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    type: z.enum(['article', 'project', 'note']),
    projectUrl: z.string().url().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
    pubDate: z.coerce.date(),
    type: z.enum(['article', 'project', 'note']),
    projectUrl: z.string().url().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
