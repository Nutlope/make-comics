export const MAX_API_KEY_LENGTH = 256;

export type UserApiKey =
  | { status: "absent" }
  | { status: "invalid" }
  | { status: "valid"; key: string };

// A user-supplied Together API key (bring-your-own-key). Only a "valid" key may
// skip the free-tier quota, and it must then be the key used for the provider call.
export function parseUserApiKey(value: unknown): UserApiKey {
  if (value === undefined || value === null) return { status: "absent" };
  if (typeof value !== "string") return { status: "invalid" };

  const key = value.trim();
  if (key.length === 0) return { status: "absent" };
  if (key.length > MAX_API_KEY_LENGTH || !/^[\x21-\x7e]+$/.test(key)) {
    return { status: "invalid" };
  }
  return { status: "valid", key };
}
