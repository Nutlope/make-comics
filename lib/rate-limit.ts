import { Ratelimit, type Duration } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextResponse } from "next/server"
import { getClientIp } from "@/lib/client-ip"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const FREE_TIER_LIMIT = 3
const FREE_TIER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// Free tier: 3 comics per week (fixed window)
export const freeTierRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(FREE_TIER_LIMIT, "7 d"),
  analytics: true,
  prefix: "ratelimit:free-comics",
  timeout: 0,
})

const RATE_LIMITED_MESSAGE = "Too many requests. Please wait a bit and try again."
const RATE_LIMIT_UNAVAILABLE_MESSAGE = "Service temporarily unavailable. Please try again shortly."
const FREE_TIER_EXHAUSTED_MESSAGE =
  "You've used all your free comics for this week. Add your Together AI API key for unlimited generation."

type RateLimitRule = { limit: number; window: Duration }

type RateLimitPolicy = {
  // "closed" rejects requests when Redis is unavailable (paid routes).
  failMode: "open" | "closed"
  user: readonly RateLimitRule[]
  ip: readonly RateLimitRule[]
}

const RATE_LIMITS = {
  // POST /api/generate-comic and /api/add-page (paid image generation)
  generation: {
    failMode: "closed",
    user: [
      { limit: 6, window: "1 m" },
      { limit: 60, window: "1 d" },
    ],
    ip: [
      { limit: 10, window: "1 m" },
      { limit: 100, window: "1 d" },
    ],
  },
  // POST /api/validate-api-key (outbound provider call)
  validateApiKey: {
    failMode: "closed",
    user: [
      { limit: 5, window: "1 m" },
      { limit: 30, window: "1 d" },
    ],
    ip: [
      { limit: 10, window: "1 m" },
      { limit: 50, window: "1 d" },
    ],
  },
  // POST /api/s3-upload (upload credentials)
  upload: {
    failMode: "closed",
    user: [
      { limit: 20, window: "1 m" },
      { limit: 120, window: "1 d" },
    ],
    ip: [
      { limit: 30, window: "1 m" },
      { limit: 200, window: "1 d" },
    ],
  },
  // Feedback, page deletion, story updates
  write: {
    failMode: "open",
    user: [
      { limit: 30, window: "1 m" },
      { limit: 300, window: "1 d" },
    ],
    ip: [
      { limit: 30, window: "1 m" },
      { limit: 300, window: "1 d" },
    ],
  },
  // GET /api/download-pdf
  download: {
    failMode: "open",
    user: [{ limit: 10, window: "1 m" }],
    ip: [
      { limit: 10, window: "1 m" },
      { limit: 100, window: "1 d" },
    ],
  },
} as const satisfies Record<string, RateLimitPolicy>

export type RateLimitBucket = keyof typeof RATE_LIMITS

const limiters = new Map<string, Ratelimit>()

function getLimiter(bucket: RateLimitBucket, scope: "user" | "ip", rule: RateLimitRule) {
  const prefix = `ratelimit:${bucket}:${scope}:${rule.limit}:${rule.window.replace(/\s/g, "")}`
  let limiter = limiters.get(prefix)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(rule.limit, rule.window),
      prefix,
      timeout: 0,
    })
    limiters.set(prefix, limiter)
  }
  return limiter
}

// Returns an error response when the request must be rejected, otherwise null.
// Applies per-user limits when signed in and per-IP limits always.
export async function enforceRateLimit(
  bucket: RateLimitBucket,
  request: Pick<Request, "headers">,
  userId?: string | null,
): Promise<NextResponse | null> {
  const policy: RateLimitPolicy = RATE_LIMITS[bucket]
  const checks: Array<{ scope: "user" | "ip"; id: string; rule: RateLimitRule }> = []
  if (userId) {
    for (const rule of policy.user) checks.push({ scope: "user", id: userId, rule })
  }
  const ip = getClientIp(request.headers)
  for (const rule of policy.ip) checks.push({ scope: "ip", id: ip, rule })

  try {
    for (const { scope, id, rule } of checks) {
      const { success, reset } = await getLimiter(bucket, scope, rule).limit(id)
      if (!success) {
        const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
        return NextResponse.json(
          { error: RATE_LIMITED_MESSAGE, isRateLimited: true },
          { status: 429, headers: { "Retry-After": String(retryAfter) } },
        )
      }
    }
  } catch (error) {
    console.error(`Rate limiter unavailable for ${bucket}:`, error)
    if (policy.failMode === "open") return null
    return NextResponse.json({ error: RATE_LIMIT_UNAVAILABLE_MESSAGE }, { status: 503 })
  }

  return null
}

// Consumes one free-tier credit before generation. Returns an error response
// when the user has no credits left or the quota can't be checked.
export async function consumeFreeTierCredit(userId: string): Promise<NextResponse | null> {
  try {
    const { success } = await freeTierRateLimit.limit(userId)
    if (success) return null
    return NextResponse.json(
      { error: FREE_TIER_EXHAUSTED_MESSAGE, errorType: "free_tier_limit", isRateLimited: true },
      { status: 429 },
    )
  } catch (error) {
    console.error("Free tier quota unavailable:", error)
    return NextResponse.json({ error: RATE_LIMIT_UNAVAILABLE_MESSAGE }, { status: 503 })
  }
}

// Returns a credit consumed at `chargedAt` if its window is still current.
export async function refundFreeTierCredit(userId: string, chargedAt: number): Promise<void> {
  if (Math.floor(chargedAt / FREE_TIER_WINDOW_MS) !== Math.floor(Date.now() / FREE_TIER_WINDOW_MS)) {
    return
  }
  try {
    await freeTierRateLimit.limit(userId, { rate: -1 })
  } catch (error) {
    console.error("Error refunding free tier credit:", error)
  }
}
