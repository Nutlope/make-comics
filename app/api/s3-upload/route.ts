import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { POST as s3UploadRoute } from "next-s3-upload/route";
import { enforceRateLimit } from "@/lib/rate-limit";

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "heic",
  "heif",
]);
const MAX_FILENAME_LENGTH = 200;

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const rateLimitResponse = await enforceRateLimit("upload", request, userId);
  if (rateLimitResponse) return rateLimitResponse;

  let filename: unknown;
  let filetype: unknown;
  try {
    ({ filename, filetype } = await request.clone().json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const extension =
    typeof filename === "string" && filename.length <= MAX_FILENAME_LENGTH
      ? filename.split(".").pop()?.toLowerCase()
      : undefined;
  if (
    !extension ||
    !ALLOWED_IMAGE_EXTENSIONS.has(extension) ||
    (filetype !== undefined &&
      (typeof filetype !== "string" || !filetype.startsWith("image/") ||
        filetype === "image/svg+xml"))
  ) {
    return NextResponse.json(
      { error: "Only image uploads are allowed" },
      { status: 400 },
    );
  }

  return s3UploadRoute.configure({
    key: () => `next-s3-uploads/${randomUUID()}.${extension}`,
  })(request);
}
