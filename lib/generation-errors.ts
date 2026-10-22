import { NextResponse } from "next/server";
import {
  isContentPolicyViolation,
  getContentPolicyErrorMessage,
} from "@/lib/utils";

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

// Maps a Together AI error to a client-safe response. Provider details are
// logged by the caller, never returned.
export function generationErrorResponse(
  error: unknown,
  usesOwnApiKey: boolean,
): NextResponse {
  if (
    error instanceof Error &&
    error.message &&
    isContentPolicyViolation(error.message)
  ) {
    return NextResponse.json(
      { error: getContentPolicyErrorMessage(), errorType: "content_policy" },
      { status: 400 },
    );
  }

  const status = getErrorStatus(error);

  if (usesOwnApiKey && (status === 401 || status === 403)) {
    return NextResponse.json(
      {
        error: "Your Together AI API key was rejected. Please update your API key.",
        errorType: "invalid_api_key",
      },
      { status: 401 },
    );
  }

  if (usesOwnApiKey && status === 402) {
    return NextResponse.json(
      {
        error:
          "Insufficient API credits. Please add credits to your Together.ai account at https://api.together.ai/settings/billing or update your API key.",
        errorType: "credit_limit",
      },
      { status: 402 },
    );
  }

  if (status === 429) {
    return NextResponse.json(
      {
        error: "Image generation is busy right now. Please try again shortly.",
        errorType: "api_error",
      },
      { status: 429 },
    );
  }

  return NextResponse.json(
    {
      error: "Failed to generate image. Please try again.",
      errorType: "api_error",
    },
    { status: 502 },
  );
}
