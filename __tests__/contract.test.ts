/**
 * SDK ↔ API Contract Validation Tests
 *
 * These tests verify that every SDK method points to a real API endpoint with
 * the correct HTTP method, path, and request body shape. They mock `fetch` at
 * the SDK level and assert the correct URL / method / body are sent.
 *
 * Route catalog derived from:
 *   - apigateway_http.tf (definitive route_key list)
 *   - lambda/templates/index.js, lambda/devices/index.js,
 *     lambda/endpoints/index.js, lambda/events/index.js,
 *     lambda/lookup_tables/index.js, lambda/ai_proxy/index.js,
 *     lambda/registry/index.js
 *
 * Mismatches fixed during initial creation: None — all SDK methods matched
 * their corresponding API Gateway routes and Lambda handler expectations.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MagicAppsClient } from "../src/client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.example.com";
const APP_ID = "test-app";

/** Shorthand to create a client and a fetch spy for each test. */
function setup() {
  const client = new MagicAppsClient({
    baseUrl: BASE_URL,
    appId: APP_ID,
    authToken: "test-token",
  });
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  });
  vi.stubGlobal("fetch", fetchSpy);
  return { client, fetchSpy };
}

/**
 * Canonical list of every API Gateway route that the SDK could target.
 * Sourced from apigateway_http.tf `route_key` values.
 */
const API_ROUTES: Array<{ method: string; path: string }> = [
  // Templates / Apps (lambda: templates)
  { method: "GET", path: "/apps" },
  { method: "GET", path: "/apps/availability" },
  { method: "GET", path: "/apps/{app_id}" },
  { method: "GET", path: "/apps/{app_id}/templates" },
  { method: "GET", path: "/apps/{app_id}/templates/{template_id}" },
  { method: "POST", path: "/apps/{app_id}/templates" },
  { method: "PUT", path: "/apps/{app_id}/templates/{template_id}" },
  { method: "DELETE", path: "/apps/{app_id}/templates/{template_id}" },
  { method: "GET", path: "/registry/apps" },
  { method: "GET", path: "/templates" },
  { method: "GET", path: "/discover/apps" },

  // Devices (lambda: devices)
  { method: "GET", path: "/apps/{app_id}/devices" },

  // Endpoints (lambda: endpoints)
  { method: "POST", path: "/apps/{app_id}/endpoints" },
  { method: "POST", path: "/apps/{app_id}/endpoints/revoke" },
  { method: "POST", path: "/apps/{app_id}/endpoints/revoke_and_replace" },

  // Events (lambda: events)
  { method: "ANY", path: "/events/{slug}" },

  // Lookup tables (lambda: lookup_tables)
  { method: "GET", path: "/lookup-tables" },
  { method: "GET", path: "/lookup-tables/{lookup_table_id}" },
  { method: "GET", path: "/lookup-tables/{lookup_table_id}/chunks/{chunk_index}" },

  // AI Proxy (lambda: ai_proxy)
  { method: "POST", path: "/apps/{app_id}/ai/chat/completions" },
  { method: "POST", path: "/apps/{app_id}/ai/embeddings" },
  { method: "POST", path: "/apps/{app_id}/ai/images/generations" },
  { method: "POST", path: "/apps/{app_id}/ai/moderations" },
  { method: "GET", path: "/apps/{app_id}/ai/usage/summary" },
  { method: "GET", path: "/apps/{app_id}/ai/usage" },
  { method: "GET", path: "/apps/{app_id}/ai/providers" },
  { method: "POST", path: "/apps/{app_id}/ai/providers" },
  { method: "GET", path: "/apps/{app_id}/ai/providers/{provider_id}" },
  { method: "PATCH", path: "/apps/{app_id}/ai/providers/{provider_id}" },
  { method: "DELETE", path: "/apps/{app_id}/ai/providers/{provider_id}" },
  { method: "POST", path: "/apps/{app_id}/ai/providers/{provider_id}/test" },

  // Payment / Auth / IAP (lambda: payment) — not wrapped by SDK
  { method: "GET", path: "/pay/apps/{slug}" },
  { method: "POST", path: "/pay/auth/apple" },
  { method: "POST", path: "/pay/checkout" },
  { method: "GET", path: "/pay/verify" },
  { method: "POST", path: "/pay/verify" },
  { method: "POST", path: "/iap/transactions/verify" },
  { method: "POST", path: "/iap/notifications/apple" },
  { method: "POST", path: "/iap/restore/sync" },
  { method: "GET", path: "/pay/tiers" },
  { method: "GET", path: "/categories" },

  // Settings (lambda: settings)
  { method: "ANY", path: "/apps/{app_id}/settings" },
  { method: "ANY", path: "/apps/{app_id}/config" },

  // Client config & shortcuts (lambda: payment)
  { method: "GET", path: "/apps/{app_id}/client-config" },
  { method: "GET", path: "/apps/{app_id}/shortcuts" },
  { method: "GET", path: "/apps/{app_id}/shortcuts/icons/{icon_id}" },

  // Auth client (lambda: payment)
  { method: "POST", path: "/auth/client/apple/exchange" },
  { method: "POST", path: "/auth/client/google/exchange" },
  { method: "POST", path: "/auth/client/passkey/register/options" },
  { method: "POST", path: "/auth/client/passkey/register/verify" },
  { method: "POST", path: "/auth/client/passkey/authenticate/options" },
  { method: "POST", path: "/auth/client/passkey/authenticate/verify" },
  { method: "POST", path: "/auth/client/email/request" },
  { method: "POST", path: "/auth/client/email/verify" },
  { method: "POST", path: "/auth/client/refresh" },
  { method: "POST", path: "/auth/client/link" },
];

