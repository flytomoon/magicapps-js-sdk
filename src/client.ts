import type {
  MagicAppsConfig,
  AppInfo,
  ApiResponse,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  EmbeddingResponse,
  ImageGenerationResponse,
  ModerationResponse,
  Device,
  DeviceCatalogResponse,
  AuthTokenResponse,
  UserProfile,
  UpdateProfileData,
  PublicProfile,
  AccountDataExport,
  ConsentPreferences,
  FileUploadUrl,
  StoredFile,
  CreateConversationOptions,
  Conversation,
  ConversationMessage,
  SendMessageOptions,
  SendMessageResponse,
  DeviceRegistration,
  SubscriptionResponse,
  CustomerPortalResponse,
  EntitlementStatus,
  TiersResponse,
  ChangeSubscriptionResponse,
  CheckoutSessionResponse,
  PaymentVerifyResponse,
  CreateUserTokenResponse,
  CreateImageTokenResponse,
  CreateTextTokenResponse,
  EmailTokenStatus,
} from "./types.js";
import { ApiError, MagicAppsError } from "./errors.js";

const DEFAULT_TIMEOUT = 30_000;

/** Authentication mode for API requests. */
export enum AuthMode {
  /** Use the access token (Cognito JWT) for user-authenticated requests. */
  bearer = "bearer",
  /** Use the owner token (HS256 JWT) for owner-authenticated requests. */
  owner = "owner",
  /** No authentication header sent. */
  none = "none",
}

/** Type for the internal request function passed to service classes. */
type RequestFn = <T>(
  method: string,
  path: string,
  body?: unknown,
  authMode?: AuthMode,
) => Promise<ApiResponse<T>>;

// --- Service Classes ---

/** Authentication methods (OAuth, passkeys, magic links). */
export class AuthService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

  /** Exchange an Apple identity token for MagicApps auth tokens. */
  async appleExchangeToken(
    identityToken: string,
    appId: string,
  ): Promise<ApiResponse<AuthTokenResponse>> {
    return this.request<AuthTokenResponse>(
      "POST",
      "/auth/client/apple/exchange",
      { identity_token: identityToken, app_id: appId },
      AuthMode.none,
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
      AuthMode.none,
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
      AuthMode.none,
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
      AuthMode.none,
    );
  }

  /** Get passkey registration options (WebAuthn). */
  async getPasskeyRegisterOptions(): Promise<ApiResponse<any>> {
    return this.request("POST", "/auth/client/passkey/register/options", undefined, AuthMode.none);
  }

  /** Verify a passkey registration credential (WebAuthn). */
  async verifyPasskeyRegistration(
    credential: any,
  ): Promise<ApiResponse<any>> {
    return this.request(
      "POST",
      "/auth/client/passkey/register/verify",
      credential,
      AuthMode.none,
    );
  }

  /** Get passkey authentication options (WebAuthn). */
  async getPasskeyAuthOptions(): Promise<ApiResponse<any>> {
    return this.request("POST", "/auth/client/passkey/authenticate/options", undefined, AuthMode.none);
  }

  /** Verify a passkey authentication assertion (WebAuthn). */
  async verifyPasskeyAuth(
    assertion: any,
  ): Promise<ApiResponse<any>> {
    return this.request(
      "POST",
      "/auth/client/passkey/authenticate/verify",
      assertion,
      AuthMode.none,
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
      AuthMode.none,
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
      AuthMode.none,
    );
  }

  /**
   * Server-to-server: Create a MagicApps token for a verified user email.
   * Requires app_secret (never expose to client-side code).
   */
  async createUserToken(
    email: string,
    options: { app_secret: string },
  ): Promise<ApiResponse<CreateUserTokenResponse>> {
    return this.request<CreateUserTokenResponse>(
      "POST",
      "/auth/server/create-token",
      { email, app_id: this.appId, app_secret: options.app_secret },
      AuthMode.none,
    );
  }
}

