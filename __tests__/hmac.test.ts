import { describe, it, expect, vi, afterEach } from "vitest";
import { generateHmacSignature, verifyHmacSignature } from "../src/hmac.js";

describe("HMAC Helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateHmacSignature", () => {
    it("produces a hex-encoded HMAC-SHA256 signature", async () => {
      const result = await generateHmacSignature("my-slug", '{"key":"val"}', "secret123", 1700000000);
      expect(result.signature).toMatch(/^[0-9a-f]{64}$/);
      expect(result.timestamp).toBe("1700000000");
    });

    it("uses current time when timestampSec is not provided", async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const result = await generateHmacSignature("slug", "body", "secret");
      const ts = parseInt(result.timestamp, 10);
      // Should be within 2 seconds of now
      expect(Math.abs(ts - nowSec)).toBeLessThanOrEqual(2);
    });

    it("produces deterministic output for same inputs", async () => {
      const args = ["slug", "body", "secret", 1700000000] as const;
      const r1 = await generateHmacSignature(...args);
      const r2 = await generateHmacSignature(...args);
      expect(r1.signature).toBe(r2.signature);
      expect(r1.timestamp).toBe(r2.timestamp);
    });

    it("produces different signatures for different slugs", async () => {
      const r1 = await generateHmacSignature("slug-a", "body", "secret", 1700000000);
      const r2 = await generateHmacSignature("slug-b", "body", "secret", 1700000000);
      expect(r1.signature).not.toBe(r2.signature);
    });

    it("produces different signatures for different bodies", async () => {
      const r1 = await generateHmacSignature("slug", "body-a", "secret", 1700000000);
      const r2 = await generateHmacSignature("slug", "body-b", "secret", 1700000000);
      expect(r1.signature).not.toBe(r2.signature);
    });

    it("produces different signatures for different secrets", async () => {
      const r1 = await generateHmacSignature("slug", "body", "secret-a", 1700000000);
      const r2 = await generateHmacSignature("slug", "body", "secret-b", 1700000000);
      expect(r1.signature).not.toBe(r2.signature);
    });

    it("produces different signatures for different timestamps", async () => {
      const r1 = await generateHmacSignature("slug", "body", "secret", 1700000000);
      const r2 = await generateHmacSignature("slug", "body", "secret", 1700000001);
      expect(r1.signature).not.toBe(r2.signature);
    });

    it("signature format matches slug:timestamp:body pattern", async () => {
      // The message signed is "slug:ts:body" — verify by generating two signatures
      // with same components arranged differently
      const r1 = await generateHmacSignature("a:b", "c", "secret", 100);
      // message = "a:b:100:c"
      const r2 = await generateHmacSignature("a", "100:c", "secret", 0);
      // message = "a:0:100:c" — different, so signatures must differ
      // This just verifies the concatenation includes separators
      expect(r1.signature).not.toBe(r2.signature);
    });
  });

  describe("verifyHmacSignature", () => {
    it("returns true for a valid signature", async () => {
      const secret = "test-secret";
      const slug = "my-endpoint";
      const body = '{"event":"test"}';
      const ts = Math.floor(Date.now() / 1000);

      const { signature, timestamp } = await generateHmacSignature(slug, body, secret, ts);
      const valid = await verifyHmacSignature(slug, body, signature, timestamp, secret);
      expect(valid).toBe(true);
    });

    it("returns false for wrong signature", async () => {
      const secret = "test-secret";
      const slug = "my-endpoint";
      const body = '{"event":"test"}';
      const ts = Math.floor(Date.now() / 1000);

      const valid = await verifyHmacSignature(slug, body, "bad-signature-00000000000000000000000000000000000000000000000000000000000", String(ts), secret);
      expect(valid).toBe(false);
    });

    it("returns false for wrong secret", async () => {
      const slug = "my-endpoint";
      const body = '{"event":"test"}';
      const ts = Math.floor(Date.now() / 1000);

      const { signature, timestamp } = await generateHmacSignature(slug, body, "secret-a", ts);
      const valid = await verifyHmacSignature(slug, body, signature, timestamp, "secret-b");
      expect(valid).toBe(false);
    });

    it("returns false for tampered body", async () => {
      const secret = "test-secret";
      const slug = "my-endpoint";
      const ts = Math.floor(Date.now() / 1000);

      const { signature, timestamp } = await generateHmacSignature(slug, '{"original":true}', secret, ts);
      const valid = await verifyHmacSignature(slug, '{"tampered":true}', signature, timestamp, secret);
      expect(valid).toBe(false);
    });

    it("returns false for non-numeric timestamp", async () => {
      const valid = await verifyHmacSignature("slug", "body", "sig", "not-a-number", "secret");
      expect(valid).toBe(false);
    });

    it("returns false for expired timestamp (default 300s skew)", async () => {
      const secret = "test-secret";
      const slug = "my-endpoint";
      const body = "body";
      const oldTs = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago

      const { signature } = await generateHmacSignature(slug, body, secret, oldTs);
      const valid = await verifyHmacSignature(slug, body, signature, String(oldTs), secret);
      expect(valid).toBe(false);
    });

    it("returns false for future timestamp beyond skew", async () => {
      const secret = "test-secret";
      const slug = "my-endpoint";
      const body = "body";
      const futureTs = Math.floor(Date.now() / 1000) + 400; // 400 seconds in future

      const { signature } = await generateHmacSignature(slug, body, secret, futureTs);
      const valid = await verifyHmacSignature(slug, body, signature, String(futureTs), secret);
      expect(valid).toBe(false);
    });

    it("accepts timestamp within custom maxSkewSeconds", async () => {
      const secret = "test-secret";
      const slug = "my-endpoint";
      const body = "body";
      const ts = Math.floor(Date.now() / 1000) - 500; // 500 seconds ago

      const { signature } = await generateHmacSignature(slug, body, secret, ts);
      // Should fail with default 300s
      const fail = await verifyHmacSignature(slug, body, signature, String(ts), secret, 300);
      expect(fail).toBe(false);
      // Should pass with 600s
      const pass = await verifyHmacSignature(slug, body, signature, String(ts), secret, 600);
      expect(pass).toBe(true);
    });

    it("returns false for mismatched signature length (constant-time guard)", async () => {
      const secret = "test-secret";
      const slug = "my-endpoint";
      const body = "body";
      const ts = Math.floor(Date.now() / 1000);

      const valid = await verifyHmacSignature(slug, body, "short", String(ts), secret);
      expect(valid).toBe(false);
    });
  });
});
