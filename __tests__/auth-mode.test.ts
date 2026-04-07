import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MagicAppsClient, AuthMode } from "../src/client.js";

describe("AuthMode", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: "ok" }),
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends accessToken for bearer mode (default)", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "access-jwt",
      ownerToken: "owner-jwt",
    });
    await client.ping();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer access-jwt");
  });

  it("sends ownerToken for owner mode services", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "access-jwt",
      ownerToken: "owner-jwt",
    });
    await client.endpoints.createEndpoint();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer owner-jwt");
  });

  it("sends no auth header for none mode", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
    });
    await client.getAppInfo();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("backwards compat: setAuthToken sets accessToken", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
    });
    client.setAuthToken("legacy-token");
    await client.ping();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer legacy-token");
  });

  it("setTokens sets both tokens", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
    });
    client.setTokens({ accessToken: "a", ownerToken: "o" });
    await client.endpoints.createEndpoint();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer o");
  });

  it("clearTokens clears both tokens", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "access-jwt",
      ownerToken: "owner-jwt",
    });
    client.clearTokens();
    await client.ping();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("clearAuthToken still works for backwards compat", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "access-jwt",
    });
    client.clearAuthToken();
    await client.ping();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("legacy authToken config sets accessToken", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      authToken: "legacy-config-token",
    });
    await client.ping();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer legacy-config-token");
  });

  it("accessToken takes precedence over authToken in config", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "new-token",
      authToken: "old-token",
    });
    await client.ping();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer new-token");
  });

  it("owner mode falls back to no header when ownerToken is unset", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "access-jwt",
    });
    await client.endpoints.createEndpoint();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("lookup tables use owner auth mode", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "access-jwt",
      ownerToken: "owner-jwt",
    });
    await client.lookupTables.list();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer owner-jwt");
  });

  it("AuthMode enum has expected values", () => {
    expect(AuthMode.bearer).toBe("bearer");
    expect(AuthMode.owner).toBe("owner");
    expect(AuthMode.none).toBe("none");
  });

  it("auth service methods use none mode", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "access-jwt",
      ownerToken: "owner-jwt",
    });
    await client.auth.refreshToken("refresh-tok");
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("devices service uses none mode", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "access-jwt",
      ownerToken: "owner-jwt",
    });
    await client.devices.getDevices();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("payments service uses bearer mode", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ has_entitlement: false }),
    });
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "access-jwt",
      ownerToken: "owner-jwt",
    });
    await client.payments.getSubscription();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer access-jwt");
  });

  it("getAppInfo uses none mode (public endpoint)", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "access-jwt",
      ownerToken: "owner-jwt",
    });
    await client.getAppInfo();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBeUndefined();
  });
});