/** Payment and subscription methods. */
export class PaymentsService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

  /** Get the current user's subscription status and entitlement for the app. */
  async getSubscription(): Promise<ApiResponse<SubscriptionResponse>> {
    return this.request<SubscriptionResponse>(
      "GET",
      `/apps/${this.appId}/subscription`,
    );
  }

  /** Get a Stripe customer portal URL for the current user. */
  async getCustomerPortalUrl(
    returnUrl: string,
  ): Promise<ApiResponse<CustomerPortalResponse>> {
    return this.request<CustomerPortalResponse>(
      "POST",
      `/apps/${this.appId}/billing/portal`,
      { return_url: returnUrl },
    );
  }

  /** Get available tiers for the current app. */
  async getTiers(): Promise<ApiResponse<TiersResponse>> {
    return this.request<TiersResponse>(
      "GET",
      `/pay/apps/${this.appId}/tiers`,
    );
  }

  /** Change the current user's subscription to a different tier. */
  async changeSubscription(
    newTierId: string,
  ): Promise<ApiResponse<ChangeSubscriptionResponse>> {
    return this.request<ChangeSubscriptionResponse>(
      "POST",
      `/pay/subscription/change`,
      { new_tier_id: newTierId },
    );
  }

  /** Create a Stripe Checkout session for a first-time purchase or subscription.
   *  The server owns redirect URLs (configured on the app record in DynamoDB).
   *  Pass the user_id from createUserToken() for bridge-auth flows. */
  async createCheckoutSession(
    tierId: string,
    options: { user_id: string; purchase_origin?: string },
  ): Promise<ApiResponse<CheckoutSessionResponse>> {
    return this.request<CheckoutSessionResponse>(
      "POST",
      "/pay/checkout",
      {
        app_slug: this.appId,
        user_id: options.user_id,
        tier_id: tierId,
        ...(options.purchase_origin ? { purchase_origin: options.purchase_origin } : {}),
      },
    );
  }

  /** Verify a payment after Stripe Checkout redirect. */
  async verifyPayment(
    sessionId: string,
  ): Promise<ApiResponse<PaymentVerifyResponse>> {
    return this.request<PaymentVerifyResponse>(
      "GET",
      `/pay/verify?session_id=${encodeURIComponent(sessionId)}`,
    );
  }
}

/** Entitlement checking methods. */
export class EntitlementsService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

  /** Check the current user's entitlement status for the app. */
  async check(): Promise<ApiResponse<EntitlementStatus>> {
    return this.request<EntitlementStatus>(
      "GET",
      `/apps/${this.appId}/entitlements`,
    );
  }
}

/** Device catalog methods. */
export class DevicesService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

  /** Fetch the device catalog for the current app. */
  async getDevices(): Promise<ApiResponse<DeviceCatalogResponse>> {
    return this.request<DeviceCatalogResponse>(
      "GET",
      `/apps/${this.appId}/devices`,
      undefined,
      AuthMode.none,
    );
  }

  /** Convenience: get a flat list of all devices from the catalog. */
  async getAllDevices(): Promise<Device[]> {
    const response = await this.getDevices();
    const catalog = response.data;
    return catalog.devices ?? [];
  }
}

