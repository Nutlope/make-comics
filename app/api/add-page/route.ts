import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Together from "together-ai";
import { db } from "@/lib/db";
import { pages } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  updatePage,
  createPage,
  getNextPageNumber,
  getStoryWithPagesBySlug,
  getLastPageImage,
  deletePage,
} from "@/lib/db-actions";
import {
  consumeFreeTierCredit,
  enforceRateLimit,
  refundFreeTierCredit,
} from "@/lib/rate-limit";
import { uploadImageToS3 } from "@/lib/s3-upload";
import { buildComicPrompt } from "@/lib/prompt";
import { parseUserApiKey } from "@/lib/api-key";
import { addPageRequestSchema, parseJsonBody } from "@/lib/input-limits";
import { generationErrorResponse } from "@/lib/generation-errors";

const NEW_MODEL = false;

const IMAGE_MODEL = NEW_MODEL
  ? "google/gemini-3-pro-image"
  : "google/flash-image-2.5";

const FIXED_DIMENSIONS = NEW_MODEL
  ? { width: 896, height: 1200 }
  : { width: 864, height: 1184 };

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let creditChargedAt: number | null = null;
  let imageGenerated = false;

  try {
    ({ userId } = await auth());

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await parseJsonBody(request, addPageRequestSchema);
    if (!body) {
      return NextResponse.json(
        { error: "Missing or invalid fields: storyId and prompt" },
        { status: 400 },
      );
    }

    const { storyId, pageId, prompt, characterImages } = body;

    const userApiKey = parseUserApiKey(request.headers.get("x-api-key"));
    if (userApiKey.status === "invalid") {
      return NextResponse.json(
        { error: "Invalid API key", errorType: "invalid_api_key" },
        { status: 400 },
      );
    }

    const rateLimitResponse = await enforceRateLimit(
      "generation",
      request,
      userId,
    );
    if (rateLimitResponse) return rateLimitResponse;

    const usesOwnApiKey = userApiKey.status === "valid";
    const finalApiKey = usesOwnApiKey
      ? userApiKey.key
      : process.env.TOGETHER_API_KEY;

    if (!finalApiKey) {
      console.error("TOGETHER_API_KEY is not configured");
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 },
      );
    }

    // Get the story and all its pages
    const storyData = await getStoryWithPagesBySlug(storyId);
    if (!storyData) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const { story, pages } = storyData;

    // Check ownership
    if (story.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let page;
    let pageNumber: number;
    let isRedraw = false;

    if (pageId) {
      // Redraw mode: update existing page
      isRedraw = true;
      const storyData = await getStoryWithPagesBySlug(storyId);
      if (!storyData) {
        return NextResponse.json({ error: "Story not found" }, { status: 404 });
      }

      const existingPage = storyData.pages.find((p) => p.id === pageId);
      if (!existingPage) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }

      page = existingPage;
      pageNumber = existingPage.pageNumber;
    } else {
      pageNumber = await getNextPageNumber(story.id);
    }

    if (!usesOwnApiKey) {
      const quotaResponse = await consumeFreeTierCredit(userId);
      if (quotaResponse) return quotaResponse;
      creditChargedAt = Date.now();
    }

    if (!page) {
      // Add new page mode
      page = await createPage({
        storyId: story.id,
        pageNumber,
        prompt,
        characterImageUrls: characterImages,
      });
    }

    const dimensions = FIXED_DIMENSIONS;

    // Collect reference images: previous page + story characters + current characters
    let referenceImages: string[] = [];

    // Get previous page image for style consistency (unless it's page 1)
    if (pageNumber > 1) {
      // Always use the previous page's image, regardless of new page or redraw
      const storyData = await getStoryWithPagesBySlug(storyId);
      if (storyData) {
        const previousPage = storyData.pages.find(
          (p) => p.pageNumber === pageNumber - 1,
        );
        if (previousPage?.generatedImageUrl) {
          referenceImages.push(previousPage.generatedImageUrl);
        }
      }
    }

    // Use only the character images sent from the frontend (user's selection)
    // These are already the most recent/relevant characters the user wants to use
    referenceImages.push(...characterImages);

    // Build the prompt with continuation context
    // For redraw, only include pages up to the current page being redrawn
    // For new page, include all existing pages
    const relevantPages = isRedraw
      ? pages.filter((p) => p.pageNumber < pageNumber)
      : pages;

    const previousPages = relevantPages.map((p) => ({
      prompt: p.prompt,
    }));

    const fullPrompt = buildComicPrompt({
      prompt,
      style: story.style,
      characterImages,
      isAddPage: true,
      previousPages,
    });

    const client = new Together({ apiKey: finalApiKey });

    let response;
    try {
      console.log(
        `Starting image generation (prompt length ${fullPrompt.length}, ${referenceImages.length} reference images)`,
      );
      const startTime = Date.now();
      response = await client.images.generate({
        model: IMAGE_MODEL,
        prompt: fullPrompt,
        width: dimensions.width,
        height: dimensions.height,
        reference_images:
          referenceImages.length > 0 ? referenceImages : undefined,
      });
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const durationSeconds = (durationMs / 1000).toFixed(2);
      console.log(`Image generation completed in ${durationSeconds} seconds`);
    } catch (error) {
      console.error("Together AI API error:", error);

      // Clean up DB records if generation failed due to content policy
      try {
        if (
          error instanceof Error &&
          error.message &&
          error.message.includes("NO_IMAGE")
        ) {
          if (isRedraw) {
            // For redraw, we don't delete the page, just don't update it
          } else {
            // For new page, delete the page that was created
            await deletePage(page.id);
          }
        }
      } catch (cleanupError) {
        console.error(
          "Error cleaning up DB on image generation failure:",
          cleanupError,
        );
      }

      return generationErrorResponse(error, usesOwnApiKey);
    }

    if (!response.data || !response.data[0] || !response.data[0].url) {
      return NextResponse.json(
        { error: "No image URL in response" },
        { status: 500 },
      );
    }

    imageGenerated = true;
    const imageUrl = response.data[0].url;
    const s3Key = `${story.id}/page-${page.pageNumber}-${Date.now()}.jpg`;
    const s3ImageUrl = await uploadImageToS3(imageUrl, s3Key);

    await updatePage(page.id, s3ImageUrl);

    return NextResponse.json({
      imageUrl: s3ImageUrl,
      pageId: page.id,
      pageNumber: page.pageNumber,
    });
  } catch (error) {
    console.error("Error in add-page API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    if (userId && creditChargedAt !== null && !imageGenerated) {
      await refundFreeTierCredit(userId, creditChargedAt);
    }
  }
}
