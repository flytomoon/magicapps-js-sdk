import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MagicAppsClient } from "../src/client.js";
import { MagicAppsError } from "../src/errors.js";

describe("EmailService", () => {
  const mockFetch = vi.fn();

  function mockResponse(data: unknown, status = 200) {
    return {
      ok: true,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    };
  }

  function mock204() {
    return {
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
      text: () => Promise.resolve(""),
    };
  }

  let client: MagicAppsClient;

  beforeEach(() => {
    mockFetch.mockClear();
    vi.stubGlobal("fetch", mockFetch);
    client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "access-jwt",
      ownerToken: "owner-jwt",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- createImageToken ---

  it("createImageToken sends POST to correct path with owner auth", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({ token: "img-tok-1", image_url: "https://cdn.test/img.jpg", expires_at: 9999999 }),
    );

    const result = await client.email.createImageToken();
    expect(result.status).toBe(200);
    expect(result.data.token).toBe("img-tok-1");
    expect(result.data.image_url).toBe("https://cdn.test/img.jpg");
    expect(result.data.expires_at).toBe(9999999);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/apps/app1/routines/email-image/tokens",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer owner-jwt");
  });

  it("createImageToken with ttl_seconds option", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({ token: "img-tok-2", image_url: "https://cdn.test/img2.jpg", expires_at: 8888888 }),
    );

    const result = await client.email.createImageToken({ ttl_seconds: 3600 });
    expect(result.data.token).toBe("img-tok-2");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/apps/app1/routines/email-image/tokens",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ttl_seconds: 3600 }),
      }),
    );
  });

  // --- uploadImage ---

  it("uploadImage with base64 string sends to correct path", async () => {
    mockFetch.mockResolvedValue(mock204());

    const result = await client.email.uploadImage("img-tok-1", "/9j/4AAQ...");
    expect(result.status).toBe(204);
    expect(result.data).toBeNull();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/apps/app1/routines/email-image/img-tok-1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ image_jpeg_base64: "/9j/4AAQ..." }),
      }),
    );

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer owner-jwt");
  });

  it("uploadImage strips data URI prefix from base64 string", async () => {
    mockFetch.mockResolvedValue(mock204());

    await client.email.uploadImage("img-tok-1", "data:image/jpeg;base64,/9j/4AAQ...");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/apps/app1/routines/email-image/img-tok-1",
      expect.objectContaining({
        body: JSON.stringify({ image_jpeg_base64: "/9j/4AAQ..." }),
      }),
    );
  });

  it("uploadImage with ArrayBuffer converts to base64 and validates JPEG magic bytes", async () => {
    mockFetch.mockResolvedValue(mock204());

    // Valid JPEG: starts with 0xFF 0xD8
    const jpegBuffer = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const result = await client.email.uploadImage("img-tok-1", jpegBuffer.buffer);
    expect(result.status).toBe(204);

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.image_jpeg_base64).toBeTruthy();
    // Verify the base64 decodes back to our bytes
    const decoded = atob(sentBody.image_jpeg_base64);
    expect(decoded.charCodeAt(0)).toBe(0xFF);
    expect(decoded.charCodeAt(1)).toBe(0xD8);
  });

  it("uploadImage rejects non-JPEG data (throws error containing JPEG)", async () => {
    // PNG magic bytes
    const pngBuffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
    await expect(
      client.email.uploadImage("img-tok-1", pngBuffer.buffer),
    ).rejects.toThrow("JPEG");
  });

  it("uploadImage rejects non-JPEG Blob data", async () => {
    const pngBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4E, 0x47])], { type: "image/png" });
    await expect(
      client.email.uploadImage("img-tok-1", pngBlob),
    ).rejects.toThrow(MagicAppsError);
  });

  it("uploadImage with transform and query options", async () => {
    mockFetch.mockResolvedValue(mock204());

    await client.email.uploadImage("img-tok-1", "/9j/base64data", {
      transform: "meme",
      query: "add funny caption",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/apps/app1/routines/email-image/img-tok-1",
      expect.objectContaining({
        body: JSON.stringify({
          image_jpeg_base64: "/9j/base64data",
          transform: "meme",
          query: "add funny caption",
        }),
      }),
    );
  });

  // --- createTextToken ---

  it("createTextToken sends correct request", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({ token: "txt-tok-1", text_url: "https://cdn.test/text/1", expires_at: 7777777 }),
    );

    const result = await client.email.createTextToken({ ttl_seconds: 600 });
    expect(result.data.token).toBe("txt-tok-1");
    expect(result.data.text_url).toBe("https://cdn.test/text/1");
    expect(result.data.expires_at).toBe(7777777);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/apps/app1/routines/email-text/tokens",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ttl_seconds: 600 }),
      }),
    );

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer owner-jwt");
  });

  it("createTextToken with no options sends empty object", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({ token: "txt-tok-2", text_url: "https://cdn.test/text/2", expires_at: 6666666 }),
    );

    await client.email.createTextToken();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/apps/app1/routines/email-text/tokens",
      expect.objectContaining({
        body: JSON.stringify({}),
      }),
    );
  });

  // --- uploadText ---

  it("uploadText sends sentence field (not text)", async () => {
    mockFetch.mockResolvedValue(mock204());

    const result = await client.email.uploadText("txt-tok-1", "Hello world");
    expect(result.status).toBe(204);
    expect(result.data).toBeNull();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/apps/app1/routines/email-text/txt-tok-1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sentence: "Hello world" }),
      }),
    );

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer owner-jwt");
  });

  it("uploadText with metadata option", async () => {
    mockFetch.mockResolvedValue(mock204());

    await client.email.uploadText("txt-tok-1", "Hello world", { metadata: { source: "test" } });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/apps/app1/routines/email-text/txt-tok-1",
      expect.objectContaining({
        body: JSON.stringify({ sentence: "Hello world", metadata: { source: "test" } }),
      }),
    );
  });

  // --- getTokenStatus ---

  it("getTokenStatus decodes all fields including type and state", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        token: "img-tok-1",
        type: "image",
        state: "ready",
        ready_at: 1700000100,
        consumed_at: null,
        expires_at: 1700003600,
        updated_at: 1700000100,
      }),
    );

    const result = await client.email.getTokenStatus("img-tok-1");
    expect(result.status).toBe(200);
    expect(result.data.token).toBe("img-tok-1");
    expect(result.data.type).toBe("image");
    expect(result.data.state).toBe("ready");
    expect(result.data.ready_at).toBe(1700000100);
    expect(result.data.consumed_at).toBeNull();
    expect(result.data.expires_at).toBe(1700003600);
    expect(result.data.updated_at).toBe(1700000100);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test/apps/app1/routines/email-status/img-tok-1",
      expect.objectContaining({ method: "GET" }),
    );

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer owner-jwt");
  });

  it("getTokenStatus for text token in consumed state", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        token: "txt-tok-1",
        type: "text",
        state: "consumed",
        ready_at: 1700000100,
        consumed_at: 1700000200,
        expires_at: 1700003600,
        updated_at: 1700000200,
      }),
    );

    const result = await client.email.getTokenStatus("txt-tok-1");
    expect(result.data.type).toBe("text");
    expect(result.data.state).toBe("consumed");
    expect(result.data.consumed_at).toBe(1700000200);
  });

  // --- Auth mode verification ---

  it("all email methods use owner auth mode", async () => {
    // Verify each method sends the owner token
    mockFetch.mockResolvedValue(
      mockResponse({ token: "tok", image_url: "url", expires_at: 999 }),
    );
    await client.email.createImageToken();
    expect(mockFetch.mock.calls[0][1].headers["Authorization"]).toBe("Bearer owner-jwt");

    mockFetch.mockResolvedValue(mock204());
    await client.email.uploadImage("tok", "base64data");
    expect(mockFetch.mock.calls[1][1].headers["Authorization"]).toBe("Bearer owner-jwt");

    mockFetch.mockResolvedValue(
      mockResponse({ token: "tok", text_url: "url", expires_at: 999 }),
    );
    await client.email.createTextToken();
    expect(mockFetch.mock.calls[2][1].headers["Authorization"]).toBe("Bearer owner-jwt");

    mockFetch.mockResolvedValue(mock204());
    await client.email.uploadText("tok", "hello");
    expect(mockFetch.mock.calls[3][1].headers["Authorization"]).toBe("Bearer owner-jwt");

    mockFetch.mockResolvedValue(
      mockResponse({ token: "tok", type: "image", state: "armed", ready_at: null, consumed_at: null, expires_at: 999, updated_at: null }),
    );
    await client.email.getTokenStatus("tok");
    expect(mockFetch.mock.calls[4][1].headers["Authorization"]).toBe("Bearer owner-jwt");
  });

  // --- Service accessor ---

  it("email service is accessible on the client", () => {
    expect(client.email).toBeDefined();
    expect(typeof client.email.createImageToken).toBe("function");
    expect(typeof client.email.uploadImage).toBe("function");
    expect(typeof client.email.createTextToken).toBe("function");
    expect(typeof client.email.uploadText).toBe("function");
    expect(typeof client.email.getTokenStatus).toBe("function");
  });
});
