import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Together from "together-ai";
import { parseUserApiKey } from "@/lib/api-key";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    const rateLimitResponse = await enforceRateLimit(
      "validateApiKey",
      request,
      userId,
    );
    if (rateLimitResponse) return rateLimitResponse;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const apiKey = parseUserApiKey(
      typeof body === "object" && body !== null
        ? (body as { apiKey?: unknown }).apiKey
        : undefined,
    );

    if (apiKey.status === "absent") {
      return NextResponse.json(
        { valid: false, error: "API key is required" },
        { status: 400 },
      );
    }
    if (apiKey.status === "invalid") {
      return NextResponse.json({ valid: false, error: "Invalid API key" });
    }

    // Dynamically fetch the fastest available model
    const routerRes = await fetch("https://whichllm.together.ai/router/fast", {
      next: { revalidate: 60 },
    });
    const { model } = await routerRes.json();

    // Fire a minimal completion — 1 output token to keep cost/latency negligible
    const client = new Together({ apiKey: apiKey.key });
    await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 1,
    });

    return NextResponse.json({ valid: true });
  } catch (error: unknown) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status: number }).status
        : undefined;

    if (status === 401 || status === 403) {
      return NextResponse.json({ valid: false, error: "Invalid API key" });
    }

    console.error("Error validating API key:", status);
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 500 },
    );
  }
}