/** AI proxy and conversation methods. */
export class AIService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

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

  /** Convenience: create a chat completion from a messages array. */
  async chat(
    messages: ChatMessage[],
    options?: Partial<Omit<ChatCompletionRequest, "messages">>,
  ): Promise<ApiResponse<ChatCompletionResponse>> {
    return this.createChatCompletion({ messages, ...options });
  }

  /** Convenience: generate embeddings for a text string. */
  async embed(
    text: string,
    model?: string,
  ): Promise<ApiResponse<EmbeddingResponse>> {
    return this.createEmbedding(text, model);
  }

  /** Convenience: check content for policy violations. */
  async moderate(
    text: string,
    model?: string,
  ): Promise<ApiResponse<ModerationResponse>> {
    return this.createModeration(text, model);
  }

  /** Convenience: generate an image from a text prompt. */
  async generateImage(
    prompt: string,
    options?: { n?: number; size?: string; model?: string },
  ): Promise<ApiResponse<ImageGenerationResponse>> {
    return this.createImage(prompt, options);
  }

  // --- AI Conversations ---

  readonly conversations = {
    /** Create a new AI conversation. */
    create: async (
      options?: CreateConversationOptions,
    ): Promise<ApiResponse<Conversation>> => {
      return this.request<Conversation>(
        "POST",
        `/apps/${this.appId}/ai/conversations`,
        options,
      );
    },

    /** List AI conversations for the current user. */
    list: async (
      nextToken?: string,
    ): Promise<ApiResponse<{ conversations: Conversation[]; next_token?: string }>> => {
      const params = new URLSearchParams();
      if (nextToken) params.set("next_token", nextToken);
      const query = params.toString();
      const path = `/apps/${this.appId}/ai/conversations${query ? `?${query}` : ""}`;
      return this.request<{ conversations: Conversation[]; next_token?: string }>(
        "GET",
        path,
      );
    },

    /** Get a specific AI conversation by ID. */
    get: async (
      conversationId: string,
    ): Promise<ApiResponse<Conversation>> => {
      return this.request<Conversation>(
        "GET",
        `/apps/${this.appId}/ai/conversations/${encodeURIComponent(conversationId)}`,
      );
    },

    /** Send a message in an AI conversation. */
    sendMessage: async (
      conversationId: string,
      content: string,
      options?: SendMessageOptions,
    ): Promise<ApiResponse<SendMessageResponse>> => {
      return this.request<SendMessageResponse>(
        "POST",
        `/apps/${this.appId}/ai/conversations/${encodeURIComponent(conversationId)}/messages`,
        { content, ...options },
      );
    },

    /** Delete an AI conversation. */
    delete: async (
      conversationId: string,
    ): Promise<ApiResponse<{ deleted: boolean }>> => {
      return this.request<{ deleted: boolean }>(
        "DELETE",
        `/apps/${this.appId}/ai/conversations/${encodeURIComponent(conversationId)}`,
      );
    },
  };
}

/** Endpoint and event methods. */
export class EndpointsService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

  /** Create a new webhook endpoint for the current app. Requires owner auth. */
  async createEndpoint(): Promise<ApiResponse<{
    slug: string;
    status: string;
    expires_at: number;
    endpoint_path: string;
    hmac_secret?: string;
    hmac_required?: boolean;
  }>> {
    return this.request("POST", `/apps/${this.appId}/endpoints`, undefined, AuthMode.owner);
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
    return this.request("POST", `/apps/${this.appId}/endpoints/revoke_and_replace`, { old_slug: oldSlug }, AuthMode.owner);
  }

  /** Revoke an endpoint without replacement. Requires owner auth. */
  async revokeEndpoint(slug: string): Promise<ApiResponse<{
    slug: string;
    revoked: boolean;
  }>> {
    return this.request("POST", `/apps/${this.appId}/endpoints/revoke`, { slug }, AuthMode.owner);
  }

  /** Post an event to a slug endpoint. */
  async postEvent(
    slug: string,
    payload: Record<string, unknown>,
  ): Promise<ApiResponse<{
    slug: string;
    timestamp: number;
    expires_at: number;
  }>> {
    return this.request("POST", `/events/${slug}`, payload, AuthMode.none);
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
    return this.request("GET", `/events/${slug}`, undefined, AuthMode.none);
  }
}

/** File storage methods. */
export class FilesService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

  /** Get a pre-signed upload URL for a file. */
  async getUploadUrl(
    filename: string,
    contentType: string,
  ): Promise<ApiResponse<FileUploadUrl>> {
    return this.request<FileUploadUrl>(
      "POST",
      `/apps/${this.appId}/files/upload-url`,
      { filename, content_type: contentType },
    );
  }

  /** List all files for the current user. */
  async list(): Promise<ApiResponse<{ files: StoredFile[] }>> {
    return this.request<{ files: StoredFile[] }>(
      "GET",
      `/apps/${this.appId}/files`,
    );
  }

  /** Get a specific file by ID. */
  async get(fileId: string): Promise<ApiResponse<StoredFile>> {
    return this.request<StoredFile>(
      "GET",
      `/apps/${this.appId}/files/${encodeURIComponent(fileId)}`,
    );
  }

  /** Delete a specific file by ID. */
  async delete(fileId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.request<{ deleted: boolean }>(
      "DELETE",
      `/apps/${this.appId}/files/${encodeURIComponent(fileId)}`,
    );
  }
}

