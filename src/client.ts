import type {
  MagicAppsConfig,
  AppInfo,
  ApiResponse,
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingResponse,
  ImageGenerationResponse,
  ModerationResponse,
  AiUsageSummary,
  AiUsageResponse,
  AiUsageOptions,
  Device,
  DeviceCatalogResponse,
  AuthTokenResponse,
} from "./types.js";
import { ApiError, MagicAppsError } from "./errors.js";

const DEFAULT_TIMEOUT = 30_000;

/** MagicApps API client for TypeScript/JavaScript applications. */
export class MagicAppsClient {
  private readonly baseUrl: string;
  private readonly appId: string;
  private authToken: string | undefined;
  private readonly timeout: number;

  constructor(config: MagicAppsConfig) {
    if (!config.baseUrl) {
      throw new MagicAppsError("baseUrl is required");
    }
    if (!config.appId) {
      throw new MagicAppsError("appId is required");
    }

    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.appId = config.appId;
    this.authToken = config.authToken;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  /** Update the auth token (e.g. after login or token refresh). */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /** Get information about the current application. */
  async getAppInfo(): Promise<ApiResponse<AppInfo>> {
    return this.request<AppInfo>("GET", `/apps/${this.appId}`);
  }

  /** Get a specific template by ID. */
  async getTemplate(templateId: string): Promise<ApiResponse<any>> {
    return this.request(
      "GET",
      `/apps/${this.appId}/templates/${templateId}`,
    );
  }

  // --- Auth ---

  /** Exchange an Apple identity token for MagicApps auth tokens. */
  async appleExchangeToken(
    identityToken: string,
    appId: string,
  ): Promise<ApiResponse<AuthTokenResponse>> {
    return this.request<AuthTokenResponse>(
      "POST",
      "/auth/client/apple/exchange",
      { identity_token: identityToken, app_id: appId },
    );
  }

  /** Exchange a Google ID token for MagicApps auth tokens. */
  async googleExchangeToken(
    idToken: string,
    appId: string,
    accessToken?: string,
  ): Promise<ApiResponse<AuthTokenResponse>> {
    return this.request<AuthTokenResponse>(
      "POST",
      "/auth/client/google/exchange",
      { id_token: idToken, app_id: appId, ...(accessToken ? { access_token: accessToken } : {}) },
    );
  }

  /** Refresh an expired auth token using a refresh token. */
  async refreshToken(
    refreshToken: string,
  ): Promise<ApiResponse<AuthTokenResponse>> {
    return this.request<AuthTokenResponse>(
      "POST",
      "/auth/client/refresh",
      { refresh_token: refreshToken },
    );
  }

  /** Link an external provider account to the current user. */
  async linkProvider(
    provider: string,
    token: string,
  ): Promise<ApiResponse<any>> {
    return this.request(
      "POST",
      "/auth/client/link",
      { provider, token },
    );
  }

  /** Get passkey registration options (WebAuthn). */
  async getPasskeyRegisterOptions(): Promise<ApiResponse<any>> {
    return this.request("POST", "/auth/client/passkey/register/options");
  }

  /** Verify a passkey registration credential (WebAuthn). */
  async verifyPasskeyRegistration(
    credential: any,
  ): Promise<ApiResponse<any>> {
    return this.request(
      "POST",
      "/auth/client/passkey/register/verify",
      credential,
    );
  }

  /** Get passkey authentication options (WebAuthn). */
  async getPasskeyAuthOptions(): Promise<ApiResponse<any>> {
    return this.request("POST", "/auth/client/passkey/authenticate/options");
  }

  /** Verify a passkey authentication assertion (WebAuthn). */
  async verifyPasskeyAuth(
    assertion: any,
  ): Promise<ApiResponse<any>> {
    return this.request(
      "POST",
      "/auth/client/passkey/authenticate/verify",
      assertion,
    );
  }

  /** Request an email magic link for passwordless login. */
  async requestEmailMagicLink(
    email: string,
  ): Promise<ApiResponse<any>> {
    return this.request(
      "POST",
      "/auth/client/email/request",
      { email },
    );
  }

  /** Verify an email magic link token. */
  async verifyEmailMagicLink(
    token: string,
  ): Promise<ApiResponse<any>> {
    return this.request(
      "POST",
      "/auth/client/email/verify",
      { token },
    );
  }

  // --- Owner ---

  /** Register a device owner for the given app. */
  async registerOwner(
    deviceOwnerId: string,
    appId: string,
    hcaptchaToken?: string,
  ): Promise<ApiResponse<{ owner_token: string }>> {
    return this.request(
      "POST",
      "/owner/register",
      { device_owner_id: deviceOwnerId, app_id: appId, ...(hcaptchaToken ? { hcaptcha_token: hcaptchaToken } : {}) },
    );
  }

  /** Migrate a device owner to a full user account. */
  async migrateOwnerToUser(
    deviceOwnerId: string,
    appId: string,
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(
      "POST",
      "/owner/migrate",
      { device_owner_id: deviceOwnerId, app_id: appId },
    );
  }

  // --- Settings / Config ---

  /** Get the settings for the current app. */
  async getSettings(): Promise<ApiResponse<any>> {
    return this.request("GET", `/apps/${this.appId}/settings`);
  }

  /** Update the settings for the current app. */
  async updateSettings(
    body: Record<string, any>,
  ): Promise<ApiResponse<any>> {
    return this.request("PUT", `/apps/${this.appId}/settings`, body);
  }

  /** Get the config for the current app. */
  async getConfig(): Promise<ApiResponse<any>> {
    return this.request("GET", `/apps/${this.appId}/config`);
  }

  /** Update the config for the current app. */
  async updateConfig(
    body: Record<string, any>,
  ): Promise<ApiResponse<any>> {
    return this.request("PUT", `/apps/${this.appId}/config`, body);
  }

  /** Get the secret for a specific integration. */
  async getIntegrationSecret(
    integrationId: string,
  ): Promise<ApiResponse<any>> {
    return this.request(
      "GET",
      `/apps/${this.appId}/integrations/${encodeURIComponent(integrationId)}/secret`,
    );
  }

  /** Upload or update the secret for a specific integration. */
  async uploadIntegrationSecret(
    integrationId: string,
    body: Record<string, any>,
  ): Promise<ApiResponse<any>> {
    return this.request(
      "POST",
      `/apps/${this.appId}/integrations/${encodeURIComponent(integrationId)}/secret`,
      body,
    );
  }

  // --- Catalog ---

  /** Get the catalog for the current app. */
  async getCatalog(): Promise<ApiResponse<any>> {
    return this.request("GET", `/apps/${this.appId}/catalog`);
  }

  // --- AI Services ---

  /** Create a chat completion via the AI proxy (OpenAI-compatible format). */
  async createChatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ApiResponse<ChatCompletionResponse>> {
    return this.request<ChatCompletionResponse>(
      "POST",
      `/apps/${this.appId}/ai/chat/completions`,
      request,
    );
  }

  /** Generate embeddings for the given input text. */
  async createEmbedding(
    input: string,
    model?: string,
  ): Promise<ApiResponse<EmbeddingResponse>> {
    return this.request<EmbeddingResponse>(
      "POST",
      `/apps/${this.appId}/ai/embeddings`,
      { input, ...(model ? { model } : {}) },
    );
  }

  /** Generate images from a text prompt. */
  async createImage(
    prompt: string,
    options?: { n?: number; size?: string; model?: string },
  ): Promise<ApiResponse<ImageGenerationResponse>> {
    return this.request<ImageGenerationResponse>(
      "POST",
      `/apps/${this.appId}/ai/images/generations`,
      { prompt, ...options },
    );
  }

  /** Check content for policy violations. */
  async createModeration(
    input: string,
    model?: string,
  ): Promise<ApiResponse<ModerationResponse>> {
    return this.request<ModerationResponse>(
      "POST",
      `/apps/${this.appId}/ai/moderations`,
      { input, ...(model ? { model } : {}) },
    );
  }

  /** Get detailed per-request AI usage records for the current app. */
  async getAiUsage(
    options?: AiUsageOptions,
  ): Promise<ApiResponse<AiUsageResponse>> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.start_date) params.set("start_date", options.start_date);
    if (options?.end_date) params.set("end_date", options.end_date);
    const query = params.toString();
    const path = `/apps/${this.appId}/ai/usage${query ? `?${query}` : ""}`;
    return this.request<AiUsageResponse>("GET", path);
  }

  /** Get AI usage summary for the current app. */
  async getAiUsageSummary(): Promise<ApiResponse<AiUsageSummary>> {
    return this.request<AiUsageSummary>(
      "GET",
      `/apps/${this.appId}/ai/usage/summary`,
    );
  }

  // --- Devices ---

  /** Fetch the device catalog for the current app. */
  async getDevices(): Promise<ApiResponse<DeviceCatalogResponse>> {
    return this.request<DeviceCatalogResponse>(
      "GET",
      `/apps/${this.appId}/devices`,
    );
  }

  /** Convenience: get a flat list of all devices from the catalog. */
  async getAllDevices(): Promise<Device[]> {
    const response = await this.getDevices();
    const catalog = response.data;
    return catalog.devices ?? [];
  }

  // --- Endpoints ---

  /** Create a new webhook endpoint for the current app. Requires owner auth. */
  async createEndpoint(): Promise<ApiResponse<{
    slug: string;
    status: string;
    expires_at: number;
    endpoint_path: string;
    hmac_secret?: string;
    hmac_required?: boolean;
  }>> {
    return this.request("POST", `/apps/${this.appId}/endpoints`);
  }

  /** Revoke an endpoint and create a replacement. Requires owner auth. */
  async revokeAndReplaceEndpoint(oldSlug: string): Promise<ApiResponse<{
    old_slug: string;
    new_slug: string;
    new_endpoint_path: string;
    revoked_expires_at: number;
    new_expires_at: number;
    hmac_secret?: string;
    hmac_required?: boolean;
  }>> {
    return this.request("POST", `/apps/${this.appId}/endpoints/revoke_and_replace`, { old_slug: oldSlug });
  }

  /** Revoke an endpoint without replacement. Requires owner auth. */
  async revokeEndpoint(slug: string): Promise<ApiResponse<{
    slug: string;
    revoked: boolean;
  }>> {
    return this.request("POST", `/apps/${this.appId}/endpoints/revoke`, { slug });
  }

  // --- Events ---

  /** Post an event to a slug endpoint. */
  async postEvent(
    slug: string,
    payload: Record<string, unknown>,
  ): Promise<ApiResponse<{
    slug: string;
    timestamp: number;
    expires_at: number;
  }>> {
    return this.request("POST", `/events/${slug}`, payload);
  }

  // --- Lookup Tables ---

  /** List available lookup tables. */
  async listLookupTables(): Promise<ApiResponse<{
    items: Array<{
      lookup_table_id: string;
      name: string;
      description?: string | null;
      schema_keys: string[];
      schema_key_count: number;
      schema_keys_truncated: boolean;
      version: number;
      payload_hash: string;
      storage_mode: string;
      chunk_count: number;
      updated_at: number;
    }>;
  }>> {
    return this.request("GET", `/lookup-tables`);
  }

  /** Get a specific lookup table's metadata including chunk refs. */
  async getLookupTable(lookupTableId: string): Promise<ApiResponse<{
    lookup_table_id: string;
    name: string;
    description?: string | null;
    schema_keys: string[];
    schema_key_count: number;
    schema_keys_truncated: boolean;
    version: number;
    payload_hash: string;
    storage_mode: string;
    chunk_count: number;
    updated_at: number;
    prompt?: string | null;
    default_success_sentence?: string | null;
    default_fail_sentence?: string | null;
    chunk_encoding: string;
    manifest_hash: string;
    chunks: Array<{
      index: number;
      path: string;
      sha256: string;
      byte_length: number;
    }>;
  }>> {
    return this.request("GET", `/lookup-tables/${encodeURIComponent(lookupTableId)}`);
  }

  /** Fetch an individual data chunk by index. */
  async getLookupTableChunk(
    lookupTableId: string,
    chunkIndex: number,
    version?: number,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    const params = new URLSearchParams();
    if (version !== undefined) params.set("version", String(version));
    const query = params.toString();
    const path = `/lookup-tables/${encodeURIComponent(lookupTableId)}/chunks/${chunkIndex}${query ? `?${query}` : ""}`;
    return this.request("GET", path);
  }

  /** Fetch all chunks and assemble the complete dataset. */
  async getFullLookupTableDataset(
    lookupTableId: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    const tableResponse = await this.getLookupTable(lookupTableId);
    const table = tableResponse.data;
    const result: Record<string, unknown> = {};

    for (let i = 0; i < table.chunk_count; i++) {
      const chunkResponse = await this.getLookupTableChunk(lookupTableId, i, table.version);
      Object.assign(result, chunkResponse.data);
    }

    return { data: result, status: 200 };
  }

  /** Consume an event from a slug endpoint (single-slot, consume-on-read). */
  async consumeEvent(slug: string): Promise<ApiResponse<{
    slug: string;
    timestamp?: number;
    created_at?: number;
    expires_at?: number;
    text?: string;
    keywords?: string[];
    raw_text?: string;
    metadata?: Record<string, unknown>;
    empty?: boolean;
  }>> {
    return this.request("GET", `/events/${slug}`);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const responseBody = await response.json().catch(() => null);

      if (!response.ok) {
        throw new ApiError(
          response.status,
          `API request failed: ${response.status} ${response.statusText}`,
          responseBody,
        );
      }

      return {
        data: responseBody as T,
        status: response.status,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new MagicAppsError(`Request timed out after ${this.timeout}ms`);
      }
      throw new MagicAppsError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
