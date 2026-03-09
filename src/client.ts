import type {
  MagicAppsConfig,
  AppInfo,
  Template,
  ApiResponse,
  PaginatedResponse,
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

  /** List templates for the current application. */
  async listTemplates(
    nextToken?: string,
  ): Promise<PaginatedResponse<Template>> {
    const params = new URLSearchParams();
    if (nextToken) params.set("next_token", nextToken);
    const query = params.toString();
    const path = `/apps/${this.appId}/templates${query ? `?${query}` : ""}`;
    return this.request<PaginatedResponse<Template>>(
      "GET",
      path,
    ) as Promise<PaginatedResponse<Template>>;
  }

  /** Get a specific template by ID. */
  async getTemplate(templateId: string): Promise<ApiResponse<Template>> {
    return this.request<Template>(
      "GET",
      `/apps/${this.appId}/templates/${templateId}`,
    );
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
