import { type NextRequest, NextResponse } from "next/server";
import Together from "together-ai";
import { auth } from "@clerk/nextjs/server";
import {
  updatePage,
  updateStory,
  createStory,
  createPage,
  getNextPageNumber,
  getStoryById,
  getLastPageImage,
  deletePage,
  deleteStory,
} from "@/lib/db-actions";
import {
  consumeFreeTierCredit,
  enforceRateLimit,
  refundFreeTierCredit,
} from "@/lib/rate-limit";
import { COMIC_STYLES } from "@/lib/constants";
import { uploadImageToS3 } from "@/lib/s3-upload";
import { buildComicPrompt } from "@/lib/prompt";
import {
  generateStoryMetadata,
  type StoryMetadata,
} from "@/lib/story-metadata";
import { parseUserApiKey } from "@/lib/api-key";
import { generateComicRequestSchema, parseJsonBody } from "@/lib/input-limits";
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

    const body = await parseJsonBody(request, generateComicRequestSchema);
    if (!body) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const {
      storyId,
      prompt,
      style,
      characterImages,
      isContinuation,
      previousContext,
    } = body;

    const userApiKey = parseUserApiKey(body.apiKey);
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

    let story;
    if (storyId) {
      story = await getStoryById(storyId);
      if (!story) {
        return NextResponse.json({ error: "Story not found" }, { status: 404 });
      }
      if (story.userId !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    if (!usesOwnApiKey) {
      const quotaResponse = await consumeFreeTierCredit(userId);
      if (quotaResponse) return quotaResponse;
      creditChargedAt = Date.now();
    }

    let page;
    let referenceImages: string[] = [];

    if (storyId) {
      // Continuation: get previous page image and story character images
      const nextPageNumber = await getNextPageNumber(storyId);
      page = await createPage({
        storyId,
        pageNumber: nextPageNumber,
        prompt,
        characterImageUrls: characterImages,
      });

      // Get previous page image for style consistency (unless it's page 1)
      if (nextPageNumber > 1) {
        const lastPageImage = await getLastPageImage(storyId);
        if (lastPageImage) {
          referenceImages.push(lastPageImage);
        }
      }

      // For continuation pages, character images are sent from frontend
      // No need to fetch separately - frontend handles selection
    } else {
      // New story: no previous page reference
      // Create story with temporary title, will update with generated title
      story = await createStory({
        title: prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt,
        description: undefined,
        userId: userId,
        style,
        usesOwnApiKey,
      });

      page = await createPage({
        storyId: story.id,
        pageNumber: 1,
        prompt,
        characterImageUrls: characterImages,
      });
    }

    // Use only the character images sent from the frontend
    referenceImages.push(...characterImages);

    const dimensions = FIXED_DIMENSIONS;

    const fullPrompt = buildComicPrompt({
      prompt,
      style,
      characterImages,
      isContinuation,
      previousContext,
    });

    const client = new Together({ apiKey: finalApiKey });

    // Generate title and description in parallel with image generation (only for new stories)
    let titleGenerationPromise: Promise<StoryMetadata> | null = null;
    if (!storyId) {
      titleGenerationPromise = (async () => {
        try {
          return await generateStoryMetadata({
            createCompletion: (request) =>
              client.chat.completions.create(request),
            prompt,
            styleName:
              COMIC_STYLES.find((comicStyle) => comicStyle.id === style)?.name ||
              style,
          });
        } catch (error) {
          console.error("Error generating title and description:", error);
          // Fallback to prompt-based title
          return {
            title:
              prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt,
            description: undefined,
          };
        }
      })();
    }

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
        temperature: 0.1, // Lower temperature for more consistent face matching
        reference_images:
          referenceImages.length > 0 ? referenceImages : undefined,
      });
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const durationSeconds = (durationMs / 1000).toFixed(2);
      console.log(`Image generation completed in ${durationSeconds} seconds`);
    } catch (error) {
      console.error("Together AI API error:", error);

      // Clean up DB records if generation failed
      try {
        if (!storyId) {
          // New story failed
          await deleteStory(story!.id);
        } else {
          // Continuation failed
          await deletePage(page.id);
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

    // Upload image to S3 for permanent storage
    const s3Key = `${storyId || story!.id}/page-${
      page.pageNumber
    }-${Date.now()}.jpg`;
    const s3ImageUrl = await uploadImageToS3(imageUrl, s3Key);

    // Wait for title/description generation if it's a new story
    let generatedTitle: string | undefined;
    let generatedDescription: string | undefined;
    if (titleGenerationPromise) {
      const titleData = await titleGenerationPromise;
      generatedTitle = titleData.title;
      generatedDescription = titleData.description;

      // Update story with generated title and description
      try {
        await updateStory(story!.id, {
          title: generatedTitle,
          description: generatedDescription,
        });
        // Update story object for response
        story = {
          ...story!,
          title: generatedTitle,
          description: generatedDescription ?? null,
        };
      } catch (dbError) {
        console.error("Error updating story title/description:", dbError);
        // Continue even if update fails
      }
    }

    // Update page in database with S3 URL
    try {
      await updatePage(page.id, s3ImageUrl);
    } catch (dbError) {
      console.error("Error updating page in database:", dbError);
      return NextResponse.json(
        { error: "Failed to save generated image" },
        { status: 500 },
      );
    }

    const responseData = storyId
      ? { imageUrl: s3ImageUrl, pageId: page.id, pageNumber: page.pageNumber }
      : {
          imageUrl: s3ImageUrl,
          storyId: story!.id,
          storySlug: story!.slug,
          pageId: page.id,
          pageNumber: page.pageNumber,
          title: generatedTitle || story!.title,
          description: generatedDescription || story!.description,
        };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error in generate-comic API:", error);
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
