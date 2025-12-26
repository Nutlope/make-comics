import { db } from './db';
import { stories, pages, type Story, type Page } from './schema';
import { eq } from 'drizzle-orm';
import { generateComicSlug } from './slug-generator';

export async function createStory(data: { title: string; description?: string; userId: string; style?: string }): Promise<Story> {
  // Generate a unique slug
  let slug = generateComicSlug();
  let attempts = 0;
  const maxAttempts = 10;

  // Ensure slug uniqueness
  while (attempts < maxAttempts) {
    const existing = await db.select().from(stories).where(eq(stories.slug, slug)).limit(1);
    if (existing.length === 0) break;
    slug = generateComicSlug();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    // Fallback to a simple random slug if we can't generate a unique one
    slug = `story-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  const [story] = await db.insert(stories).values({ ...data, slug }).returning();
  return story;
}

export async function createPage(data: {
  storyId: string;
  pageNumber: number;
  prompt: string;
  characterImageUrls: string[];
}): Promise<Page> {
  const [page] = await db.insert(pages).values(data).returning();
  return page;
}

export async function updatePage(pageId: string, generatedImageUrl: string): Promise<void> {
  await db.update(pages)
    .set({ generatedImageUrl, updatedAt: new Date() })
    .where(eq(pages.id, pageId));
}

export async function updateStory(storyId: string, data: { title?: string; description?: string }): Promise<void> {
  await db.update(stories)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(stories.id, storyId));
}

export async function getStoryWithPages(storyId: string): Promise<{ story: Story; pages: Page[] } | null> {
  const storyResult = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);

  if (storyResult.length === 0) {
    return null;
  }

  const storyPages = await db.select().from(pages)
    .where(eq(pages.storyId, storyId))
    .orderBy(pages.pageNumber);

  return {
    story: storyResult[0],
    pages: storyPages,
  };
}

export async function getStoryById(storyId: string): Promise<Story | null> {
  const result = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getStoryWithPagesBySlug(slug: string): Promise<{ story: Story; pages: Page[] } | null> {
  const storyResult = await db.select().from(stories).where(eq(stories.slug, slug)).limit(1);

  if (storyResult.length === 0) {
    return null;
  }

  const storyPages = await db.select().from(pages)
    .where(eq(pages.storyId, storyResult[0].id))
    .orderBy(pages.pageNumber);

  return {
    story: storyResult[0],
    pages: storyPages,
  };
}

export async function getStoryCharacterImages(storyId: string): Promise<string[]> {
  const storyPages = await db.select({
    characterImageUrls: pages.characterImageUrls,
    pageNumber: pages.pageNumber
  })
    .from(pages)
    .where(eq(pages.storyId, storyId))
    .orderBy(pages.pageNumber);

  // Flatten all character URLs from all pages, keeping order by page number
  const allUrls: string[] = [];
  const seenUrls = new Set<string>();

  for (const page of storyPages) {
    for (const url of page.characterImageUrls) {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        allUrls.push(url);
      }
    }
  }

  return allUrls;
}

export async function getLastPageImage(storyId: string): Promise<string | null> {
  const allPages = await db.select({ generatedImageUrl: pages.generatedImageUrl, pageNumber: pages.pageNumber })
    .from(pages)
    .where(eq(pages.storyId, storyId))
    .orderBy(pages.pageNumber);

  if (allPages.length === 0) return null;

  // Find the last page that has a generated image
  for (let i = allPages.length - 1; i >= 0; i--) {
    if (allPages[i].generatedImageUrl) {
      return allPages[i].generatedImageUrl;
    }
  }

  return null;
}

export async function getNextPageNumber(storyId: string): Promise<number> {
  const storyPages = await db.select({ pageNumber: pages.pageNumber })
    .from(pages)
    .where(eq(pages.storyId, storyId))
    .orderBy(pages.pageNumber);

  if (storyPages.length === 0) {
    return 1;
  }

  return Math.max(...storyPages.map(p => p.pageNumber)) + 1;
}

export async function deletePage(pageId: string): Promise<void> {
  await db.delete(pages).where(eq(pages.id, pageId));
}