/**
 * Resolve a parametrised API Gateway path to a concrete URL used by the SDK.
 * e.g. "/apps/{app_id}/templates" → "/apps/test-app/templates"
 */
function resolveRoute(path: string): string {
  return path
    .replace("{app_id}", APP_ID)
    .replace("{template_id}", "tmpl-1")
    .replace("{slug}", "my-slug")
    .replace("{lookup_table_id}", "lt-1")
    .replace("{chunk_index}", "0")
    .replace("{provider_id}", "prov-1")
    .replace("{icon_id}", "icon-1");
}

/**
 * Check whether a concrete path matches any route in API_ROUTES.
 * For "ANY" methods, any HTTP method matches.
 */
function routeExists(method: string, concretePath: string): boolean {
  return API_ROUTES.some((r) => {
    const resolved = resolveRoute(r.path);
    const methodMatch = r.method === "ANY" || r.method === method;
    return methodMatch && resolved === concretePath;
  });
}

// ---------------------------------------------------------------------------
// Contract tests — verify each SDK method sends the correct HTTP method + URL
// ---------------------------------------------------------------------------

describe("SDK ↔ API Contract Validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Templates service
  // -----------------------------------------------------------------------

  describe("Templates", () => {
    it("getAppInfo → GET /apps/{app_id}", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ app_id: APP_ID, name: "Test" }),
      });
      await client.getAppInfo();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}`)).toBe(true);
    });

    it("listTemplates → GET /apps/{app_id}/templates", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });
      await client.listTemplates();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/templates`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/templates`)).toBe(true);
    });

    it("listTemplates with next_token → GET /apps/{app_id}/templates?next_token=...", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });
      await client.listTemplates("tok123");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("/apps/test-app/templates?next_token=tok123");
    });

    it("getTemplate → GET /apps/{app_id}/templates/{template_id}", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ template_id: "tmpl-1" }),
      });
      await client.getTemplate("tmpl-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/templates/tmpl-1`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/templates/tmpl-1`)).toBe(true);
    });

    it("createTemplate → POST /apps/{app_id}/templates with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ template_id: "tmpl-new" }),
      });
      const body = { name: "New Template", content: { key: "val" } };
      await client.createTemplate(body);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/templates`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/templates`)).toBe(true);
    });

    it("updateTemplate → PUT /apps/{app_id}/templates/{template_id} with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ template_id: "tmpl-1" }),
      });
      const body = { name: "Updated" };
      await client.updateTemplate("tmpl-1", body);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/templates/tmpl-1`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(body),
        }),
      );
      expect(routeExists("PUT", `/apps/${APP_ID}/templates/tmpl-1`)).toBe(true);
    });

    it("deleteTemplate → DELETE /apps/{app_id}/templates/{template_id}", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
      await client.deleteTemplate("tmpl-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/templates/tmpl-1`,
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(routeExists("DELETE", `/apps/${APP_ID}/templates/tmpl-1`)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // AI Services
  // -----------------------------------------------------------------------

  describe("AI Services", () => {
    it("createChatCompletion → POST /apps/{app_id}/ai/chat/completions with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [] }),
      });
      const body = {
        messages: [{ role: "user" as const, content: "hello" }],
        model: "gpt-4",
        temperature: 0.7,
      };
      await client.createChatCompletion(body);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/chat/completions`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/ai/chat/completions`)).toBe(true);
    });

    it("createEmbedding → POST /apps/{app_id}/ai/embeddings with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });
      await client.createEmbedding("test input", "text-embedding-ada-002");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/embeddings`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ input: "test input", model: "text-embedding-ada-002" }),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/ai/embeddings`)).toBe(true);
    });

    it("createEmbedding without model omits model from body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });
      await client.createEmbedding("test input");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ input: "test input" });
      expect(sentBody).not.toHaveProperty("model");
    });

    it("createImage → POST /apps/{app_id}/ai/images/generations with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });
      await client.createImage("a cat", { n: 2, size: "512x512" });
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/images/generations`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ prompt: "a cat", n: 2, size: "512x512" }),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/ai/images/generations`)).toBe(true);
    });

    it("createModeration → POST /apps/{app_id}/ai/moderations with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
      });
      await client.createModeration("test content", "text-moderation-latest");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/moderations`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ input: "test content", model: "text-moderation-latest" }),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/ai/moderations`)).toBe(true);
    });

    it("createModeration without model omits model from body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
      });
      await client.createModeration("test content");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ input: "test content" });
      expect(sentBody).not.toHaveProperty("model");
    });

    it("getAiUsageSummary → GET /apps/{app_id}/ai/usage/summary", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ total_requests: 0 }),
      });
      await client.getAiUsageSummary();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/usage/summary`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/ai/usage/summary`)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Devices
  // -----------------------------------------------------------------------

  describe("Devices", () => {
    it("getDevices → GET /apps/{app_id}/devices", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ devices: [] }),
      });
      await client.getDevices();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/devices`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/devices`)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Registry
  // -----------------------------------------------------------------------

  describe("Registry", () => {
    it("getRegistryApps → GET /registry/apps", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });
      await client.getRegistryApps();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/registry/apps`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", "/registry/apps")).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Endpoints
  // -----------------------------------------------------------------------

  describe("Endpoints", () => {
    it("createEndpoint → POST /apps/{app_id}/endpoints", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ slug: "abc", status: "active" }),
      });
      await client.createEndpoint();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/endpoints`,
        expect.objectContaining({ method: "POST" }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/endpoints`)).toBe(true);
    });

    it("revokeAndReplaceEndpoint → POST /apps/{app_id}/endpoints/revoke_and_replace with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ old_slug: "old", new_slug: "new" }),
      });
      await client.revokeAndReplaceEndpoint("old-slug");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/endpoints/revoke_and_replace`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ old_slug: "old-slug" }),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/endpoints/revoke_and_replace`)).toBe(true);
    });

    it("revokeEndpoint → POST /apps/{app_id}/endpoints/revoke with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ slug: "s", revoked: true }),
      });
      await client.revokeEndpoint("my-slug");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/endpoints/revoke`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ slug: "my-slug" }),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/endpoints/revoke`)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------

  describe("Events", () => {
    it("postEvent → POST /events/{slug} with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ slug: "my-slug", timestamp: 123 }),
      });
      const payload = { text: "hello", keywords: ["test"] };
      await client.postEvent("my-slug", payload);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/events/my-slug`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );
      expect(routeExists("POST", "/events/my-slug")).toBe(true);
    });

    it("consumeEvent → GET /events/{slug}", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ slug: "my-slug", empty: true }),
      });
      await client.consumeEvent("my-slug");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/events/my-slug`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", "/events/my-slug")).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Lookup Tables
  // -----------------------------------------------------------------------

  describe("Lookup Tables", () => {
    it("listLookupTables → GET /lookup-tables", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      });
      await client.listLookupTables();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/lookup-tables`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", "/lookup-tables")).toBe(true);
    });

    it("getLookupTable → GET /lookup-tables/{lookup_table_id}", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ lookup_table_id: "lt-1", chunk_count: 0, chunks: [] }),
      });
      await client.getLookupTable("lt-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/lookup-tables/lt-1`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", "/lookup-tables/lt-1")).toBe(true);
    });

    it("getLookupTable URL-encodes the lookup table ID", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ lookup_table_id: "has space", chunk_count: 0, chunks: [] }),
      });
      await client.getLookupTable("has space");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe(`${BASE_URL}/lookup-tables/has%20space`);
    });

    it("getLookupTableChunk → GET /lookup-tables/{id}/chunks/{index}", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ key: "value" }),
      });
      await client.getLookupTableChunk("lt-1", 0);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/lookup-tables/lt-1/chunks/0`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", "/lookup-tables/lt-1/chunks/0")).toBe(true);
    });

    it("getLookupTableChunk passes version as query param", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
      await client.getLookupTableChunk("lt-1", 2, 5);
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe(`${BASE_URL}/lookup-tables/lt-1/chunks/2?version=5`);
    });

    it("getFullLookupTableDataset assembles chunks correctly", async () => {
      const { client, fetchSpy } = setup();
      // First call: getLookupTable returns metadata with 2 chunks
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            lookup_table_id: "lt-1",
            chunk_count: 2,
            version: 1,
            chunks: [
              { index: 0, path: "chunk0.json", sha256: "a", byte_length: 10 },
              { index: 1, path: "chunk1.json", sha256: "b", byte_length: 10 },
            ],
          }),
        })
        // Second call: chunk 0
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ alpha: 1 }),
        })
        // Third call: chunk 1
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ beta: 2 }),
        });

      const result = await client.getFullLookupTableDataset("lt-1");
      expect(result.data).toEqual({ alpha: 1, beta: 2 });
      expect(result.status).toBe(200);

      // Verify correct sequence of calls
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy.mock.calls[0][0]).toBe(`${BASE_URL}/lookup-tables/lt-1`);
      expect(fetchSpy.mock.calls[1][0]).toBe(`${BASE_URL}/lookup-tables/lt-1/chunks/0?version=1`);
      expect(fetchSpy.mock.calls[2][0]).toBe(`${BASE_URL}/lookup-tables/lt-1/chunks/1?version=1`);
    });
  });

  // -----------------------------------------------------------------------
  // Request body shape validation
  // -----------------------------------------------------------------------

  describe("Request body shape validation", () => {
    it("createTemplate body matches handler expectations (name, content required)", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 201, json: async () => ({}) });
      const template = { name: "My Template", description: "desc", content: { steps: [] } };
      await client.createTemplate(template);
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      // Handler expects: name (required), content (required), description (optional)
      expect(sentBody).toHaveProperty("name");
      expect(sentBody).toHaveProperty("content");
      expect(sentBody.name).toBe("My Template");
      expect(sentBody.content).toEqual({ steps: [] });
    });

    it("updateTemplate sends only provided fields (partial update)", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
      await client.updateTemplate("tmpl-1", { name: "Updated Name" });
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ name: "Updated Name" });
      // Should NOT include template_id, app_id, created_at, updated_at
      expect(sentBody).not.toHaveProperty("template_id");
      expect(sentBody).not.toHaveProperty("app_id");
    });

    it("createChatCompletion body includes required messages array", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [] }) });
      await client.createChatCompletion({
        messages: [{ role: "user", content: "hi" }],
      });
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toHaveProperty("messages");
      expect(Array.isArray(sentBody.messages)).toBe(true);
      expect(sentBody.messages[0]).toHaveProperty("role");
      expect(sentBody.messages[0]).toHaveProperty("content");
    });

    it("createChatCompletion passes optional parameters when provided", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [] }) });
      await client.createChatCompletion({
        messages: [{ role: "user", content: "hi" }],
        model: "gpt-4",
        temperature: 0.5,
        max_tokens: 100,
        top_p: 0.9,
        stop: ["\n"],
      });
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody.model).toBe("gpt-4");
      expect(sentBody.temperature).toBe(0.5);
      expect(sentBody.max_tokens).toBe(100);
      expect(sentBody.top_p).toBe(0.9);
      expect(sentBody.stop).toEqual(["\n"]);
    });

    it("createImage body includes required prompt", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) });
      await client.createImage("sunset over mountains");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toHaveProperty("prompt", "sunset over mountains");
    });

    it("revokeAndReplaceEndpoint sends old_slug in body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
      await client.revokeAndReplaceEndpoint("abc123");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ old_slug: "abc123" });
    });

    it("revokeEndpoint sends slug in body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
      await client.revokeEndpoint("abc123");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ slug: "abc123" });
    });

    it("postEvent sends arbitrary payload as body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
      const payload = { text: "dictation result", keywords: ["hello"] };
      await client.postEvent("my-slug", payload);
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual(payload);
    });

    it("GET requests do not send a body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
      await client.getAppInfo();
      expect(fetchSpy.mock.calls[0][1].body).toBeUndefined();

      await client.getDevices();
      expect(fetchSpy.mock.calls[1][1].body).toBeUndefined();

      await client.listLookupTables();
      expect(fetchSpy.mock.calls[2][1].body).toBeUndefined();

      await client.getAiUsageSummary();
      expect(fetchSpy.mock.calls[3][1].body).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Phantom method detection — every SDK method targets a real route
  // -----------------------------------------------------------------------

  describe("Phantom method detection", () => {
    /**
     * Exhaustive catalog of every public SDK method and the HTTP method + path
     * it constructs. If a method is added to the SDK but has no matching API
     * Gateway route, this test will catch it.
     */
    const sdkMethods: Array<{ name: string; method: string; path: string }> = [
      // Templates / Apps
      { name: "getAppInfo", method: "GET", path: `/apps/${APP_ID}` },
      { name: "listTemplates", method: "GET", path: `/apps/${APP_ID}/templates` },
      { name: "getTemplate", method: "GET", path: `/apps/${APP_ID}/templates/tmpl-1` },
      { name: "createTemplate", method: "POST", path: `/apps/${APP_ID}/templates` },
      { name: "updateTemplate", method: "PUT", path: `/apps/${APP_ID}/templates/tmpl-1` },
      { name: "deleteTemplate", method: "DELETE", path: `/apps/${APP_ID}/templates/tmpl-1` },

      // AI Services
      { name: "createChatCompletion", method: "POST", path: `/apps/${APP_ID}/ai/chat/completions` },
      { name: "createEmbedding", method: "POST", path: `/apps/${APP_ID}/ai/embeddings` },
      { name: "createImage", method: "POST", path: `/apps/${APP_ID}/ai/images/generations` },
      { name: "createModeration", method: "POST", path: `/apps/${APP_ID}/ai/moderations` },
      { name: "getAiUsageSummary", method: "GET", path: `/apps/${APP_ID}/ai/usage/summary` },

      // Devices
      { name: "getDevices", method: "GET", path: `/apps/${APP_ID}/devices` },

      // Registry
      { name: "getRegistryApps", method: "GET", path: "/registry/apps" },

      // Endpoints
      { name: "createEndpoint", method: "POST", path: `/apps/${APP_ID}/endpoints` },
      { name: "revokeAndReplaceEndpoint", method: "POST", path: `/apps/${APP_ID}/endpoints/revoke_and_replace` },
      { name: "revokeEndpoint", method: "POST", path: `/apps/${APP_ID}/endpoints/revoke` },

      // Events
      { name: "postEvent", method: "POST", path: "/events/my-slug" },
      { name: "consumeEvent", method: "GET", path: "/events/my-slug" },

      // Lookup Tables
      { name: "listLookupTables", method: "GET", path: "/lookup-tables" },
      { name: "getLookupTable", method: "GET", path: "/lookup-tables/lt-1" },
      { name: "getLookupTableChunk", method: "GET", path: "/lookup-tables/lt-1/chunks/0" },
      // getFullLookupTableDataset and getAllDevices are composites
    ];

    it.each(sdkMethods)(
      "$name → $method $path maps to a real API Gateway route",
      ({ method, path }) => {
        expect(routeExists(method, path)).toBe(true);
      },
    );

    it("SDK method count matches catalog (detects new unchecked methods)", () => {
      // Count public methods on MagicAppsClient (excluding setAuthToken and constructor)
      const client = new MagicAppsClient({ baseUrl: BASE_URL, appId: APP_ID });
      const proto = Object.getPrototypeOf(client);
      const publicMethods = Object.getOwnPropertyNames(proto).filter(
        (name) =>
          name !== "constructor" &&
          typeof (proto as Record<string, unknown>)[name] === "function" &&
          !name.startsWith("_") &&
          name !== "request", // private helper, not a public API method
      );

      // setAuthToken is a setter, not an API method
      const apiMethods = publicMethods.filter((m) => m !== "setAuthToken");

      // Every API method should be listed in sdkMethods (or be a composite)
      const catalogedNames = new Set(sdkMethods.map((m) => m.name));
      const composites = new Set(["getFullLookupTableDataset", "getAllDevices"]); // composite methods

      const uncovered = apiMethods.filter(
        (m) => !catalogedNames.has(m) && !composites.has(m),
      );

      expect(uncovered).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Auth header contract
  // -----------------------------------------------------------------------

  describe("Auth header contract", () => {
    it("includes Bearer token when authToken is set", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
      await client.getAppInfo();
      const headers = fetchSpy.mock.calls[0][1].headers;
      expect(headers["Authorization"]).toBe("Bearer test-token");
    });

    it("omits Authorization header when no authToken", async () => {
      const client = new MagicAppsClient({ baseUrl: BASE_URL, appId: APP_ID });
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
      vi.stubGlobal("fetch", fetchSpy);
      await client.getAppInfo();
      const headers = fetchSpy.mock.calls[0][1].headers;
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("always sends Content-Type: application/json", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
      await client.getAppInfo();
      const headers = fetchSpy.mock.calls[0][1].headers;
      expect(headers["Content-Type"]).toBe("application/json");
    });
  });
});
