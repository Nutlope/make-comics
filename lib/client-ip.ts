// Vercel overwrites `x-real-ip` and `x-vercel-forwarded-for`, so neither can be
// spoofed by the client. The raw `x-forwarded-for` is only consulted outside
// Vercel (local dev).
export function getClientIp(
  headers: Pick<Headers, "get">,
  env: Record<string, string | undefined> = process.env,
): string {
  const vercelIp =
    headers.get("x-real-ip") ??
    firstListValue(headers.get("x-vercel-forwarded-for"));
  if (vercelIp) return normalizeIp(vercelIp);

  if (env.VERCEL !== "1") {
    const forwarded = firstListValue(headers.get("x-forwarded-for"));
    return forwarded ? normalizeIp(forwarded) : "local";
  }

  return "unknown";
}

function firstListValue(value: string | null) {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}

// IPv6 clients usually control a whole /64, so they share one bucket.
export function normalizeIp(raw: string): string {
  const ip = raw.trim().toLowerCase().slice(0, 64);
  if (!ip.includes(":")) return ip;

  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];

  const groups = expandIpv6(ip);
  return groups ? `${groups.slice(0, 4).join(":")}::/64` : ip;
}

function expandIpv6(ip: string): string[] | null {
  const halves = ip.split("%")[0].split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;

  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => group.replace(/^0+(?=.)/, ""));
}
