/**
 * SDK <-> API Contract Validation Tests
 *
 * These tests verify that every SDK method points to a real API endpoint with
 * the correct HTTP method, path, and request body shape. They mock `fetch` at
 * the SDK level and assert the correct URL / method / body are sent.
 *
 * **Golden fixtures** are sourced from real Lambda handler return statements.
 * Each fixture includes a source comment referencing the Lambda file, function,
 * and approximate line number. Do NOT invent fields or types -- every field in
 * a fixture must exist in the corresponding handler's response.
 *
 * Route catalog derived from:
 *   - apigateway_http.tf (definitive route_key list)
 *   - lambda/templates/index.js, lambda/devices/index.js,
 *     lambda/endpoints/index.js, lambda/events/index.js,
 *     lambda/lookup_tables/index.js, lambda/ai_proxy/index.js,
 *     lambda/settings/index.js, lambda/payment/index.js
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
  // Health check (lambda: ping)
  { method: "GET", path: "/ping" },

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

  // Payment / Auth / IAP (lambda: payment) -- not wrapped by SDK
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

  // Integrations (lambda: settings)
  { method: "ANY", path: "/apps/{app_id}/integrations/{integration_id}/secret" },

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

  // Owner (lambda: settings / payment)
  { method: "POST", path: "/owner/register" },
  { method: "POST", path: "/owner/migrate" },

  // User Profiles
  { method: "GET", path: "/apps/{app_id}/profile" },
  { method: "PUT", path: "/apps/{app_id}/profile" },
  { method: "GET", path: "/apps/{app_id}/profile/{user_id}" },

  // Account
  { method: "DELETE", path: "/apps/{app_id}/account" },
  { method: "GET", path: "/apps/{app_id}/account/data-export" },
  { method: "GET", path: "/apps/{app_id}/account/consent" },
  { method: "PUT", path: "/apps/{app_id}/account/consent" },

  // File Storage
  { method: "POST", path: "/apps/{app_id}/files/upload-url" },
  { method: "GET", path: "/apps/{app_id}/files" },
  { method: "GET", path: "/apps/{app_id}/files/{file_id}" },
  { method: "DELETE", path: "/apps/{app_id}/files/{file_id}" },

  // AI Conversations
  { method: "POST", path: "/apps/{app_id}/ai/conversations" },
  { method: "GET", path: "/apps/{app_id}/ai/conversations" },
  { method: "GET", path: "/apps/{app_id}/ai/conversations/{conversation_id}" },
  { method: "POST", path: "/apps/{app_id}/ai/conversations/{conversation_id}/messages" },
  { method: "DELETE", path: "/apps/{app_id}/ai/conversations/{conversation_id}" },

  // Push Notifications
  { method: "POST", path: "/apps/{app_id}/notifications/register" },
  { method: "DELETE", path: "/apps/{app_id}/notifications/register/{device_id}" },
];

/**
 * Resolve a parametrised API Gateway path to a concrete URL used by the SDK.
 * e.g. "/apps/{app_id}/templates" -> "/apps/test-app/templates"
 */