/** Push notification methods. */
export class NotificationsService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

  /** Register a device for push notifications. */
  async registerDevice(
    token: string,
    platform: string,
    deviceId?: string,
  ): Promise<ApiResponse<DeviceRegistration>> {
    return this.request<DeviceRegistration>(
      "POST",
      `/apps/${this.appId}/notifications/register`,
      { token, platform, ...(deviceId ? { device_id: deviceId } : {}) },
    );
  }

  /** Unregister a device from push notifications. */
  async unregisterDevice(
    deviceId: string,
  ): Promise<ApiResponse<{ unregistered: boolean }>> {
    return this.request<{ unregistered: boolean }>(
      "DELETE",
      `/apps/${this.appId}/notifications/register/${encodeURIComponent(deviceId)}`,
    );
  }
}

/** User profile methods. */
export class ProfilesService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

  /** Get the current user's profile. */
  async get(): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>(
      "GET",
      `/apps/${this.appId}/profile`,
    );
  }

  /** Update the current user's profile. */
  async update(
    data: UpdateProfileData,
  ): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>(
      "PUT",
      `/apps/${this.appId}/profile`,
      data,
    );
  }

  /** Get a user's public profile by user ID. */
  async getPublic(
    userId: string,
  ): Promise<ApiResponse<PublicProfile>> {
    return this.request<PublicProfile>(
      "GET",
      `/apps/${this.appId}/profile/${encodeURIComponent(userId)}`,
    );
  }
}

/** Account management methods. */
export class AccountService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

  /** Delete the current user's account. Accepts an optional reason. */
  async delete(
    reason?: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.request<{ deleted: boolean }>(
      "DELETE",
      `/apps/${this.appId}/account`,
      reason !== undefined ? { reason } : undefined,
    );
  }

  /** Export the current user's account data. */
  async exportData(): Promise<ApiResponse<AccountDataExport>> {
    return this.request<AccountDataExport>(
      "GET",
      `/apps/${this.appId}/account/data-export`,
    );
  }

  /** Get the current user's consent preferences. */
  async getConsent(): Promise<ApiResponse<ConsentPreferences>> {
    return this.request<ConsentPreferences>(
      "GET",
      `/apps/${this.appId}/account/consent`,
    );
  }

  /** Update the current user's consent preferences. */
  async updateConsent(
    consent: ConsentPreferences,
  ): Promise<ApiResponse<ConsentPreferences>> {
    return this.request<ConsentPreferences>(
      "PUT",
      `/apps/${this.appId}/account/consent`,
      consent,
    );
  }
}

/** Settings and configuration methods. */
export class SettingsService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

  /** Get the settings for the current app. */
  async get(): Promise<ApiResponse<any>> {
    return this.request("GET", `/apps/${this.appId}/settings`);
  }

  /** Update the settings for the current app. */
  async update(
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
}

/** Catalog methods. */
export class CatalogService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

  /** Get the catalog for the current app. */
  async get(): Promise<ApiResponse<any>> {
    return this.request("GET", `/apps/${this.appId}/catalog`, undefined, AuthMode.none);
  }
}

/** Lookup table methods. */
export class LookupTablesService {
  constructor(
    private request: RequestFn,
  ) {}

  /** List available lookup tables. */
  async list(): Promise<ApiResponse<{
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
    return this.request("GET", `/lookup-tables`, undefined, AuthMode.owner);
  }

  /** Get a specific lookup table's metadata including chunk refs. */
  async get(lookupTableId: string): Promise<ApiResponse<{
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
    return this.request("GET", `/lookup-tables/${encodeURIComponent(lookupTableId)}`, undefined, AuthMode.owner);
  }

  /** Fetch an individual data chunk by index. */
  async getChunk(
    lookupTableId: string,
    chunkIndex: number,
    version?: number,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    const params = new URLSearchParams();
    if (version !== undefined) params.set("version", String(version));
    const query = params.toString();
    const path = `/lookup-tables/${encodeURIComponent(lookupTableId)}/chunks/${chunkIndex}${query ? `?${query}` : ""}`;
    return this.request("GET", path, undefined, AuthMode.owner);
  }

