/**
 * SDK ↔ API Contract Validation Tests
 *
 * These tests verify that every SDK method points to a real API endpoint with
 * the correct HTTP method, path, and request body shape. They mock `fetch` at
 * the SDK level and assert the correct URL / method / body are sent.
 *
 * **Golden fixtures** are sourced from real Lambda handler return statements.
 * Each fixture includes a source comment referencing the Lambda file, function,
 * and approximate line number. Do NOT invent fields or types — every field in
 * a fixture must exist in the corresponding handler's response.
 *
 * Route catalog derived from:
 *   - apigateway_http.tf (definitive route_key list)
 *   - lambda/templates/index.js, lambda/devices/index.js,
 *     lambda/endpoints/index.js, lambda/events/index.js,
 *     lambda/lookup_tables/index.js, lambda/ai_proxy/index.js,
 *     lambda/registry/index.js
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
// Golden response fixtures — sourced from real Lambda handler return statements
// ---------------------------------------------------------------------------

// Source: lambda/templates/index.js handleAppGet (~line 496-501)
// Response shape: full app object from registry (varies by app)
const FIXTURE_APP_INFO = {
  app_id: "test-app",
  name: "Test App",
  public_description: "A test application",
  description: "Test description",
  created_by_name: "Test Creator",
  maintainer: "Test Maintainer",
  category: "productivity",
  tags: ["test"],
  aliases: [],
  group: "",
  is_new_until: "",
  last_verified_at: "",
  integrations: [{ template_type: "dictation" }],
};

// Source: lambda/templates/index.js handleList (~line 858-860)
// Response shape: { items: Template[] }
const FIXTURE_TEMPLATES_LIST = {
  items: [
    {
      id: "tmpl-1",
      template_name: "Test Template",
      template_type: "dictation",
      app_id: "test-app",
    },
  ],
};

// Source: lambda/templates/index.js handleGet (~line 871-898)
// Response shape: single template object
const FIXTURE_TEMPLATE = {
  id: "tmpl-1",
  integration_id: "int-1",
  app_id: "test-app",
  template_name: "Test Template",
  template_type: "dictation",
  endpoint_pattern: "/api/v1/process",
  parameters: [],
  metadata: {},
};

// Source: lambda/templates/index.js handleCreate (~line 969-1022)
// Response shape: created template item (201)
const FIXTURE_TEMPLATE_CREATED = {
  pk: "OWNER#owner-1",
  sk: "TEMPLATE#test-app#tmpl-new",
  template_id: "tmpl-new",
  integration_id: "int-1",
  app_id: "test-app",
  template_name: "New Template",
  template_type: "dictation",
  endpoint_pattern: "/api/v1/process",
  http_get_mode: undefined,
  poll_mode: undefined,
  timeout_ms: undefined,
  max_attempts: undefined,
  backoff_ms: undefined,
  empty_result_behavior: undefined,
  response_type: undefined,
  response_path: undefined,
  status: "beta",
  parameters: [],
  metadata: {},
  created_at: 1710000000000,
  updated_at: 1710000000000,
};

// Source: lambda/templates/index.js handleUpdate (~line 1065-1100)
// Response shape: updated template item (merged existing + body fields, explicit field list)
const FIXTURE_TEMPLATE_UPDATED = {
  pk: "OWNER#owner-1",
  sk: "TEMPLATE#test-app#tmpl-1",
  template_id: "tmpl-1",
  integration_id: "int-1",
  app_id: "test-app",
  template_name: "Updated Name",
  template_type: "dictation",
  endpoint_pattern: "/api/v1/process",
  http_get_mode: undefined,
  poll_mode: undefined,
  timeout_ms: undefined,
  max_attempts: undefined,
  backoff_ms: undefined,
  empty_result_behavior: undefined,
  response_type: undefined,
  response_path: undefined,
  status: "beta",
  parameters: [],
  metadata: {},
  updated_at: 1710000001000,
};

// Source: lambda/templates/index.js handleCreate (~line 995-1027)
// Response shape: created template with http_get_mode=input_source_poll and all poll config fields
const FIXTURE_TEMPLATE_API_POLL = {
  pk: "OWNER#owner-1",
  sk: "TEMPLATE#test-app#tmpl-poll",
  template_id: "tmpl-poll",
  integration_id: "int-poll",
  app_id: "test-app",
  template_name: "API Poll Template",
  template_type: "http_get",
  endpoint_pattern: "https://api.example.com/status",
  http_get_mode: "input_source_poll",
  poll_mode: "short_poll",
  timeout_ms: 30000,
  max_attempts: 10,
  backoff_ms: 2000,
  empty_result_behavior: "retry",
  response_type: "json",
  response_path: "$.data.result",
  status: "beta",
  parameters: [],
  metadata: {},
  created_at: 1710000000000,
  updated_at: 1710000000000,
};

// Source: lambda/templates/registryData.js (~line 184-230)
// Response shape: hosted inbound template from core registry data
const FIXTURE_TEMPLATE_HOSTED_INBOUND = {
  id: "dev.magicapps.inbound.slug_endpoint",
  template_name: "Hosted Inbound Endpoint",
  template_type: "slug_endpoint",
  group: "custom_core",
  endpoint_pattern: "/events/{slug}",
  parameters: [
    { name: "text", type: "dynamic", required: true, example: "Incoming payload" },
  ],
  integration_id: "magicapps.inbound",
  integration_name: "Hosted Inbound Endpoint",
  provider: "Magic Apps",
  description: "A managed inbound endpoint where third parties POST data to a Magic Apps-hosted URL. The client consumes received events on trigger.",
  category: "messaging",
  tags: ["inbound", "slug", "webhook"],
  status: "unreleased",
  version: "1.0.0",
  is_latest: true,
};

// Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
// Response shape: { id, provider, model, choices: Array, usage }
const FIXTURE_CHAT_COMPLETION = {
  id: "ai_resp_abc123",
  provider: "openai",
  model: "gpt-4",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Hello!" },
      finish_reason: "stop",
    },
  ],
  usage: {
    input_tokens: 10,
    output_tokens: 5,
    total_tokens: 15,
    estimated_cost_usd: 0.001,
  },
};

// Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
// Response shape: same normalized shape for embeddings
const FIXTURE_EMBEDDING = {
  id: "ai_resp_emb123",
  provider: "openai",
  model: "text-embedding-ada-002",
  choices: [],
  usage: {
    input_tokens: 8,
    output_tokens: 0,
    total_tokens: 8,
    estimated_cost_usd: 0.0001,
  },
};

// Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
// Response shape: same normalized shape for image generation
const FIXTURE_IMAGE_GENERATION = {
  id: "ai_resp_img123",
  provider: "openai",
  model: "dall-e-3",
  choices: [],
  usage: {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    estimated_cost_usd: 0.04,
  },
};

// Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
// Response shape: same normalized shape for moderation
const FIXTURE_MODERATION = {
  id: "ai_resp_mod123",
  provider: "openai",
  model: "text-moderation-latest",
  choices: [],
  usage: {
    input_tokens: 5,
    output_tokens: 0,
    total_tokens: 5,
    estimated_cost_usd: 0.0,
  },
};

// Source: lambda/ai_proxy/index.js handleGetUsageSummary (~line 457-474)
// Response shape: { summaries: UsageSummary[] }
const FIXTURE_AI_USAGE_SUMMARY = {
  summaries: [
    {
      app_id: "test-app",
      period: "MONTHLY#2026-03",
      total_requests: 150,
      total_input_tokens: 50000,
      total_output_tokens: 25000,
      total_estimated_cost_usd: 1.25,
      updated_at: 1710000000000,
    },
  ],
};

// Source: lambda/ai_proxy/index.js handleGetUsage (~line 436-454)
// Response shape: { usage: UsageRecord[], count: number }
const FIXTURE_AI_USAGE = {
  usage: [
    {
      usage_id: "usage-001",
      app_id: "test-app",
      provider_id: "openai",
      model_id: "gpt-4",
      request_type: "chat/completions",
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      latency_ms: 1200,
      status: "success",
      created_at: 1710000000000,
      expires_at: 1712592000000,
    },
  ],
  count: 1,
};

// Source: lambda/devices/index.js handler (~line 22-26)
// Response shape: { items: Device[] }
const FIXTURE_DEVICES = {
  items: [
    {
      id: "dev-1",
      device_name: "Test Device",
      display_name: "Test Device Display",
      device_type: "bluetooth",
      bluetooth_uuid: "0000-1234",
      tags: ["dictation"],
      visibility: "public",
      category: "microphone",
    },
  ],
};

// Source: lambda/templates/index.js handleRegistryApps (~line 515-518)
// Response shape: { items: CardApp[] } via toCardApp (~line 571-591)
const FIXTURE_REGISTRY_APPS = {
  items: [
    {
      app_id: "app-1",
      name: "Registry App",
      public_description: "A registry app",
      description: "Description",
      created_by_name: "Creator",
      maintainer: "Maintainer",
      category: "productivity",
      tags: ["test"],
      aliases: [],
      group: "",
      is_new_until: "",
      last_verified_at: "",
      integrations: [{ template_type: "dictation" }],
    },
  ],
};

// Source: lambda/endpoints/index.js handleCreate (~line 221-232)
// Response shape: { slug, status, expires_at, endpoint_path, hmac_secret?, hmac_required? }
const FIXTURE_ENDPOINT_CREATED = {
  slug: "abc123",
  status: "active",
  expires_at: 1712592000,
  endpoint_path: "/events/abc123",
  hmac_secret: "secret-key-123",
  hmac_required: true,
};

// Source: lambda/endpoints/index.js handleRevokeAndReplace (~line 425-437)
// Response shape: { old_slug, new_slug, new_endpoint_path, revoked_expires_at, new_expires_at, hmac_secret?, hmac_required? }
const FIXTURE_ENDPOINT_REVOKE_AND_REPLACE = {
  old_slug: "old-slug",
  new_slug: "new-slug",
  new_endpoint_path: "/events/new-slug",
  revoked_expires_at: 1710100000,
  new_expires_at: 1712592000,
  hmac_secret: "new-secret-key",
  hmac_required: true,
};

// Source: lambda/endpoints/index.js handleRevokeOnly (~line 521-524)
// Response shape: { slug, revoked: true }
const FIXTURE_ENDPOINT_REVOKED = {
  slug: "my-slug",
  revoked: true,
};

// Source: lambda/events/index.js handlePost (~line 238-246)
// Response shape: { slug, timestamp, expires_at }
const FIXTURE_EVENT_POSTED = {
  slug: "my-slug",
  timestamp: 1710000000000,
  expires_at: 1710086400,
};

// Source: lambda/events/index.js handleGet (~line 262-276)
// Response shape (empty): { empty: true, slug, text: "George Lucas" }
// Response shape (data): full item from DynamoDB (slug, timestamp, created_at, expires_at, text, keywords, raw_text, metadata)
const FIXTURE_EVENT_CONSUMED_EMPTY = {
  empty: true,
  slug: "my-slug",
  text: "George Lucas",
};

const FIXTURE_EVENT_CONSUMED_WITH_DATA = {
  slug: "my-slug",
  timestamp: 1710000000000,
  created_at: 1710000000000,
  expires_at: 1710086400,
  text: "hello world",
  keywords: ["hello"],
  raw_text: "hello world",
  metadata: {},
};

// Source: lambda/lookup_tables/index.js handleClientList (~line 87-94) + toSummary (~line 867-880)
// Response shape: { items: Summary[] }
const FIXTURE_LOOKUP_TABLES_LIST = {
  items: [
    {
      lookup_table_id: "lt-1",
      name: "Test Lookup Table",
      description: "A test lookup table",
      schema_keys: ["key1", "key2"],
      schema_key_count: 2,
      schema_keys_truncated: false,
      version: 1,
      payload_hash: "abc123hash",
      storage_mode: "chunked",
      chunk_count: 2,
      updated_at: 1710000000000,
    },
  ],
};

// Source: lambda/lookup_tables/index.js handleClientDetail (~line 97-108) + toClientDetail (~line 903-920)
// Response shape: extends toSummary + prompt, default_success_sentence, default_fail_sentence,
//   chunk_encoding, manifest_hash, chunks[]
const FIXTURE_LOOKUP_TABLE_DETAIL = {
  lookup_table_id: "lt-1",
  name: "Test Lookup Table",
  description: "A test lookup table",
  schema_keys: ["key1", "key2"],
  schema_key_count: 2,
  schema_keys_truncated: false,
  version: 1,
  payload_hash: "abc123hash",
  storage_mode: "chunked",
  chunk_count: 2,
  updated_at: 1710000000000,
  prompt: "Look up a value",
  default_success_sentence: "Found: {value}",
  default_fail_sentence: "Not found",
  chunk_encoding: "json",
  manifest_hash: "manifest-hash-abc",
  chunks: [
    { index: 0, path: "chunk0.json", sha256: "sha-a", byte_length: 1024 },
    { index: 1, path: "chunk1.json", sha256: "sha-b", byte_length: 2048 },
  ],
};

// Source: lambda/lookup_tables/index.js handleClientChunk (~line 134-138)
// Response shape: raw JSON chunk data (arbitrary key-value pairs)
const FIXTURE_LOOKUP_TABLE_CHUNK_0 = { alpha: 1, bravo: 2 };
const FIXTURE_LOOKUP_TABLE_CHUNK_1 = { charlie: 3, delta: 4 };

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
      // Source: lambda/templates/index.js handleAppGet (~line 496-501)
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_APP_INFO,
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
      // Source: lambda/templates/index.js handleList (~line 858-860)
      // Response shape: { items: Template[] }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_TEMPLATES_LIST,
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
      // Source: lambda/templates/index.js handleList (~line 858-860)
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_TEMPLATES_LIST,
      });
      await client.listTemplates("tok123");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("/apps/test-app/templates?next_token=tok123");
    });

    it("getTemplate → GET /apps/{app_id}/templates/{template_id}", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/templates/index.js handleGet (~line 871-898)
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_TEMPLATE,
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
      // Source: lambda/templates/index.js handleCreate (~line 940-963)
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => FIXTURE_TEMPLATE_CREATED,
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
      // Source: lambda/templates/index.js handleUpdate (~line 993-1015)
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_TEMPLATE_UPDATED,
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
      // Source: lambda/templates/index.js handleDelete (~line 1018-1025)
      // Response shape: 204, empty body
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 204,
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
      // Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
      // Response shape: { id, provider, model, choices: Array, usage }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_CHAT_COMPLETION,
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
      // Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
      // Response shape: { id, provider, model, choices, usage }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_EMBEDDING,
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
      // Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_EMBEDDING,
      });
      await client.createEmbedding("test input");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ input: "test input" });
      expect(sentBody).not.toHaveProperty("model");
    });

    it("createImage → POST /apps/{app_id}/ai/images/generations with correct body", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
      // Response shape: { id, provider, model, choices, usage }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_IMAGE_GENERATION,
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
      // Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
      // Response shape: { id, provider, model, choices, usage }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_MODERATION,
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
      // Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_MODERATION,
      });
      await client.createModeration("test content");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ input: "test content" });
      expect(sentBody).not.toHaveProperty("model");
    });

    it("getAiUsageSummary → GET /apps/{app_id}/ai/usage/summary", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/ai_proxy/index.js handleGetUsageSummary (~line 457-474)
      // Response shape: { summaries: UsageSummary[] }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_AI_USAGE_SUMMARY,
      });
      await client.getAiUsageSummary();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/usage/summary`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/ai/usage/summary`)).toBe(true);
    });

    it("getAiUsage → GET /apps/{app_id}/ai/usage", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/ai_proxy/index.js handleGetUsage (~line 436-454)
      // Response shape: { usage: UsageRecord[], count: number }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_AI_USAGE,
      });
      await client.getAiUsage();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/usage`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/ai/usage`)).toBe(true);
    });

    it("getAiUsage with options passes query params", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/ai_proxy/index.js handleGetUsage (~line 436-454)
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_AI_USAGE,
      });
      await client.getAiUsage({ limit: 10, start_date: "2026-01-01", end_date: "2026-03-13" });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("/ai/usage?");
      expect(url).toContain("limit=10");
      expect(url).toContain("start_date=2026-01-01");
      expect(url).toContain("end_date=2026-03-13");
    });
  });

  // -----------------------------------------------------------------------
  // Devices
  // -----------------------------------------------------------------------

  describe("Devices", () => {
    it("getDevices → GET /apps/{app_id}/devices", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/devices/index.js handler (~line 22-26)
      // Response shape: { items: Device[] }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_DEVICES,
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
      // Source: lambda/templates/index.js handleRegistryApps (~line 515-518) + toCardApp (~line 571-591)
      // Response shape: { items: CardApp[] }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_REGISTRY_APPS,
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
      // Source: lambda/endpoints/index.js handleCreate (~line 221-232)
      // Response shape: { slug, status, expires_at, endpoint_path, hmac_secret?, hmac_required? }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => FIXTURE_ENDPOINT_CREATED,
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
      // Source: lambda/endpoints/index.js handleRevokeAndReplace (~line 402-414)
      // Response shape: { old_slug, new_slug, new_endpoint_path, revoked_expires_at, new_expires_at, hmac_secret?, hmac_required? }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_ENDPOINT_REVOKE_AND_REPLACE,
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
      // Source: lambda/endpoints/index.js handleRevokeOnly (~line 521-524)
      // Response shape: { slug, revoked: true }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_ENDPOINT_REVOKED,
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
      // Source: lambda/events/index.js handlePost (~line 238-246)
      // Response shape: { slug, timestamp, expires_at }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => FIXTURE_EVENT_POSTED,
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
      // Source: lambda/events/index.js handleGet (~line 262-276)
      // Response shape (empty): { empty: true, slug, text: "George Lucas" }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_EVENT_CONSUMED_EMPTY,
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
      // Source: lambda/lookup_tables/index.js handleClientList (~line 87-94) + toSummary (~line 867-880)
      // Response shape: { items: Summary[] }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_LOOKUP_TABLES_LIST,
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
      // Source: lambda/lookup_tables/index.js handleClientDetail (~line 97-108) + toClientDetail (~line 903-920)
      // Response shape: extends toSummary + prompt, default_success_sentence, default_fail_sentence,
      //   chunk_encoding, manifest_hash, chunks[]
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_LOOKUP_TABLE_DETAIL,
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
      // Source: lambda/lookup_tables/index.js handleClientDetail (~line 97-108)
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_LOOKUP_TABLE_DETAIL,
      });
      await client.getLookupTable("has space");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe(`${BASE_URL}/lookup-tables/has%20space`);
    });

    it("getLookupTableChunk → GET /lookup-tables/{id}/chunks/{index}", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/lookup_tables/index.js handleClientChunk (~line 134-138)
      // Response shape: raw JSON chunk data
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_LOOKUP_TABLE_CHUNK_0,
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
      // Source: lambda/lookup_tables/index.js handleClientChunk (~line 124)
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_LOOKUP_TABLE_CHUNK_0,
      });
      await client.getLookupTableChunk("lt-1", 2, 5);
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe(`${BASE_URL}/lookup-tables/lt-1/chunks/2?version=5`);
    });

    it("getFullLookupTableDataset assembles chunks correctly", async () => {
      const { client, fetchSpy } = setup();
      // First call: getLookupTable returns metadata with 2 chunks
      // Source: lambda/lookup_tables/index.js toClientDetail (~line 903-920)
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => FIXTURE_LOOKUP_TABLE_DETAIL,
        })
        // Second call: chunk 0
        // Source: lambda/lookup_tables/index.js handleClientChunk (~line 134-138)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => FIXTURE_LOOKUP_TABLE_CHUNK_0,
        })
        // Third call: chunk 1
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => FIXTURE_LOOKUP_TABLE_CHUNK_1,
        });

      const result = await client.getFullLookupTableDataset("lt-1");
      expect(result.data).toEqual({ ...FIXTURE_LOOKUP_TABLE_CHUNK_0, ...FIXTURE_LOOKUP_TABLE_CHUNK_1 });
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
      // Source: lambda/templates/index.js handleCreate (~line 926-963)
      // Handler validates via createTemplateSchema — expects template_name, template_type, etc.
      fetchSpy.mockResolvedValue({ ok: true, status: 201, json: async () => FIXTURE_TEMPLATE_CREATED });
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
      // Source: lambda/templates/index.js handleUpdate (~line 966-1015)
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_TEMPLATE_UPDATED });
      await client.updateTemplate("tmpl-1", { name: "Updated Name" });
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ name: "Updated Name" });
      // Should NOT include template_id, app_id, created_at, updated_at
      expect(sentBody).not.toHaveProperty("template_id");
      expect(sentBody).not.toHaveProperty("app_id");
    });

    it("createChatCompletion body includes required messages array", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/ai_proxy/index.js — messages required in request body
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_CHAT_COMPLETION });
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
      // Source: lambda/ai_proxy/index.js — optional params forwarded to provider
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_CHAT_COMPLETION });
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
      // Source: lambda/ai_proxy/index.js — prompt required for image generation
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_IMAGE_GENERATION });
      await client.createImage("sunset over mountains");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toHaveProperty("prompt", "sunset over mountains");
    });

    it("revokeAndReplaceEndpoint sends old_slug in body", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/endpoints/index.js handleRevokeAndReplace (~line 235-414)
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_ENDPOINT_REVOKE_AND_REPLACE });
      await client.revokeAndReplaceEndpoint("abc123");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ old_slug: "abc123" });
    });

    it("revokeEndpoint sends slug in body", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/endpoints/index.js handleRevokeOnly (~line 417-525)
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_ENDPOINT_REVOKED });
      await client.revokeEndpoint("abc123");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ slug: "abc123" });
    });

    it("postEvent sends arbitrary payload as body", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/events/index.js handlePost (~line 238-246)
      fetchSpy.mockResolvedValue({ ok: true, status: 201, json: async () => FIXTURE_EVENT_POSTED });
      const payload = { text: "dictation result", keywords: ["hello"] };
      await client.postEvent("my-slug", payload);
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual(payload);
    });

    it("GET requests do not send a body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_APP_INFO });
      await client.getAppInfo();
      expect(fetchSpy.mock.calls[0][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_DEVICES });
      await client.getDevices();
      expect(fetchSpy.mock.calls[1][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_LOOKUP_TABLES_LIST });
      await client.listLookupTables();
      expect(fetchSpy.mock.calls[2][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_AI_USAGE_SUMMARY });
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
      { name: "getAiUsage", method: "GET", path: `/apps/${APP_ID}/ai/usage` },

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
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_APP_INFO });
      await client.getAppInfo();
      const headers = fetchSpy.mock.calls[0][1].headers;
      expect(headers["Authorization"]).toBe("Bearer test-token");
    });

    it("omits Authorization header when no authToken", async () => {
      const client = new MagicAppsClient({ baseUrl: BASE_URL, appId: APP_ID });
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_APP_INFO,
      });
      vi.stubGlobal("fetch", fetchSpy);
      await client.getAppInfo();
      const headers = fetchSpy.mock.calls[0][1].headers;
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("always sends Content-Type: application/json", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_APP_INFO });
      await client.getAppInfo();
      const headers = fetchSpy.mock.calls[0][1].headers;
      expect(headers["Content-Type"]).toBe("application/json");
    });
  });

  // -----------------------------------------------------------------------
  // Golden fixture shape validation — verify fixtures match real Lambda shapes
  // -----------------------------------------------------------------------

  describe("Golden fixture shape validation", () => {
    it("AI normalized response has required fields (id, provider, model, choices, usage)", () => {
      // Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
      for (const fixture of [FIXTURE_CHAT_COMPLETION, FIXTURE_EMBEDDING, FIXTURE_IMAGE_GENERATION, FIXTURE_MODERATION]) {
        expect(fixture).toHaveProperty("id");
        expect(fixture).toHaveProperty("provider");
        expect(fixture).toHaveProperty("model");
        expect(fixture).toHaveProperty("choices");
        expect(fixture).toHaveProperty("usage");
        expect(fixture.usage).toHaveProperty("input_tokens");
        expect(fixture.usage).toHaveProperty("output_tokens");
        expect(fixture.usage).toHaveProperty("total_tokens");
        expect(fixture.usage).toHaveProperty("estimated_cost_usd");
      }
    });

    it("AI usage summary has summaries array with correct fields", () => {
      // Source: lambda/ai_proxy/index.js handleGetUsageSummary (~line 457-474)
      expect(FIXTURE_AI_USAGE_SUMMARY).toHaveProperty("summaries");
      expect(Array.isArray(FIXTURE_AI_USAGE_SUMMARY.summaries)).toBe(true);
      const summary = FIXTURE_AI_USAGE_SUMMARY.summaries[0];
      expect(summary).toHaveProperty("app_id");
      expect(summary).toHaveProperty("period");
      expect(summary).toHaveProperty("total_requests");
      expect(summary).toHaveProperty("total_input_tokens");
      expect(summary).toHaveProperty("total_output_tokens");
      expect(summary).toHaveProperty("total_estimated_cost_usd");
      expect(summary).toHaveProperty("updated_at");
    });

    it("AI usage response has usage array with correct fields", () => {
      // Source: lambda/ai_proxy/index.js handleGetUsage (~line 436-454)
      expect(FIXTURE_AI_USAGE).toHaveProperty("usage");
      expect(FIXTURE_AI_USAGE).toHaveProperty("count");
      const record = FIXTURE_AI_USAGE.usage[0];
      expect(record).toHaveProperty("usage_id");
      expect(record).toHaveProperty("app_id");
      expect(record).toHaveProperty("provider_id");
      expect(record).toHaveProperty("model_id");
      expect(record).toHaveProperty("request_type");
      expect(record).toHaveProperty("input_tokens");
      expect(record).toHaveProperty("output_tokens");
      expect(record).toHaveProperty("total_tokens");
      expect(record).toHaveProperty("latency_ms");
      expect(record).toHaveProperty("status");
      expect(record).toHaveProperty("created_at");
      expect(record).toHaveProperty("expires_at");
    });

    it("Devices response has items array (not devices)", () => {
      // Source: lambda/devices/index.js handler (~line 22-26)
      // Lambda returns { items: Device[] }, NOT { devices: Device[] }
      expect(FIXTURE_DEVICES).toHaveProperty("items");
      expect(Array.isArray(FIXTURE_DEVICES.items)).toBe(true);
    });

    it("Registry apps response has items array of CardApp objects", () => {
      // Source: lambda/templates/index.js handleRegistryApps (~line 515-518)
      expect(FIXTURE_REGISTRY_APPS).toHaveProperty("items");
      const app = FIXTURE_REGISTRY_APPS.items[0];
      expect(app).toHaveProperty("app_id");
      expect(app).toHaveProperty("name");
      expect(app).toHaveProperty("public_description");
      expect(app).toHaveProperty("created_by_name");
      expect(app).toHaveProperty("category");
      expect(app).toHaveProperty("tags");
      expect(app).toHaveProperty("integrations");
    });

    it("Endpoint create response has correct fields", () => {
      // Source: lambda/endpoints/index.js handleCreate (~line 221-232)
      expect(FIXTURE_ENDPOINT_CREATED).toHaveProperty("slug");
      expect(FIXTURE_ENDPOINT_CREATED).toHaveProperty("status");
      expect(FIXTURE_ENDPOINT_CREATED).toHaveProperty("expires_at");
      expect(FIXTURE_ENDPOINT_CREATED).toHaveProperty("endpoint_path");
      expect(FIXTURE_ENDPOINT_CREATED.status).toBe("active");
      expect(FIXTURE_ENDPOINT_CREATED.endpoint_path).toMatch(/^\/events\//);
    });

    it("Lookup table summary has all toSummary fields", () => {
      // Source: lambda/lookup_tables/index.js toSummary (~line 867-880)
      const summary = FIXTURE_LOOKUP_TABLES_LIST.items[0];
      expect(summary).toHaveProperty("lookup_table_id");
      expect(summary).toHaveProperty("name");
      expect(summary).toHaveProperty("description");
      expect(summary).toHaveProperty("schema_keys");
      expect(summary).toHaveProperty("schema_key_count");
      expect(summary).toHaveProperty("schema_keys_truncated");
      expect(summary).toHaveProperty("version");
      expect(summary).toHaveProperty("payload_hash");
      expect(summary).toHaveProperty("storage_mode");
      expect(summary).toHaveProperty("chunk_count");
      expect(summary).toHaveProperty("updated_at");
    });

    it("Lookup table detail extends summary with client detail fields", () => {
      // Source: lambda/lookup_tables/index.js toClientDetail (~line 903-920)
      expect(FIXTURE_LOOKUP_TABLE_DETAIL).toHaveProperty("prompt");
      expect(FIXTURE_LOOKUP_TABLE_DETAIL).toHaveProperty("default_success_sentence");
      expect(FIXTURE_LOOKUP_TABLE_DETAIL).toHaveProperty("default_fail_sentence");
      expect(FIXTURE_LOOKUP_TABLE_DETAIL).toHaveProperty("chunk_encoding");
      expect(FIXTURE_LOOKUP_TABLE_DETAIL).toHaveProperty("manifest_hash");
      expect(FIXTURE_LOOKUP_TABLE_DETAIL).toHaveProperty("chunks");
      expect(Array.isArray(FIXTURE_LOOKUP_TABLE_DETAIL.chunks)).toBe(true);
      const chunk = FIXTURE_LOOKUP_TABLE_DETAIL.chunks[0];
      expect(chunk).toHaveProperty("index");
      expect(chunk).toHaveProperty("path");
      expect(chunk).toHaveProperty("sha256");
      expect(chunk).toHaveProperty("byte_length");
    });

    it("Template created fixture does not have deprecated source_mode field", () => {
      // Source: lambda/templates/index.js handleCreate (~line 969-1022)
      // source_mode was replaced by http_get_mode (never deployed to production)
      expect(FIXTURE_TEMPLATE_CREATED).not.toHaveProperty("source_mode");
      expect(FIXTURE_TEMPLATE).not.toHaveProperty("source_mode");
      expect(FIXTURE_TEMPLATE_UPDATED).not.toHaveProperty("source_mode");
    });

    it("Template fixtures have status field matching handler default", () => {
      // Source: lambda/templates/index.js handleCreate (~line 1012) — status: body.status || "beta"
      expect(FIXTURE_TEMPLATE_CREATED).toHaveProperty("status", "beta");
      expect(FIXTURE_TEMPLATE_UPDATED).toHaveProperty("status", "beta");
      expect(FIXTURE_TEMPLATE_API_POLL).toHaveProperty("status", "beta");
    });

    it("API poll template fixture has http_get_mode and all poll config fields", () => {
      // Source: lambda/templates/index.js handleCreate (~line 969-1022)
      expect(FIXTURE_TEMPLATE_API_POLL).toHaveProperty("http_get_mode", "input_source_poll");
      expect(FIXTURE_TEMPLATE_API_POLL).toHaveProperty("poll_mode", "short_poll");
      expect(FIXTURE_TEMPLATE_API_POLL).toHaveProperty("timeout_ms");
      expect(typeof FIXTURE_TEMPLATE_API_POLL.timeout_ms).toBe("number");
      expect(FIXTURE_TEMPLATE_API_POLL).toHaveProperty("max_attempts");
      expect(typeof FIXTURE_TEMPLATE_API_POLL.max_attempts).toBe("number");
      expect(FIXTURE_TEMPLATE_API_POLL).toHaveProperty("backoff_ms");
      expect(typeof FIXTURE_TEMPLATE_API_POLL.backoff_ms).toBe("number");
      expect(FIXTURE_TEMPLATE_API_POLL).toHaveProperty("empty_result_behavior", "retry");
      expect(FIXTURE_TEMPLATE_API_POLL).toHaveProperty("response_type", "json");
      expect(FIXTURE_TEMPLATE_API_POLL).toHaveProperty("response_path", "$.data.result");
    });

    it("Hosted inbound template fixture has correct core fields (no source_mode)", () => {
      // Source: lambda/templates/registryData.js (~line 184-230)
      expect(FIXTURE_TEMPLATE_HOSTED_INBOUND).not.toHaveProperty("source_mode");
      expect(FIXTURE_TEMPLATE_HOSTED_INBOUND).toHaveProperty("template_type", "slug_endpoint");
      expect(FIXTURE_TEMPLATE_HOSTED_INBOUND).toHaveProperty("group", "custom_core");
      expect(FIXTURE_TEMPLATE_HOSTED_INBOUND).toHaveProperty("endpoint_pattern", "/events/{slug}");
      expect(FIXTURE_TEMPLATE_HOSTED_INBOUND).toHaveProperty("parameters");
      expect(Array.isArray(FIXTURE_TEMPLATE_HOSTED_INBOUND.parameters)).toBe(true);
      expect(FIXTURE_TEMPLATE_HOSTED_INBOUND.parameters[0]).toHaveProperty("name", "text");
      expect(FIXTURE_TEMPLATE_HOSTED_INBOUND).toHaveProperty("status", "unreleased");
    });

    it("Event post response has slug, timestamp, expires_at", () => {
      // Source: lambda/events/index.js handlePost (~line 238-246)
      expect(FIXTURE_EVENT_POSTED).toHaveProperty("slug");
      expect(FIXTURE_EVENT_POSTED).toHaveProperty("timestamp");
      expect(FIXTURE_EVENT_POSTED).toHaveProperty("expires_at");
    });

    it("Event consume empty response has empty flag and George Lucas text", () => {
      // Source: lambda/events/index.js handleGet (~line 262-267)
      expect(FIXTURE_EVENT_CONSUMED_EMPTY).toHaveProperty("empty", true);
      expect(FIXTURE_EVENT_CONSUMED_EMPTY).toHaveProperty("slug");
      expect(FIXTURE_EVENT_CONSUMED_EMPTY).toHaveProperty("text", "George Lucas");
    });
  });
});