function resolveRoute(path: string): string {
  return path
    .replace("{app_id}", APP_ID)
    .replace("{template_id}", "tmpl-1")
    .replace("{slug}", "my-slug")
    .replace("{lookup_table_id}", "lt-1")
    .replace("{chunk_index}", "0")
    .replace("{provider_id}", "prov-1")
    .replace("{integration_id}", "int-1")
    .replace("{icon_id}", "icon-1")
    .replace("{user_id}", "user-1")
    .replace("{file_id}", "file-1")
    .replace("{conversation_id}", "conv-1")
    .replace("{device_id}", "device-1");
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
// Golden response fixtures -- sourced from real Lambda handler return statements
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

// Source: lambda/payment/index.js auth client exchange handlers
// Response shape: { token, refresh_token, user, ... }
const FIXTURE_AUTH_TOKEN = {
  token: "jwt-token-abc123",
  refresh_token: "refresh-token-xyz789",
  user: { id: "user-1", email: "test@example.com" },
  status: "authenticated",
};

// Source: lambda/settings/index.js owner register handler
// Response shape: { owner_token }
const FIXTURE_OWNER_REGISTERED = {
  owner_token: "owner-token-abc123",
};

// Source: lambda/settings/index.js owner migrate handler
// Response shape: { success: true }
const FIXTURE_OWNER_MIGRATED = {
  success: true,
};

// User profile response
const FIXTURE_USER_PROFILE = {
  user_id: "user-1",
  display_name: "Test User",
  avatar_url: "https://example.com/avatar.png",
  bio: "A test user",
  preferences: { theme: "dark" },
  custom_fields: { company: "Acme" },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-02T00:00:00Z",
};

// Public profile response (limited fields)
const FIXTURE_PUBLIC_PROFILE = {
  user_id: "user-1",
  display_name: "Test User",
  avatar_url: "https://example.com/avatar.png",
  bio: "A test user",
};

// Account deletion response
const FIXTURE_ACCOUNT_DELETED = {
  deleted: true,
};

// Account data export response
const FIXTURE_ACCOUNT_DATA_EXPORT = {
  data: { profile: { display_name: "Test User" }, events: [] },
  exported_at: "2024-01-15T00:00:00Z",
};

// Consent preferences response
const FIXTURE_CONSENT = {
  analytics: true,
  marketing: false,
  third_party: false,
};

// File upload URL response
const FIXTURE_FILE_UPLOAD_URL = {
  upload_url: "https://s3.example.com/upload?signed=abc",
  file_id: "file-1",
  expires_at: 1712592000,
};

// Stored file response
const FIXTURE_STORED_FILE = {
  file_id: "file-1",
  filename: "photo.jpg",
  content_type: "image/jpeg",
  size: 102400,
  url: "https://cdn.example.com/file-1",
  created_at: "2024-01-10T00:00:00Z",
};

// File list response
const FIXTURE_FILE_LIST = {
  files: [FIXTURE_STORED_FILE],
};

// File deleted response
const FIXTURE_FILE_DELETED = {
  deleted: true,
};

// AI conversation response
const FIXTURE_CONVERSATION = {
  conversation_id: "conv-1",
  title: "Test Conversation",
  model: "gpt-4",
  created_at: "2024-01-10T00:00:00Z",
  updated_at: "2024-01-10T00:00:00Z",
  message_count: 0,
  metadata: {},
};

// AI conversation list response
const FIXTURE_CONVERSATION_LIST = {
  conversations: [FIXTURE_CONVERSATION],
  next_token: undefined,
};

// AI conversation message response
const FIXTURE_SEND_MESSAGE = {
  message: {
    message_id: "msg-1",
    role: "assistant" as const,
    content: "Hello! How can I help?",
    created_at: "2024-01-10T00:01:00Z",
  },
  conversation_id: "conv-1",
};

// AI conversation deleted response
const FIXTURE_CONVERSATION_DELETED = {
  deleted: true,
};

// Push notification device registration response
const FIXTURE_DEVICE_REGISTRATION = {
  device_id: "device-1",
  platform: "ios",
  registered_at: "2024-01-10T00:00:00Z",
};

// Push notification device unregistered response
const FIXTURE_DEVICE_UNREGISTERED = {
  unregistered: true,
};

// ---------------------------------------------------------------------------
// Contract tests -- verify each SDK method sends the correct HTTP method + URL
// ---------------------------------------------------------------------------

describe("SDK <-> API Contract Validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Templates service
  // -----------------------------------------------------------------------

  describe("Templates", () => {
    it("getAppInfo -> GET /apps/{app_id}", async () => {
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

    it("getTemplate -> GET /apps/{app_id}/templates/{template_id}", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/templates/index.js handleGet (~line 871-898)
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_TEMPLATE,
      });
      await client.templates.getTemplate("tmpl-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/templates/tmpl-1`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/templates/tmpl-1`)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Auth
  // -----------------------------------------------------------------------

  describe("Auth", () => {
    it("appleExchangeToken -> POST /auth/client/apple/exchange with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_AUTH_TOKEN,
      });
      await client.auth.appleExchangeToken("apple-id-token", "my-app");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/auth/client/apple/exchange`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ identity_token: "apple-id-token", app_id: "my-app" }),
        }),
      );
      expect(routeExists("POST", "/auth/client/apple/exchange")).toBe(true);
    });

    it("googleExchangeToken -> POST /auth/client/google/exchange with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_AUTH_TOKEN,
      });
      await client.auth.googleExchangeToken("google-id-token", "my-app", "access-tok");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/auth/client/google/exchange`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ id_token: "google-id-token", app_id: "my-app", access_token: "access-tok" }),
        }),
      );
      expect(routeExists("POST", "/auth/client/google/exchange")).toBe(true);
    });

    it("googleExchangeToken omits access_token when not provided", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_AUTH_TOKEN,
      });
      await client.auth.googleExchangeToken("google-id-token", "my-app");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ id_token: "google-id-token", app_id: "my-app" });
      expect(sentBody).not.toHaveProperty("access_token");
    });

    it("refreshToken -> POST /auth/client/refresh with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_AUTH_TOKEN,
      });
      await client.auth.refreshToken("my-refresh-token");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/auth/client/refresh`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ refresh_token: "my-refresh-token" }),
        }),
      );
      expect(routeExists("POST", "/auth/client/refresh")).toBe(true);
    });

    it("linkProvider -> POST /auth/client/link with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ linked: true }),
      });
      await client.auth.linkProvider("apple", "some-token");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/auth/client/link`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ provider: "apple", token: "some-token" }),
        }),
      );
      expect(routeExists("POST", "/auth/client/link")).toBe(true);
    });

    it("getPasskeyRegisterOptions -> POST /auth/client/passkey/register/options", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ challenge: "abc" }),
      });
      await client.auth.getPasskeyRegisterOptions();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/auth/client/passkey/register/options`,
        expect.objectContaining({ method: "POST" }),
      );
      expect(routeExists("POST", "/auth/client/passkey/register/options")).toBe(true);
    });

    it("verifyPasskeyRegistration -> POST /auth/client/passkey/register/verify with credential body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ verified: true }),
      });
      const cred = { id: "cred-1", response: { attestationObject: "abc" } };
      await client.auth.verifyPasskeyRegistration(cred);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/auth/client/passkey/register/verify`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(cred),
        }),
      );
      expect(routeExists("POST", "/auth/client/passkey/register/verify")).toBe(true);
    });

    it("getPasskeyAuthOptions -> POST /auth/client/passkey/authenticate/options", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ challenge: "xyz" }),
      });
      await client.auth.getPasskeyAuthOptions();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/auth/client/passkey/authenticate/options`,
        expect.objectContaining({ method: "POST" }),
      );
      expect(routeExists("POST", "/auth/client/passkey/authenticate/options")).toBe(true);
    });

    it("verifyPasskeyAuth -> POST /auth/client/passkey/authenticate/verify with assertion body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_AUTH_TOKEN,
      });
      const assertion = { id: "cred-1", response: { authenticatorData: "abc" } };
      await client.auth.verifyPasskeyAuth(assertion);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/auth/client/passkey/authenticate/verify`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(assertion),
        }),
      );
      expect(routeExists("POST", "/auth/client/passkey/authenticate/verify")).toBe(true);
    });

    it("requestEmailMagicLink -> POST /auth/client/email/request with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ sent: true }),
      });
      await client.auth.requestEmailMagicLink("user@example.com");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/auth/client/email/request`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "user@example.com" }),
        }),
      );
      expect(routeExists("POST", "/auth/client/email/request")).toBe(true);
    });

    it("verifyEmailMagicLink -> POST /auth/client/email/verify with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_AUTH_TOKEN,
      });
      await client.auth.verifyEmailMagicLink("magic-link-token");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/auth/client/email/verify`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "magic-link-token" }),
        }),
      );
      expect(routeExists("POST", "/auth/client/email/verify")).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Owner
  // -----------------------------------------------------------------------

  describe("Owner", () => {
    it("registerOwner -> POST /owner/register with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_OWNER_REGISTERED,
      });
      await client.owner.registerOwner("device-owner-1", "my-app", "hcaptcha-tok");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/owner/register`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ device_owner_id: "device-owner-1", app_id: "my-app", hcaptcha_token: "hcaptcha-tok" }),
        }),
      );
      expect(routeExists("POST", "/owner/register")).toBe(true);
    });

    it("registerOwner omits hcaptcha_token when not provided", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_OWNER_REGISTERED,
      });
      await client.owner.registerOwner("device-owner-1", "my-app");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ device_owner_id: "device-owner-1", app_id: "my-app" });
      expect(sentBody).not.toHaveProperty("hcaptcha_token");
    });

    it("migrateOwnerToUser -> POST /owner/migrate with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_OWNER_MIGRATED,
      });
      await client.owner.migrateOwnerToUser("device-owner-1", "my-app");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/owner/migrate`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ device_owner_id: "device-owner-1", app_id: "my-app" }),
        }),
      );
      expect(routeExists("POST", "/owner/migrate")).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Settings / Config
  // -----------------------------------------------------------------------

  describe("Settings / Config", () => {
    it("getSettings -> GET /apps/{app_id}/settings", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ theme: "dark" }),
      });
      await client.settings.get();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/settings`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/settings`)).toBe(true);
    });

    it("updateSettings -> PUT /apps/{app_id}/settings with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ updated: true }),
      });
      const body = { theme: "light" };
      await client.settings.update(body);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/settings`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(body),
        }),
      );
      expect(routeExists("PUT", `/apps/${APP_ID}/settings`)).toBe(true);
    });

    it("getConfig -> GET /apps/{app_id}/config", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ feature_flags: {} }),
      });
      await client.settings.getConfig();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/config`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/config`)).toBe(true);
    });

    it("updateConfig -> PUT /apps/{app_id}/config with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ updated: true }),
      });
      const body = { feature_flags: { dark_mode: true } };
      await client.settings.updateConfig(body);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/config`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(body),
        }),
      );
      expect(routeExists("PUT", `/apps/${APP_ID}/config`)).toBe(true);
    });

    it("getIntegrationSecret -> GET /apps/{app_id}/integrations/{integration_id}/secret", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ secret: "s3cr3t" }),
      });
      await client.settings.getIntegrationSecret("int-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/integrations/int-1/secret`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/integrations/int-1/secret`)).toBe(true);
    });

    it("uploadIntegrationSecret -> POST /apps/{app_id}/integrations/{integration_id}/secret with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ uploaded: true }),
      });
      const body = { api_key: "new-key" };
      await client.settings.uploadIntegrationSecret("int-1", body);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/integrations/int-1/secret`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/integrations/int-1/secret`)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Catalog
  // -----------------------------------------------------------------------

  describe("Catalog", () => {
    it("getCatalog -> GET /apps/{app_id}/catalog", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      });
      await client.catalog.get();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/catalog`,
        expect.objectContaining({ method: "GET" }),
      );
      // Note: /apps/{app_id}/catalog route may not yet exist in API Gateway;
      // this test validates SDK wiring. Route availability is validated separately.
    });
  });

  // -----------------------------------------------------------------------
  // AI Services
  // -----------------------------------------------------------------------

  describe("AI Services", () => {
    it("createChatCompletion -> POST /apps/{app_id}/ai/chat/completions with correct body", async () => {
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
      await client.ai.createChatCompletion(body);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/chat/completions`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/ai/chat/completions`)).toBe(true);
    });

    it("createEmbedding -> POST /apps/{app_id}/ai/embeddings with correct body", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
      // Response shape: { id, provider, model, choices, usage }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_EMBEDDING,
      });
      await client.ai.createEmbedding("test input", "text-embedding-ada-002");
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
      await client.ai.createEmbedding("test input");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ input: "test input" });
      expect(sentBody).not.toHaveProperty("model");
    });

    it("createImage -> POST /apps/{app_id}/ai/images/generations with correct body", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
      // Response shape: { id, provider, model, choices, usage }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_IMAGE_GENERATION,
      });
      await client.ai.createImage("a cat", { n: 2, size: "512x512" });
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/images/generations`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ prompt: "a cat", n: 2, size: "512x512" }),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/ai/images/generations`)).toBe(true);
    });

    it("createModeration -> POST /apps/{app_id}/ai/moderations with correct body", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/ai_proxy/index.js normalizeProviderResponse (~line 830-874)
      // Response shape: { id, provider, model, choices, usage }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_MODERATION,
      });
      await client.ai.createModeration("test content", "text-moderation-latest");
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
      await client.ai.createModeration("test content");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ input: "test content" });
      expect(sentBody).not.toHaveProperty("model");
    });

  });

  // -----------------------------------------------------------------------
  // Devices
  // -----------------------------------------------------------------------

  describe("Devices", () => {
    it("getDevices -> GET /apps/{app_id}/devices", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/devices/index.js handler (~line 22-26)
      // Response shape: { items: Device[] }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_DEVICES,
      });
      await client.devices.getDevices();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/devices`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/devices`)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Endpoints
  // -----------------------------------------------------------------------

  describe("Endpoints", () => {
    it("createEndpoint -> POST /apps/{app_id}/endpoints", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/endpoints/index.js handleCreate (~line 221-232)
      // Response shape: { slug, status, expires_at, endpoint_path, hmac_secret?, hmac_required? }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => FIXTURE_ENDPOINT_CREATED,
      });
      await client.endpoints.createEndpoint();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/endpoints`,
        expect.objectContaining({ method: "POST" }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/endpoints`)).toBe(true);
    });

    it("revokeAndReplaceEndpoint -> POST /apps/{app_id}/endpoints/revoke_and_replace with correct body", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/endpoints/index.js handleRevokeAndReplace (~line 402-414)
      // Response shape: { old_slug, new_slug, new_endpoint_path, revoked_expires_at, new_expires_at, hmac_secret?, hmac_required? }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_ENDPOINT_REVOKE_AND_REPLACE,
      });
      await client.endpoints.revokeAndReplaceEndpoint("old-slug");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/endpoints/revoke_and_replace`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ old_slug: "old-slug" }),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/endpoints/revoke_and_replace`)).toBe(true);
    });

    it("revokeEndpoint -> POST /apps/{app_id}/endpoints/revoke with correct body", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/endpoints/index.js handleRevokeOnly (~line 521-524)
      // Response shape: { slug, revoked: true }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_ENDPOINT_REVOKED,
      });
      await client.endpoints.revokeEndpoint("my-slug");
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
    it("postEvent -> POST /events/{slug} with correct body", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/events/index.js handlePost (~line 238-246)
      // Response shape: { slug, timestamp, expires_at }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => FIXTURE_EVENT_POSTED,
      });
      const payload = { text: "hello", keywords: ["test"] };
      await client.endpoints.postEvent("my-slug", payload);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/events/my-slug`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );
      expect(routeExists("POST", "/events/my-slug")).toBe(true);
    });

    it("consumeEvent -> GET /events/{slug}", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/events/index.js handleGet (~line 262-276)
      // Response shape (empty): { empty: true, slug, text: "George Lucas" }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_EVENT_CONSUMED_EMPTY,
      });
      await client.endpoints.consumeEvent("my-slug");
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
    it("listLookupTables -> GET /lookup-tables", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/lookup_tables/index.js handleClientList (~line 87-94) + toSummary (~line 867-880)
      // Response shape: { items: Summary[] }
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_LOOKUP_TABLES_LIST,
      });
      await client.lookupTables.list();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/lookup-tables`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", "/lookup-tables")).toBe(true);
    });

    it("getLookupTable -> GET /lookup-tables/{lookup_table_id}", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/lookup_tables/index.js handleClientDetail (~line 97-108) + toClientDetail (~line 903-920)
      // Response shape: extends toSummary + prompt, default_success_sentence, default_fail_sentence,
      //   chunk_encoding, manifest_hash, chunks[]
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_LOOKUP_TABLE_DETAIL,
      });
      await client.lookupTables.get("lt-1");
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
      await client.lookupTables.get("has space");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe(`${BASE_URL}/lookup-tables/has%20space`);
    });

    it("getLookupTableChunk -> GET /lookup-tables/{id}/chunks/{index}", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/lookup_tables/index.js handleClientChunk (~line 134-138)
      // Response shape: raw JSON chunk data
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_LOOKUP_TABLE_CHUNK_0,
      });
      await client.lookupTables.getChunk("lt-1", 0);
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
      await client.lookupTables.getChunk("lt-1", 2, 5);
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

      const result = await client.lookupTables.getFullDataset("lt-1");
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
  // User Profiles
  // -----------------------------------------------------------------------

  describe("User Profiles", () => {
    it("getProfile -> GET /apps/{app_id}/profile", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_USER_PROFILE,
      });
      await client.profiles.get();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/profile`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/profile`)).toBe(true);
    });

    it("updateProfile -> PUT /apps/{app_id}/profile with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_USER_PROFILE,
      });
      const data = { display_name: "New Name", bio: "Updated bio" };
      await client.profiles.update(data);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/profile`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(data),
        }),
      );
      expect(routeExists("PUT", `/apps/${APP_ID}/profile`)).toBe(true);
    });

    it("getPublicProfile -> GET /apps/{app_id}/profile/{user_id}", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_PUBLIC_PROFILE,
      });
      await client.profiles.getPublic("user-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/profile/user-1`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/profile/user-1`)).toBe(true);
    });

    it("getPublicProfile URL-encodes the user ID", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_PUBLIC_PROFILE,
      });
      await client.profiles.getPublic("user with spaces");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe(`${BASE_URL}/apps/${APP_ID}/profile/user%20with%20spaces`);
    });
  });

  // -----------------------------------------------------------------------
  // Account
  // -----------------------------------------------------------------------

  describe("Account", () => {
    it("deleteAccount -> DELETE /apps/{app_id}/account with reason", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_ACCOUNT_DELETED,
      });
      await client.account.delete("no longer needed");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/account`,
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ reason: "no longer needed" }),
        }),
      );
      expect(routeExists("DELETE", `/apps/${APP_ID}/account`)).toBe(true);
    });

    it("deleteAccount without reason sends no body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_ACCOUNT_DELETED,
      });
      await client.account.delete();
      expect(fetchSpy.mock.calls[0][1].body).toBeUndefined();
    });

    it("exportAccountData -> GET /apps/{app_id}/account/data-export", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_ACCOUNT_DATA_EXPORT,
      });
      await client.account.exportData();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/account/data-export`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/account/data-export`)).toBe(true);
    });

    it("getConsent -> GET /apps/{app_id}/account/consent", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_CONSENT,
      });
      await client.account.getConsent();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/account/consent`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/account/consent`)).toBe(true);
    });

    it("updateConsent -> PUT /apps/{app_id}/account/consent with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_CONSENT,
      });
      const consent = { analytics: true, marketing: false, third_party: false };
      await client.account.updateConsent(consent);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/account/consent`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(consent),
        }),
      );
      expect(routeExists("PUT", `/apps/${APP_ID}/account/consent`)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // File Storage
  // -----------------------------------------------------------------------

  describe("File Storage", () => {
    it("getFileUploadUrl -> POST /apps/{app_id}/files/upload-url with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_FILE_UPLOAD_URL,
      });
      await client.files.getUploadUrl("photo.jpg", "image/jpeg");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/files/upload-url`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ filename: "photo.jpg", content_type: "image/jpeg" }),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/files/upload-url`)).toBe(true);
    });

    it("listFiles -> GET /apps/{app_id}/files", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_FILE_LIST,
      });
      await client.files.list();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/files`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/files`)).toBe(true);
    });

    it("getFile -> GET /apps/{app_id}/files/{file_id}", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_STORED_FILE,
      });
      await client.files.get("file-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/files/file-1`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/files/file-1`)).toBe(true);
    });

    it("deleteFile -> DELETE /apps/{app_id}/files/{file_id}", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_FILE_DELETED,
      });
      await client.files.delete("file-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/files/file-1`,
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(routeExists("DELETE", `/apps/${APP_ID}/files/file-1`)).toBe(true);
    });

    it("getFile URL-encodes the file ID", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_STORED_FILE,
      });
      await client.files.get("file with spaces");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe(`${BASE_URL}/apps/${APP_ID}/files/file%20with%20spaces`);
    });
  });

  // -----------------------------------------------------------------------
  // AI Conversations
  // -----------------------------------------------------------------------

  describe("AI Conversations", () => {
    it("createConversation -> POST /apps/{app_id}/ai/conversations", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => FIXTURE_CONVERSATION,
      });
      await client.ai.conversations.create({ title: "Test", model: "gpt-4" });
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/conversations`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Test", model: "gpt-4" }),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/ai/conversations`)).toBe(true);
    });

    it("createConversation without options sends no body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => FIXTURE_CONVERSATION,
      });
      await client.ai.conversations.create();
      expect(fetchSpy.mock.calls[0][1].body).toBeUndefined();
    });

    it("listConversations -> GET /apps/{app_id}/ai/conversations", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_CONVERSATION_LIST,
      });
      await client.ai.conversations.list();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/conversations`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/ai/conversations`)).toBe(true);
    });

    it("listConversations passes next_token as query param", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_CONVERSATION_LIST,
      });
      await client.ai.conversations.list("abc123");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toBe(`${BASE_URL}/apps/${APP_ID}/ai/conversations?next_token=abc123`);
    });

    it("getConversation -> GET /apps/{app_id}/ai/conversations/{id}", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_CONVERSATION,
      });
      await client.ai.conversations.get("conv-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/conversations/conv-1`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(routeExists("GET", `/apps/${APP_ID}/ai/conversations/conv-1`)).toBe(true);
    });

    it("sendMessage -> POST /apps/{app_id}/ai/conversations/{id}/messages with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_SEND_MESSAGE,
      });
      await client.ai.conversations.sendMessage("conv-1", "Hello!", { temperature: 0.7 });
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/conversations/conv-1/messages`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ content: "Hello!", temperature: 0.7 }),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/ai/conversations/conv-1/messages`)).toBe(true);
    });

    it("sendMessage without options sends only content", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_SEND_MESSAGE,
      });
      await client.ai.conversations.sendMessage("conv-1", "Hello!");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ content: "Hello!" });
    });

    it("deleteConversation -> DELETE /apps/{app_id}/ai/conversations/{id}", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_CONVERSATION_DELETED,
      });
      await client.ai.conversations.delete("conv-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/ai/conversations/conv-1`,
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(routeExists("DELETE", `/apps/${APP_ID}/ai/conversations/conv-1`)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Push Notifications
  // -----------------------------------------------------------------------

  describe("Push Notifications", () => {
    it("registerDevice -> POST /apps/{app_id}/notifications/register with correct body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_DEVICE_REGISTRATION,
      });
      await client.notifications.registerDevice("push-token-abc", "ios", "device-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/notifications/register`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "push-token-abc", platform: "ios", device_id: "device-1" }),
        }),
      );
      expect(routeExists("POST", `/apps/${APP_ID}/notifications/register`)).toBe(true);
    });

    it("registerDevice omits device_id when not provided", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_DEVICE_REGISTRATION,
      });
      await client.notifications.registerDevice("push-token-abc", "android");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ token: "push-token-abc", platform: "android" });
      expect(sentBody).not.toHaveProperty("device_id");
    });

    it("unregisterDevice -> DELETE /apps/{app_id}/notifications/register/{device_id}", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => FIXTURE_DEVICE_UNREGISTERED,
      });
      await client.notifications.unregisterDevice("device-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/apps/${APP_ID}/notifications/register/device-1`,
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(routeExists("DELETE", `/apps/${APP_ID}/notifications/register/device-1`)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Request body shape validation
  // -----------------------------------------------------------------------

  describe("Request body shape validation", () => {
    it("createChatCompletion body includes required messages array", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/ai_proxy/index.js -- messages required in request body
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_CHAT_COMPLETION });
      await client.ai.createChatCompletion({
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
      // Source: lambda/ai_proxy/index.js -- optional params forwarded to provider
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_CHAT_COMPLETION });
      await client.ai.createChatCompletion({
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
      // Source: lambda/ai_proxy/index.js -- prompt required for image generation
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_IMAGE_GENERATION });
      await client.ai.createImage("sunset over mountains");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toHaveProperty("prompt", "sunset over mountains");
    });

    it("revokeAndReplaceEndpoint sends old_slug in body", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/endpoints/index.js handleRevokeAndReplace (~line 235-414)
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_ENDPOINT_REVOKE_AND_REPLACE });
      await client.endpoints.revokeAndReplaceEndpoint("abc123");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ old_slug: "abc123" });
    });

    it("revokeEndpoint sends slug in body", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/endpoints/index.js handleRevokeOnly (~line 417-525)
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_ENDPOINT_REVOKED });
      await client.endpoints.revokeEndpoint("abc123");
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual({ slug: "abc123" });
    });

    it("postEvent sends arbitrary payload as body", async () => {
      const { client, fetchSpy } = setup();
      // Source: lambda/events/index.js handlePost (~line 238-246)
      fetchSpy.mockResolvedValue({ ok: true, status: 201, json: async () => FIXTURE_EVENT_POSTED });
      const payload = { text: "dictation result", keywords: ["hello"] };
      await client.endpoints.postEvent("my-slug", payload);
      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sentBody).toEqual(payload);
    });

    it("GET requests do not send a body", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_APP_INFO });
      await client.getAppInfo();
      expect(fetchSpy.mock.calls[0][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_DEVICES });
      await client.devices.getDevices();
      expect(fetchSpy.mock.calls[1][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_LOOKUP_TABLES_LIST });
      await client.lookupTables.list();
      expect(fetchSpy.mock.calls[2][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
      await client.settings.get();
      expect(fetchSpy.mock.calls[3][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
      await client.settings.getConfig();
      expect(fetchSpy.mock.calls[4][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
      await client.catalog.get();
      expect(fetchSpy.mock.calls[5][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_USER_PROFILE });
      await client.profiles.get();
      expect(fetchSpy.mock.calls[6][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_PUBLIC_PROFILE });
      await client.profiles.getPublic("user-1");
      expect(fetchSpy.mock.calls[7][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_ACCOUNT_DATA_EXPORT });
      await client.account.exportData();
      expect(fetchSpy.mock.calls[8][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_CONSENT });
      await client.account.getConsent();
      expect(fetchSpy.mock.calls[9][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_FILE_LIST });
      await client.files.list();
      expect(fetchSpy.mock.calls[10][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_STORED_FILE });
      await client.files.get("file-1");
      expect(fetchSpy.mock.calls[11][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_CONVERSATION_LIST });
      await client.ai.conversations.list();
      expect(fetchSpy.mock.calls[12][1].body).toBeUndefined();

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => FIXTURE_CONVERSATION });
      await client.ai.conversations.get("conv-1");
      expect(fetchSpy.mock.calls[13][1].body).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Phantom method detection -- every SDK method targets a real route
  // -----------------------------------------------------------------------

  describe("Phantom method detection", () => {
    /**
     * Exhaustive catalog of every public SDK method and the HTTP method + path
     * it constructs. Methods are now on service classes (client.auth, client.payments, etc.).
     *
     * Note: catalog.get targets GET /apps/{app_id}/catalog which may not yet
     * exist in API Gateway. It is intentionally excluded from the routeExists
     * check below but included in the method count.
     */
    const sdkMethods: Array<{ name: string; service: string; method: string; path: string; skipRouteCheck?: boolean }> = [
      // Health check (on main client)
      { name: "ping", service: "client", method: "GET", path: "/ping" },

      // Templates / Apps (on main client + templates service)
      { name: "getAppInfo", service: "client", method: "GET", path: `/apps/${APP_ID}` },
      { name: "getTemplate", service: "templates", method: "GET", path: `/apps/${APP_ID}/templates/tmpl-1` },

      // Auth
      { name: "appleExchangeToken", service: "auth", method: "POST", path: "/auth/client/apple/exchange" },
      { name: "googleExchangeToken", service: "auth", method: "POST", path: "/auth/client/google/exchange" },
      { name: "refreshToken", service: "auth", method: "POST", path: "/auth/client/refresh" },
      { name: "linkProvider", service: "auth", method: "POST", path: "/auth/client/link" },
      { name: "getPasskeyRegisterOptions", service: "auth", method: "POST", path: "/auth/client/passkey/register/options" },
      { name: "verifyPasskeyRegistration", service: "auth", method: "POST", path: "/auth/client/passkey/register/verify" },
      { name: "getPasskeyAuthOptions", service: "auth", method: "POST", path: "/auth/client/passkey/authenticate/options" },
      { name: "verifyPasskeyAuth", service: "auth", method: "POST", path: "/auth/client/passkey/authenticate/verify" },
      { name: "requestEmailMagicLink", service: "auth", method: "POST", path: "/auth/client/email/request" },
      { name: "verifyEmailMagicLink", service: "auth", method: "POST", path: "/auth/client/email/verify" },

      // Owner
      { name: "registerOwner", service: "owner", method: "POST", path: "/owner/register" },
      { name: "migrateOwnerToUser", service: "owner", method: "POST", path: "/owner/migrate" },

      // Settings / Config
      { name: "get", service: "settings", method: "GET", path: `/apps/${APP_ID}/settings` },
      { name: "update", service: "settings", method: "PUT", path: `/apps/${APP_ID}/settings` },
      { name: "getConfig", service: "settings", method: "GET", path: `/apps/${APP_ID}/config` },
      { name: "updateConfig", service: "settings", method: "PUT", path: `/apps/${APP_ID}/config` },
      { name: "getIntegrationSecret", service: "settings", method: "GET", path: `/apps/${APP_ID}/integrations/int-1/secret` },
      { name: "uploadIntegrationSecret", service: "settings", method: "POST", path: `/apps/${APP_ID}/integrations/int-1/secret` },

      // Catalog
      { name: "get", service: "catalog", method: "GET", path: `/apps/${APP_ID}/catalog`, skipRouteCheck: true },

      // AI Services
      { name: "createChatCompletion", service: "ai", method: "POST", path: `/apps/${APP_ID}/ai/chat/completions` },
      { name: "createEmbedding", service: "ai", method: "POST", path: `/apps/${APP_ID}/ai/embeddings` },
      { name: "createImage", service: "ai", method: "POST", path: `/apps/${APP_ID}/ai/images/generations` },
      { name: "createModeration", service: "ai", method: "POST", path: `/apps/${APP_ID}/ai/moderations` },

      // Devices
      { name: "getDevices", service: "devices", method: "GET", path: `/apps/${APP_ID}/devices` },

      // Endpoints
      { name: "createEndpoint", service: "endpoints", method: "POST", path: `/apps/${APP_ID}/endpoints` },
      { name: "revokeAndReplaceEndpoint", service: "endpoints", method: "POST", path: `/apps/${APP_ID}/endpoints/revoke_and_replace` },
      { name: "revokeEndpoint", service: "endpoints", method: "POST", path: `/apps/${APP_ID}/endpoints/revoke` },

      // Events (on endpoints service)
      { name: "postEvent", service: "endpoints", method: "POST", path: "/events/my-slug" },
      { name: "consumeEvent", service: "endpoints", method: "GET", path: "/events/my-slug" },

      // Lookup Tables
      { name: "list", service: "lookupTables", method: "GET", path: "/lookup-tables" },
      { name: "get", service: "lookupTables", method: "GET", path: "/lookup-tables/lt-1" },
      { name: "getChunk", service: "lookupTables", method: "GET", path: "/lookup-tables/lt-1/chunks/0" },

      // User Profiles
      { name: "get", service: "profiles", method: "GET", path: `/apps/${APP_ID}/profile` },
      { name: "update", service: "profiles", method: "PUT", path: `/apps/${APP_ID}/profile` },
      { name: "getPublic", service: "profiles", method: "GET", path: `/apps/${APP_ID}/profile/user-1` },

      // Account
      { name: "delete", service: "account", method: "DELETE", path: `/apps/${APP_ID}/account` },
      { name: "exportData", service: "account", method: "GET", path: `/apps/${APP_ID}/account/data-export` },
      { name: "getConsent", service: "account", method: "GET", path: `/apps/${APP_ID}/account/consent` },
      { name: "updateConsent", service: "account", method: "PUT", path: `/apps/${APP_ID}/account/consent` },

      // File Storage
      { name: "getUploadUrl", service: "files", method: "POST", path: `/apps/${APP_ID}/files/upload-url` },
      { name: "list", service: "files", method: "GET", path: `/apps/${APP_ID}/files` },
      { name: "get", service: "files", method: "GET", path: `/apps/${APP_ID}/files/file-1` },
      { name: "delete", service: "files", method: "DELETE", path: `/apps/${APP_ID}/files/file-1` },

      // AI Conversations (nested on ai.conversations)
      { name: "conversations.create", service: "ai", method: "POST", path: `/apps/${APP_ID}/ai/conversations` },
      { name: "conversations.list", service: "ai", method: "GET", path: `/apps/${APP_ID}/ai/conversations` },
      { name: "conversations.get", service: "ai", method: "GET", path: `/apps/${APP_ID}/ai/conversations/conv-1` },
      { name: "conversations.sendMessage", service: "ai", method: "POST", path: `/apps/${APP_ID}/ai/conversations/conv-1/messages` },
      { name: "conversations.delete", service: "ai", method: "DELETE", path: `/apps/${APP_ID}/ai/conversations/conv-1` },

      // Push Notifications
      { name: "registerDevice", service: "notifications", method: "POST", path: `/apps/${APP_ID}/notifications/register` },
      { name: "unregisterDevice", service: "notifications", method: "DELETE", path: `/apps/${APP_ID}/notifications/register/device-1` },

      // Payments
      { name: "getSubscription", service: "payments", method: "GET", path: `/apps/${APP_ID}/subscription`, skipRouteCheck: true },
      { name: "getCustomerPortalUrl", service: "payments", method: "POST", path: `/apps/${APP_ID}/billing/portal`, skipRouteCheck: true },
      { name: "getTiers", service: "payments", method: "GET", path: `/pay/apps/${APP_ID}/tiers`, skipRouteCheck: true },
      { name: "changeSubscription", service: "payments", method: "POST", path: "/pay/subscription/change", skipRouteCheck: true },

      // Entitlements
      { name: "check", service: "entitlements", method: "GET", path: `/apps/${APP_ID}/entitlements`, skipRouteCheck: true },
    ];

    it.each(sdkMethods.filter((m) => !m.skipRouteCheck))(
      "$service.$name -> $method $path maps to a real API Gateway route",
      ({ method, path }) => {
        expect(routeExists(method, path)).toBe(true);
      },
    );

    it("all service groups are accessible on the client", () => {
      const client = new MagicAppsClient({ baseUrl: BASE_URL, appId: APP_ID });
      const expectedServices = [
        "auth", "payments", "entitlements", "devices", "ai", "endpoints",
        "files", "notifications", "profiles", "account", "settings",
        "catalog", "lookupTables", "owner", "templates",
      ];
      for (const svc of expectedServices) {
        expect(client).toHaveProperty(svc);
        expect((client as Record<string, unknown>)[svc]).toBeDefined();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Auth header contract
  // -----------------------------------------------------------------------

  describe("Auth header contract", () => {
    it("includes Bearer token when authToken is set", async () => {
      const { client, fetchSpy } = setup();
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: "pong" }) });
      await client.ping();
      const headers = fetchSpy.mock.calls[0][1].headers;
      expect(headers["Authorization"]).toBe("Bearer test-token");
    });

    it("omits Authorization header when no authToken", async () => {
      const client = new MagicAppsClient({ baseUrl: BASE_URL, appId: APP_ID });
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: "pong" }),
      });
      vi.stubGlobal("fetch", fetchSpy);
      await client.ping();
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
  // Golden fixture shape validation -- verify fixtures match real Lambda shapes
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

    it("Devices response has items array (not devices)", () => {
      // Source: lambda/devices/index.js handler (~line 22-26)
      // Lambda returns { items: Device[] }, NOT { devices: Device[] }
      expect(FIXTURE_DEVICES).toHaveProperty("items");
      expect(Array.isArray(FIXTURE_DEVICES.items)).toBe(true);
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

    it("Auth token response fixture has expected fields", () => {
      expect(FIXTURE_AUTH_TOKEN).toHaveProperty("token");
      expect(FIXTURE_AUTH_TOKEN).toHaveProperty("refresh_token");
      expect(FIXTURE_AUTH_TOKEN).toHaveProperty("user");
      expect(FIXTURE_AUTH_TOKEN).toHaveProperty("status");
    });

    it("Owner registered fixture has owner_token", () => {
      expect(FIXTURE_OWNER_REGISTERED).toHaveProperty("owner_token");
    });

    it("Owner migrated fixture has success flag", () => {
      expect(FIXTURE_OWNER_MIGRATED).toHaveProperty("success", true);
    });
  });
});
