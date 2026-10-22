const assert = require("node:assert/strict");
const test = require("node:test");

const { getClientIp, normalizeIp } = require("./client-ip.ts");

const headers = (values: Record<string, string>) => new Headers(values);

test("prefers Vercel-provided client IP headers", () => {
  assert.equal(
    getClientIp(
      headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }),
      { VERCEL: "1" },
    ),
    "1.2.3.4",
  );
  assert.equal(
    getClientIp(headers({ "x-vercel-forwarded-for": "5.6.7.8, 10.0.0.1" }), {
      VERCEL: "1",
    }),
    "5.6.7.8",
  );
});

test("ignores spoofable x-forwarded-for on Vercel", () => {
  assert.equal(
    getClientIp(headers({ "x-forwarded-for": "9.9.9.9" }), { VERCEL: "1" }),
    "unknown",
  );
});

test("falls back to x-forwarded-for outside Vercel", () => {
  assert.equal(
    getClientIp(headers({ "x-forwarded-for": "9.9.9.9, 1.1.1.1" }), {}),
    "9.9.9.9",
  );
  assert.equal(getClientIp(headers({}), {}), "local");
});

test("groups IPv6 addresses by /64", () => {
  assert.equal(normalizeIp("2001:db8:1:2:aaaa::1"), "2001:db8:1:2::/64");
  assert.equal(normalizeIp("::ffff:1.2.3.4"), "1.2.3.4");
});
