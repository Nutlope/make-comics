const assert = require("node:assert/strict");
const test = require("node:test");

const { parseUserApiKey, MAX_API_KEY_LENGTH } = require("./api-key.ts");

test("treats missing or blank keys as absent", () => {
  for (const value of [undefined, null, "", "   ", "\t\n"]) {
    assert.deepEqual(parseUserApiKey(value), { status: "absent" });
  }
});

test("trims and accepts a well-formed key", () => {
  assert.deepEqual(parseUserApiKey("  tgp_v1_abc123  "), {
    status: "valid",
    key: "tgp_v1_abc123",
  });
});

test("rejects non-string, oversized, or malformed keys", () => {
  for (const value of [
    123,
    true,
    {},
    ["key"],
    "has space",
    "line\nbreak",
    "x".repeat(MAX_API_KEY_LENGTH + 1),
  ]) {
    assert.deepEqual(parseUserApiKey(value), { status: "invalid" });
  }
});
