import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MagicAppsClient } from "../src/client.js";
import { MagicAppsError, ApiError } from "../src/errors.js";

describe("MagicAppsClient", () => {
  const defaultConfig = {
    baseUrl: "https://api.example.com",
    appId: "test-app",
  };

  describe("constructor", () => {
    it("creates client with valid config", () => {
      const client = new MagicAppsClient(defaultConfig);
      expect(client).toBeInstanceOf(MagicAppsClient);
    });

    it("throws if baseUrl is empty", () => {
      expect(
        () => new MagicAppsClient({ baseUrl: "", appId: "test" }),
      ).toThrow(MagicAppsError);
    });

    it("throws if appId is empty", () => {
      expect(
        () => new MagicAppsClient({ baseUrl: "https://api.test.com", appId: "" }),
      ).toThrow(MagicAppsError);
    });

    it("strips trailing slashes from baseUrl", () => {
      const client = new MagicAppsClient({
        baseUrl: "https://api.example.com///",
        appId: "test-app",
      });
      expect(client).toBeInstanceOf(MagicAppsClient);
    });
  });

  describe("API methods", () => {
    let client: MagicAppsClient;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      client = new MagicAppsClient(defaultConfig);
      fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("getAppInfo calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          app_id: "test-app",
          name: "Test App",
          slug: "test-app",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        }),
      });

      const result = await client.getAppInfo();
      expect(result.status).toBe(200);
      expect(result.data.app_id).toBe("test-app");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("listTemplates calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await client.listTemplates();
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/templates",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("listTemplates passes next_token", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await client.listTemplates("abc123");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/templates?next_token=abc123",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("getTemplate calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ template_id: "tmpl-1" }),
      });

      await client.getTemplate("tmpl-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/templates/tmpl-1",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("includes auth token when set", async () => {
      client.setAuthToken("my-token");
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await client.getAppInfo();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer my-token",
          }),
        }),
      );
    });

    it("throws ApiError on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ message: "App not found" }),
      });

      await expect(client.getAppInfo()).rejects.toThrow(ApiError);
    });

    it("getAiUsage calls correct endpoint without options", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ usage: [], count: 0 }),
      });

      const result = await client.getAiUsage();
      expect(result.status).toBe(200);
      expect(result.data.usage).toEqual([]);
      expect(result.data.count).toBe(0);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/ai/usage",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("getAiUsage passes query parameters", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          usage: [{
            usage_id: "u-1",
            app_id: "test-app",
            provider_id: "openai",
            model_id: "gpt-4o-mini",
            request_type: "chat",
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            latency_ms: 420,
            status: "success",
            created_at: 1709251200000,
            expires_at: 1717027200,
          }],
          count: 1,
        }),
      });

      const result = await client.getAiUsage({
        limit: 10,
        start_date: "2025-01-01T00:00:00Z",
        end_date: "2025-02-01T00:00:00Z",
      });
      expect(result.data.count).toBe(1);
      expect(result.data.usage[0].usage_id).toBe("u-1");
      expect(result.data.usage[0].provider_id).toBe("openai");
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("limit=10"),
        expect.objectContaining({ method: "GET" }),
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("start_date=2025-01-01T00%3A00%3A00Z"),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("getAiUsageSummary calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ total_requests: 42, total_tokens: 10000 }),
      });

      const result = await client.getAiUsageSummary();
      expect(result.data.total_requests).toBe(42);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/ai/usage/summary",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });
});
