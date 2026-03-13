/**
 * HMAC signature helpers for authenticated event delivery.
 *
 * Matches the Swift (CommonCrypto) and Kotlin (javax.crypto.Mac)
 * implementations: HMAC-SHA256(secret, "slug:timestamp:body")
 *
 * Uses the Web Crypto API (globalThis.crypto.subtle) which is available in:
 * - Node.js 15+ (global crypto)
 * - All modern browsers
 * - Deno, Bun, Cloudflare Workers
 */

/** HMAC signature headers for authenticated event delivery. */
export interface HmacSignatureHeaders {
  /** Hex-encoded HMAC-SHA256 signature. */
  signature: string;
  /** Unix timestamp in seconds (string). */
  timestamp: string;
}

/**
 * Generate HMAC signature headers for posting a signed event.
 *
 * The signature is computed as: HMAC-SHA256(secret, "slug:timestamp:body")
 *
 * @param slug - The endpoint slug
 * @param body - The JSON body string being sent
 * @param secret - The HMAC secret from the endpoint
 * @param timestampSec - Optional Unix timestamp in seconds (defaults to now)
 * @returns HmacSignatureHeaders with signature and timestamp
 */
export async function generateHmacSignature(
  slug: string,
  body: string,
  secret: string,
  timestampSec?: number,
): Promise<HmacSignatureHeaders> {
  const ts = timestampSec ?? Math.floor(Date.now() / 1000);
  const message = `${slug}:${ts}:${body}`;
  const signature = await hmacSHA256(secret, message);
  return { signature, timestamp: String(ts) };
}

/**
 * Verify an HMAC signature on an incoming webhook payload.
 *
 * @param slug - The endpoint slug
 * @param body - The raw body string received
 * @param signature - The X-Signature header value
 * @param timestamp - The X-Timestamp header value
 * @param secret - The HMAC secret for this endpoint
 * @param maxSkewSeconds - Maximum allowed clock skew in seconds (default: 300)
 * @returns true if the signature is valid and timestamp is within range
 */
export async function verifyHmacSignature(
  slug: string,
  body: string,
  signature: string,
  timestamp: string,
  secret: string,
  maxSkewSeconds = 300,
): Promise<boolean> {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > maxSkewSeconds) return false;

  const message = `${slug}:${ts}:${body}`;
  const expected = await hmacSHA256(secret, message);

  // Constant-time comparison
  return timingSafeEqual(expected, signature);
}

/** Compute HMAC-SHA256 and return hex-encoded result. */
async function hmacSHA256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const bytes = new Uint8Array(signature);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
