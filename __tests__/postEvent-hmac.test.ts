import { describe, it, expect, vi, beforeEach } from "vitest";
import { MagicAppsClient } from "../src/client.js";

const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ slug: "test", timestamp: 123, expires_at: 456 }),
});
vi.stubGlobal("fetch", mockFetch);

describe("EndpointsService.postEvent HMAC", () => {
  beforeEach(() => { mockFetch.mockClear(); });

  it("sends no HMAC headers when hmacSecret is not provided", async () => {
    const client = new MagicAppsClient({ baseUrl: "https://api.test", appId: "app1" });
    await client.endpoints.postEvent("my-slug", { key: "value" });
    const [, fetchOpts] = mockFetch.mock.calls[0];
    expect(fetchOpts.headers["X-Signature"]).toBeUndefined();
    expect(fetchOpts.headers["X-Timestamp"]).toBeUndefined();
  });

  it("sends X-Signature and X-Timestamp when hmacSecret is provided", async () => {
    const client = new MagicAppsClient({ baseUrl: "https://api.test", appId: "app1" });
    await client.endpoints.postEvent("my-slug", { key: "value" }, "secret123");
    const [, fetchOpts] = mockFetch.mock.calls[0];
    expect(fetchOpts.headers["X-Signature"]).toMatch(/^[0-9a-f]{64}$/);
    expect(fetchOpts.headers["X-Timestamp"]).toMatch(/^\d+$/);
  });

  it("HMAC signature matches slug:timestamp:body format", async () => {
    const client = new MagicAppsClient({ baseUrl: "https://api.test", appId: "app1" });
    await client.endpoints.postEvent("my-slug", { key: "value" }, "secret123");
    const [, fetchOpts] = mockFetch.mock.calls[0];
    const body = fetchOpts.body;
    const timestamp = fetchOpts.headers["X-Timestamp"];
    const signature = fetchOpts.headers["X-Signature"];
    const { generateHmacSignature } = await import("../src/hmac.js");
    const expected = await generateHmacSignature("my-slug", body, "secret123", parseInt(timestamp, 10));
    expect(signature).toBe(expected.signature);
  });

  it("still sends Content-Type and body normally with HMAC", async () => {
    const client = new MagicAppsClient({ baseUrl: "https://api.test", appId: "app1" });
    await client.endpoints.postEvent("my-slug", { key: "value" }, "secret123");
    const [url, fetchOpts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/events/my-slug");
    expect(fetchOpts.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(fetchOpts.body)).toEqual({ key: "value" });
  });
});