  /** Fetch all chunks and assemble the complete dataset. */
  async getFullDataset(
    lookupTableId: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    const tableResponse = await this.get(lookupTableId);
    const table = tableResponse.data;
    const result: Record<string, unknown> = {};

    for (let i = 0; i < table.chunk_count; i++) {
      const chunkResponse = await this.getChunk(lookupTableId, i, table.version);
      Object.assign(result, chunkResponse.data);
    }

    return { data: result, status: 200 };
  }
}

/** Legacy owner registration methods. */
export class OwnerService {
  constructor(
    private request: RequestFn,
  ) {}

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
      AuthMode.none,
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
      AuthMode.none,
    );
  }
}

/** Template methods. */
export class TemplatesService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

  /** Get a specific template by ID. */
  async getTemplate(templateId: string): Promise<ApiResponse<any>> {
    return this.request(
      "GET",
      `/apps/${this.appId}/templates/${templateId}`,
      undefined,
      AuthMode.none,
    );
  }
}

/** Email content methods (image and text tokens for email routines). */
export class EmailService {
  constructor(
    private request: RequestFn,
    private appId: string,
  ) {}

  /** Create an image token for an email routine. */
  async createImageToken(options?: {
    ttl_seconds?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ApiResponse<CreateImageTokenResponse>> {
    return this.request<CreateImageTokenResponse>(
      "POST",
      `/apps/${this.appId}/routines/email-image/tokens`,
      options ?? {},
      AuthMode.owner,
    );
  }

  /** Upload a JPEG image to an email image token. */
  async uploadImage(
    token: string,
    imageData: string | ArrayBuffer | Blob,
    options?: {
      transform?: "image" | "image_overlay" | "meme" | "sketch";
      query?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<ApiResponse<null>> {
    let base64: string;
    if (typeof imageData === "string") {
      base64 = imageData.replace(/^data:image\/jpeg;base64,/i, "");
    } else {
      const buffer = imageData instanceof Blob
        ? new Uint8Array(await imageData.arrayBuffer())
        : new Uint8Array(imageData);
      if (buffer.length < 2 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
        throw new MagicAppsError("Image must be JPEG format (expected magic bytes 0xFF 0xD8)");
      }
      if (typeof Buffer !== "undefined") {
        base64 = Buffer.from(buffer).toString("base64");
      } else {
        let binary = "";
        for (let i = 0; i < buffer.length; i++) {
          binary += String.fromCharCode(buffer[i]);
        }
        base64 = btoa(binary);
      }
    }
    return this.request<null>(
      "POST",
      `/apps/${this.appId}/routines/email-image/${token}`,
      { image_jpeg_base64: base64, ...options },
      AuthMode.owner,
    );
  }

  /** Create a text token for an email routine. */
  async createTextToken(options?: {
    ttl_seconds?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ApiResponse<CreateTextTokenResponse>> {
    return this.request<CreateTextTokenResponse>(
      "POST",
      `/apps/${this.appId}/routines/email-text/tokens`,
      options ?? {},
      AuthMode.owner,
    );
  }

  /** Upload text content to an email text token. */
  async uploadText(
    token: string,
    sentence: string,
    options?: { metadata?: Record<string, unknown> },
  ): Promise<ApiResponse<null>> {
    return this.request<null>(
      "POST",
      `/apps/${this.appId}/routines/email-text/${token}`,
      { sentence, ...options },
      AuthMode.owner,
    );
  }

  /** Get the status of an email token (image or text). */
  async getTokenStatus(token: string): Promise<ApiResponse<EmailTokenStatus>> {
    return this.request<EmailTokenStatus>(
      "GET",
      `/apps/${this.appId}/routines/email-status/${token}`,
      undefined,
      AuthMode.owner,
    );
  }
}

// --- Main Client ---

/** MagicApps API client for TypeScript/JavaScript applications. */
export class MagicAppsClient {
  private readonly baseUrl: string;
  private readonly appId: string;
  private accessToken: string | undefined;
  private ownerToken: string | undefined;
  private readonly timeout: number;

  /** Authentication methods (OAuth, passkeys, magic links). */
  readonly auth: AuthService;
  /** Payment and subscription methods. */
  readonly payments: PaymentsService;
  /** Entitlement checking methods. */
  readonly entitlements: EntitlementsService;
  /** Device catalog methods. */
  readonly devices: DevicesService;
  /** AI proxy and conversation methods. */
  readonly ai: AIService;
  /** Endpoint and event methods. */
  readonly endpoints: EndpointsService;
  /** File storage methods. */
  readonly files: FilesService;
  /** Push notification methods. */
  readonly notifications: NotificationsService;
  /** User profile methods. */
  readonly profiles: ProfilesService;
  /** Account management methods. */
  readonly account: AccountService;
  /** Settings and configuration methods. */
  readonly settings: SettingsService;
  /** Catalog methods. */
  readonly catalog: CatalogService;
  /** Lookup table methods. */
  readonly lookupTables: LookupTablesService;
  /** Legacy owner registration methods. */
  readonly owner: OwnerService;
  /** Template methods. */
  readonly templates: TemplatesService;
  /** Email content methods (image and text tokens for email routines). */
  readonly email: EmailService;

  constructor(config: MagicAppsConfig) {
    if (!config.baseUrl) {
      throw new MagicAppsError("baseUrl is required");
    }
    if (!config.appId) {
      throw new MagicAppsError("appId is required");
    }

    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.appId = config.appId;
    this.accessToken = config.accessToken ?? config.authToken;
    this.ownerToken = config.ownerToken;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;

    const boundRequest = this.request.bind(this) as RequestFn;

    this.auth = new AuthService(boundRequest, this.appId);
    this.payments = new PaymentsService(boundRequest, this.appId);
    this.entitlements = new EntitlementsService(boundRequest, this.appId);
    this.devices = new DevicesService(boundRequest, this.appId);
    this.ai = new AIService(boundRequest, this.appId);
    this.endpoints = new EndpointsService(boundRequest, this.appId);
    this.files = new FilesService(boundRequest, this.appId);
    this.notifications = new NotificationsService(boundRequest, this.appId);
    this.profiles = new ProfilesService(boundRequest, this.appId);
    this.account = new AccountService(boundRequest, this.appId);
    this.settings = new SettingsService(boundRequest, this.appId);
    this.catalog = new CatalogService(boundRequest, this.appId);
    this.lookupTables = new LookupTablesService(boundRequest);
    this.owner = new OwnerService(boundRequest);
    this.templates = new TemplatesService(boundRequest, this.appId);
    this.email = new EmailService(boundRequest, this.appId);
  }

  /** Update the auth token (e.g. after login or token refresh).
   *  @deprecated Use setTokens() instead. This sets the accessToken for backwards compatibility. */
  setAuthToken(token: string): void {
    this.accessToken = token;
  }

  /** Clear the auth token (e.g. on logout).
   *  @deprecated Use clearTokens() instead. This clears the accessToken for backwards compatibility. */
  clearAuthToken(): void {
    this.accessToken = undefined;
  }

  /** Set both access and owner tokens. */
  setTokens(tokens: { accessToken?: string; ownerToken?: string }): void {
    if (tokens.accessToken !== undefined) this.accessToken = tokens.accessToken;
    if (tokens.ownerToken !== undefined) this.ownerToken = tokens.ownerToken;
  }

  /** Clear both access and owner tokens (e.g. on logout). */
  clearTokens(): void {
    this.accessToken = undefined;
    this.ownerToken = undefined;
  }

  /** Health check - verifies connectivity to the MagicApps API. */
  async ping(): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>("GET", "/ping");
  }

  /** Get information about the current application. */
  async getAppInfo(): Promise<ApiResponse<AppInfo>> {
    return this.request<AppInfo>("GET", `/apps/${this.appId}`, undefined, AuthMode.none);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    authMode: AuthMode = AuthMode.bearer,
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authMode === AuthMode.bearer && this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    } else if (authMode === AuthMode.owner && this.ownerToken) {
      headers["Authorization"] = `Bearer ${this.ownerToken}`;
    }
    // AuthMode.none: no auth header

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new ApiError(
          response.status,
          `API request failed: ${response.status} ${response.statusText}`,
          errorBody,
        );
      }

      if (response.status === 204) {
        return { data: null as T, status: response.status };
      }

      const responseBody = await response.json().catch(() => null);

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
