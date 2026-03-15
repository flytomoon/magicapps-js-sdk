/** Configuration for the Magic Apps Cloud SDK client. */
export interface MagicAppsConfig {
  /** Base URL of the MagicApps API. */
  baseUrl: string;
  /** The app_id for your registered application. */
  appId: string;
  /** Optional auth token for authenticated requests. */
  authToken?: string;
  /** Request timeout in milliseconds. Defaults to 30000. */
  timeout?: number;
}

/** Information about a registered application. */
export interface AppInfo {
  app_id: string;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/** A template within an application. */
export interface Template {
  template_id: string;
  app_id: string;
  name: string;
  description?: string;
  content: Record<string, unknown>;
  /** How the template's data source is provided: slug_endpoint (default) or api_poll. */
  source_mode?: "slug_endpoint" | "api_poll";
  /** Polling strategy when source_mode is api_poll. */
  poll_mode?: "one_shot" | "short_poll" | "continuous";
  /** Maximum time (ms) to wait for a poll response. */
  timeout_ms?: number;
  /** Maximum number of poll attempts. */
  max_attempts?: number;
  /** Delay (ms) between poll retries. */
  backoff_ms?: number;
  /** Behavior when poll returns empty result. */
  empty_result_behavior?: "fail" | "retry" | "fallback_to_speech";
  /** How the poll response body is interpreted. */
  response_type?: "text" | "json";
  /** JSONPath expression to extract value from poll response when response_type is json. */
  response_path?: string;
  /** Template lifecycle status: beta (default), active, or unreleased. */
  status?: "beta" | "active" | "unreleased";
  created_at: string;
  updated_at: string;
}

/** Standard API response wrapper. */
export interface ApiResponse<T> {
  data: T;
  status: number;
}

/** Paginated API response. */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  next_token?: string;
  count: number;
}

// --- AI Types ---

/** A message in a chat completion request. */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Request body for chat completions (OpenAI-compatible format). */
export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
}

/** A choice in a chat completion response. */
export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason?: string;
}

/** Token usage information. */
export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/** Response from a chat completion request. */
export interface ChatCompletionResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: ChatCompletionChoice[];
  usage?: TokenUsage;
}

/** A single embedding result. */
export interface EmbeddingData {
  object?: string;
  embedding: number[];
  index: number;
}

/** Response from an embedding request. */
export interface EmbeddingResponse {
  object?: string;
  data: EmbeddingData[];
  model?: string;
  usage?: TokenUsage;
}

/** A generated image. */
export interface GeneratedImage {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

/** Response from an image generation request. */
export interface ImageGenerationResponse {
  created?: number;
  data: GeneratedImage[];
}

/** Category flags for content moderation. */
export interface ModerationCategories {
  hate?: boolean;
  sexual?: boolean;
  violence?: boolean;
  "self-harm"?: boolean;
  harassment?: boolean;
}

/** Category scores for content moderation. */
export interface ModerationCategoryScores {
  hate?: number;
  sexual?: number;
  violence?: number;
  "self-harm"?: number;
  harassment?: number;
}

/** A moderation result. */
export interface ModerationResult {
  flagged: boolean;
  categories?: ModerationCategories;
  category_scores?: ModerationCategoryScores;
}

/** Response from a moderation request. */
export interface ModerationResponse {
  id?: string;
  model?: string;
  results: ModerationResult[];
}

/** Breakdown of AI usage by model/endpoint. */
export interface AiUsageBreakdown {
  endpoint?: string;
  model?: string;
  requests?: number;
  tokens?: number;
  cost?: number;
}

/** AI usage summary response. */
export interface AiUsageSummary {
  total_requests?: number;
  total_tokens?: number;
  total_cost?: number;
  period?: string;
  breakdown?: AiUsageBreakdown[];
}

/** A single AI usage record (per-request detail). */
export interface AiUsageRecord {
  usage_id: string;
  app_id: string;
  provider_id: string;
  model_id: string;
  request_type: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  latency_ms: number;
  status: string;
  created_at: number;
  expires_at: number;
  error_code?: string;
  user_id?: string;
}

/** Response from the detailed AI usage endpoint. */
export interface AiUsageResponse {
  usage: AiUsageRecord[];
  count: number;
}

/** Options for filtering AI usage records. */
export interface AiUsageOptions {
  /** Maximum number of records to return (1-100, default 50). */
  limit?: number;
  /** Start of date range (ISO 8601 string). */
  start_date?: string;
  /** End of date range (ISO 8601 string). */
  end_date?: string;
}

// --- Device Types ---

/** A device in the device catalog. */
export interface Device {
  device_id?: string;
  device_name: string;
  display_name?: string;
  device_type?: string;
  bluetooth_uuid?: string;
  tags?: string[];
  visibility?: string;
  source?: string;
  category?: string;
  specs?: Record<string, unknown>;
}

/** Response from the device catalog endpoint. */
export interface DeviceCatalogResponse {
  devices: Device[];
  count?: number;
}

// --- Registry Types ---

/** An app in the registry catalog. */
export interface RegistryApp {
  app_id: string;
  name: string;
  slug: string;
  description?: string;
  icon_url?: string;
  status?: string;
  visibility?: string;
}
