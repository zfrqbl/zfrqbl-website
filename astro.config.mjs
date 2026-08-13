import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import expressiveCode from '@expressive-code/astro';

export default defineConfig({
  site: 'https://zfrqbl.com',
  output: 'hybrid',
  adapter: cloudflare({
    imageService: 'passthrough',
  }),
  integrations: [
    expressiveCode({
      themes: ['github-dark', 'github-light'],
      useDarkModeMediaQuery: true,
    }),
  ],
});
