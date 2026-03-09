/** Configuration for the MagicApps SDK client. */
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
