/**
 * Auto-generated API types from OpenAPI specification.
 * DO NOT EDIT MANUALLY - regenerate with: npm run openapi:generate-types
 */

/** Platform health check response with per-service status */
export interface PlatformHealthResponse {
  /** "Overall platform status: healthy (all pass), degraded (some non-critical fail), unhealthy (critical failures)" */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** ISO 8601 timestamp of when the check was performed */
  timestamp: string;
  /** Deployment environment identifier (dev, staging, prod) */
  environment: string;
  /** Per-service health check results */
  checks: Record<string, unknown>;
  required?: string;
  /** Generic status message without secrets or internal details */
  properties?: 'pass' | 'fail';
}

export interface AuthTokenResponse {
  user?: Record<string, unknown>;
  id?: string;
  email?: string;
  status?: string;
  token?: string;
  refresh_token?: string;
}

export interface Tenant {
  tenant_id?: string;
  name?: string;
  email?: string;
  status?: string;
  created_at?: string;
  plan?: string;
}

export interface AIProvider {
  id?: string;
  name?: string;
  provider?: 'openai' | 'anthropic' | 'google';
  model?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Error {
  error: string;
  message: string;
}

export interface LookupTableSummary {
  lookup_table_id?: string;
  name?: string;
  description?: string | null;
  schema_keys?: string[];
  schema_key_count?: number;
  schema_keys_truncated?: boolean;
  version?: number;
  payload_hash?: string;
  storage_mode?: string;
  chunk_count?: number;
  updated_at?: number;
}

export interface LookupTableChunk {
  index?: number;
  path?: string;
  sha256?: string;
  byte_length?: number;
}

export interface LookupTableDetail extends LookupTableSummary, LookupTableChunk {
  /** Present on detail only; omitted from summary list. */
  prompt?: string | null;
  /** Optional templated success sentence using {{path.to.key}} tokens. */
  default_success_sentence?: string | null;
  /** Optional fallback fail sentence. */
  default_fail_sentence?: string | null;
  chunk_encoding?: string;
  manifest_hash?: string;
  chunks?: LookupTableChunk[];
}

export interface AdminLookupTableDetail extends LookupTableDetail {
  allowlisted_apps?: string[];
  client_targets?: string[];
  status?: string;
  created_at?: number;
  updated_by?: string;
  deleted_at?: number | null;
  purge_at?: number | null;
  payload_json?: Record<string, unknown>;
  manifest_key?: string | null;
}

export interface AdminLookupTableUpsertRequest {
  lookup_table_id?: string;
  name: string;
  description?: string | null;
  /** Optional prompt metadata (max 4000 chars). */
  prompt?: string | null;
  /** Optional success sentence template (max 2000 chars). */
  default_success_sentence?: string | null;
  /** Optional fail sentence text (max 1000 chars). */
  default_fail_sentence?: string | null;
  allowlisted_apps?: string[];
  client_targets?: string[];
  /** Required on PATCH for optimistic locking. */
  version?: number;
  payload_json: Record<string, unknown>;
}

export interface Template {
  pk?: string;
  sk?: string;
  template_id?: string;
  integration_id?: string;
  app_id?: string;
  template_name?: string;
  template_type?: 'slug_endpoint' | 'url_scheme' | 'http_post' | 'http_get';
  /** > */
  source_mode?: 'slug_endpoint' | 'api_poll';
  /** Configuration for api_poll source_mode. Only applies when source_mode=api_poll. */
  poll_config?: Record<string, unknown>;
  /** > */
  poll_mode?: 'one_shot' | 'short_poll' | 'continuous';
  /** Maximum time in milliseconds to wait for a result (1ms–300000ms / 5 min). */
  timeout_ms?: number;
  /** Maximum number of poll attempts before giving up (1–100). */
  max_attempts?: number;
  /** Delay in milliseconds between poll attempts (0–60000ms). */
  backoff_ms?: number;
  /** > */
  empty_result_behavior?: 'fail' | 'retry' | 'fallback_to_speech';
  /** API-poll-specific response parsing configuration. Only applies when source_mode=api_poll. */
  api_poll_config?: Record<string, unknown>;
  /** > */
  response_type?: 'text' | 'json';
  /** > */
  response_path?: string;
  /** High-level grouping (e.g., custom_core, built_integration) */
  group?: string;
  /** End-user facing description shown publicly */
  public_description?: string;
  /** How the endpoint is supplied (e.g., full_url, id_only) */
  endpoint_input_mode?: string;
  /** Placeholder text for id_only inputs */
  endpoint_input_placeholder?: string;
  /** Whether the client should show the endpoint input field */
  show_endpoint_input?: boolean;
  /** Whether the client should display parameter fields */
  show_parameters?: boolean;
  integration_name?: string;
  provider?: string;
  description?: string;
  category?: string;
  tags?: string[];
  status?: string;
  version?: string;
  is_latest?: boolean;
  last_verified_at?: string;
  maintainer?: string;
  created_by_name?: string;
  website_url?: string;
  docs_url?: string;
  support_url?: string;
  app_store_urls?: Record<string, unknown>;
  apple?: string;
  google?: string;
  icon_url?: string;
  price_tier?: string;
  current_price?: string;
  auth_type?: string;
  auth_location?: string;
  scopes?: string[];
  requires_signature?: boolean;
  content_type?: string;
  submitted_by_name?: string;
  submitted_by_email?: string;
  submitted_at?: string;
  breaking_changes?: string;
  supersedes_version?: string;
  approved_at?: string;
  is_new_until?: string;
  visibility?: TemplateVisibility;
  allowed_app_ids?: string[];
  endpoint_pattern?: string;
  parameters?: TemplateParameter[];
  metadata?: Record<string, unknown>;
  created_at?: number;
  updated_at?: number;
}

export interface AppIntegration {
  integration_id?: string;
  integration_name?: string;
  group?: string;
  template_id?: string;
  template_name?: string;
  template_type?: 'slug_endpoint' | 'url_scheme' | 'http_post' | 'http_get';
  endpoint_input_mode?: string;
  endpoint_input_placeholder?: string;
  show_endpoint_input?: boolean;
  show_parameters?: boolean;
  endpoint_pattern?: string;
  parameters?: TemplateParameter[];
  metadata?: Record<string, unknown>;
  created_by_name?: string;
  auth_type?: string;
  auth_location?: string;
  scopes?: string[];
  requires_signature?: boolean;
  content_type?: string;
  setup_fields?: SetupField[];
}

export interface AppIntegrationV2 {
  integration_id?: string;
  integration_name?: string;
  group?: string;
  template_id?: string;
  template_name?: string;
  template_type?: 'slug_endpoint' | 'url_scheme' | 'http_post' | 'http_get';
  endpoint_input_mode?: string;
  endpoint_input_placeholder?: string;
  show_endpoint_input?: boolean;
  show_parameters?: boolean;
  endpoint_pattern?: string;
  parameters?: TemplateParameter[];
  metadata?: Record<string, unknown>;
  created_by_name?: string;
  auth_type?: string;
  auth_location?: string;
  scopes?: string[];
  requires_signature?: boolean;
  content_type?: string;
  setup_fields?: SetupField[];
}

export interface App {
  app_id?: string;
  name?: string;
  display_name?: string;
  summary?: string;
  allow_multiple?: boolean;
  public_description?: string;
  description?: string;
  category?: string;
  tags?: string[];
  aliases?: string[];
  default_integration_id?: string;
  status?: string;
  version?: string;
  is_latest?: boolean;
  last_verified_at?: string;
  maintainer?: string;
  created_by_name?: string;
  created_by_email?: string;
  website_url?: string;
  docs_url?: string;
  support_url?: string;
  app_store_urls?: Record<string, unknown>;
  apple?: string;
  google?: string;
  icon_url?: string;
  visibility?: TemplateVisibility;
  integrations?: AppIntegration[];
}

export interface AppV2 {
  app_id?: string;
  name?: string;
  display_name?: string;
  summary?: string;
  allow_multiple?: boolean;
  public_description?: string;
  description?: string;
  category?: string;
  tags?: string[];
  aliases?: string[];
  default_integration_id?: string;
  status?: string;
  version?: string;
  is_latest?: boolean;
  last_verified_at?: string;
  maintainer?: string;
  created_by_name?: string;
  created_by_email?: string;
  website_url?: string;
  docs_url?: string;
  support_url?: string;
  app_store_urls?: Record<string, unknown>;
  apple?: string;
  google?: string;
  icon_url?: string;
  visibility?: TemplateVisibility;
  integrations?: AppIntegrationV2[];
}

export interface AppAvailabilityIntegration {
  integration_id?: string;
  integration_name?: string;
  template_type?: 'slug_endpoint' | 'url_scheme' | 'http_post' | 'http_get';
}

export interface AppAvailabilityMatch {
  app_id?: string;
  name?: string;
  default_integration_id?: string;
  integrations?: AppAvailabilityIntegration[];
}

export interface AppAvailabilityResponse {
  available?: boolean;
  matches?: AppAvailabilityMatch[];
}

export interface TemplateInput {
  template_type?: 'url_scheme' | 'http_post' | 'http_get';
  public_description?: string;
  /** How the endpoint is supplied (e.g., full_url, id_only) */
  endpoint_input_mode?: string;
  /** Placeholder text for id_only inputs */
  endpoint_input_placeholder?: string;
  /** Whether the client should show the endpoint input field */
  show_endpoint_input?: boolean;
  /** Whether the client should display parameter fields */
  show_parameters?: boolean;
  integration_name?: string;
  category?: string;
  tags?: string[];
  status?: string;
  version?: string;
  is_latest?: boolean;
  description?: string;
  website_url?: string;
  docs_url?: string;
  support_url?: string;
  app_store_urls?: Record<string, unknown>;
  apple?: string;
  google?: string;
  icon_url?: string;
  price_tier?: string;
  current_price?: string;
  submitted_by_name?: string;
  submitted_by_email?: string;
  submitted_at?: string;
  visibility?: TemplateVisibility;
  parameters?: TemplateParameter[];
  metadata?: Record<string, unknown>;
}

/** Mutable fields admins can update on approved templates; approved_at/is_new_until remain unchanged. */
export interface TemplateAdminUpdate {
  template_name?: string;
  public_description?: string;
  description?: string;
  integration_name?: string;
  provider?: string;
  endpoint_pattern?: string;
  endpoint_input_mode?: string;
  endpoint_input_placeholder?: string;
  show_endpoint_input?: boolean;
  show_parameters?: boolean;
  parameters?: TemplateParameter[];
  category?: string;
  tags?: string[];
  maintainer?: string;
  website_url?: string;
  docs_url?: string;
  support_url?: string;
  app_store_urls?: Record<string, unknown>;
  apple?: string;
  google?: string;
  icon_url?: string;
  price_tier?: string;
  current_price?: string;
  breaking_changes?: string;
  supersedes_version?: string;
  visibility?: TemplateVisibility;
}

export interface TemplateParameter {
  name: string;
  /** Legacy alias for value_type. */
  type?: 'dynamic' | 'static';
  /** Preferred field for parameter value type. */
  value_type?: 'dynamic' | 'static' | 'user_input';
  /** User-facing label when value_type is user_input. */
  label?: string;
  required?: boolean;
  default?: string;
  example?: string;
  encoding?: 'url' | 'none';
}

export interface SetupField {
  id?: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  input_mode?: string;
  expected_format?: string;
  validation?: Record<string, unknown>;
  is_secret?: boolean;
  allow_voice_input?: boolean;
}

export interface TemplateVisibility {
  registry?: boolean;
  templates?: boolean;
  wellKnown?: boolean;
}

export interface Device {
  id?: string;
  device_name?: string;
  display_name?: string;
  device_type?: 'input' | 'output';
  description?: string;
  category?: string;
  tags?: string[];
  visibility?: 'public' | 'private';
  bluetooth_uuid?: string;
  status?: string;
  version?: string;
  is_latest?: boolean;
  manufacturer?: string;
  model?: string;
  allowed_app_ids?: string[];
  metadata?: Record<string, unknown>;
  created_at?: number;
  updated_at?: number;
}

export interface DeviceInput {
  device_name: string;
  display_name: string;
  device_type: 'input' | 'output';
  description?: string;
  category?: string;
  tags?: string[];
  visibility: 'public' | 'private';
  bluetooth_uuid?: string;
  status?: string;
  version?: string;
  is_latest?: boolean;
  manufacturer?: string;
  model?: string;
  website_url?: string;
  docs_url?: string;
  support_url?: string;
  app_store_urls?: Record<string, unknown>;
  apple?: string;
  google?: string;
  icon_url?: string;
  metadata?: Record<string, unknown>;
}

export interface SubmissionReviewInput {
  status: 'approved' | 'rejected';
  review_notes?: string;
  /** ISO8601 timestamp; optional override (defaults to approval +14 days) */
  is_new_until?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

/** | */
export interface SubmissionAdminUpdate {
  status?: 'approved' | 'rejected';
  review_notes?: string;
  is_new_until?: string;
  action?: 'reply';
  message?: string;
  template_name?: string;
  template_type?: 'url_scheme' | 'http_post' | 'http_get';
  integration_name?: string;
  provider?: string;
  created_by_name?: string;
  public_description?: string;
  description?: string;
  category?: string;
  tags?: string[];
  maintainer?: string;
  visibility?: 'public' | 'private';
  endpoint_pattern?: string;
  endpoint_input_mode?: 'full_url' | 'id_only' | 'none';
  endpoint_input_placeholder?: string;
  show_endpoint_input?: boolean;
  show_parameters?: boolean;
  parameters?: TemplateParameter[];
  website_url?: string;
  docs_url?: string;
  support_url?: string;
  app_store_urls?: Record<string, unknown>;
  apple?: string;
  google?: string;
  icon_url?: string;
  price_tier?: string;
  current_price?: string;
  breaking_changes?: string;
  supersedes_version?: string;
  content_type?: string;
  auth_type?: string;
  auth_location?: string;
  requires_signature?: boolean;
  perform_app_install_check?: boolean;
  url_scheme_param_mode?: string;
  device_name?: string;
  display_name?: string;
  device_type?: string;
  allowed_app_ids?: string[];
  metadata?: Record<string, unknown>;
}

export interface Submission {
  id?: string;
  /** app/template/device */
  type?: string;
  status?: string;
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  is_new_until?: string;
  approved_at?: string;
  status_type?: string;
  generated_app_id?: string;
  reviewed_by_name?: string;
  last_submitter_email_status?: string;
  last_submitter_email_at?: string;
  last_submitter_email_error?: string;
  last_admin_email_status?: string;
  last_admin_email_at?: string;
  last_admin_email_error?: string;
  thread?: SubmissionThreadEntry[];
  submitted_at?: string;
  submitted_by_email?: string;
  submitted_by_name?: string;
}

export interface SubmissionReview {
  status: 'approved' | 'rejected';
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  is_new_until?: string;
}

export interface SubmissionThreadEntry {
  author?: string;
  author_name?: string;
  role?: string;
  type?: string;
  status?: string;
  message?: string;
  created_at?: string;
}

export interface Registry {
  version?: string;
  templates?: Template[];
  apps?: App[];
}
