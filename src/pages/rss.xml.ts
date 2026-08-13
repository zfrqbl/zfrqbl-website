import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context: any) {
  const blog = await getCollection('blog');
  return rss({
    title: 'ZFRQBL Stream',
    description: 'hobby coder | Lovecraft Enthusiast | The Truth is Out There',
    site: context.site,
    items: blog.map((post) => ({
      title: post.data.title || `Note - ${post.data.pubDate.toLocaleDateString()}`,
      pubDate: post.data.pubDate,
      description: post.data.description || 'Personal note',
      link: `/posts/${post.slug}/`,
    })),
  });
}
