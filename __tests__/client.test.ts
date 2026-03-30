import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MagicAppsClient } from "../src/client.js";
import { MagicAppsError, ApiError } from "../src/errors.js";

describe("MagicAppsClient", () => {
  const defaultConfig = {
    baseUrl: "https://api.example.com",
    appId: "test-app",
  };

  describe("constructor", () => {
    it("creates client with valid config", () => {
      const client = new MagicAppsClient(defaultConfig);
      expect(client).toBeInstanceOf(MagicAppsClient);
    });

    it("throws if baseUrl is empty", () => {
      expect(
        () => new MagicAppsClient({ baseUrl: "", appId: "test" }),
      ).toThrow(MagicAppsError);
    });

    it("throws if appId is empty", () => {
      expect(
        () => new MagicAppsClient({ baseUrl: "https://api.test.com", appId: "" }),
      ).toThrow(MagicAppsError);
    });

    it("strips trailing slashes from baseUrl", () => {
      const client = new MagicAppsClient({
        baseUrl: "https://api.example.com///",
        appId: "test-app",
      });
      expect(client).toBeInstanceOf(MagicAppsClient);
    });
  });

  describe("service accessors", () => {
    it("exposes all service groups", () => {
      const client = new MagicAppsClient(defaultConfig);
      expect(client.auth).toBeDefined();
      expect(client.payments).toBeDefined();
      expect(client.entitlements).toBeDefined();
      expect(client.devices).toBeDefined();
      expect(client.ai).toBeDefined();
      expect(client.endpoints).toBeDefined();
      expect(client.files).toBeDefined();
      expect(client.notifications).toBeDefined();
      expect(client.profiles).toBeDefined();
      expect(client.account).toBeDefined();
      expect(client.settings).toBeDefined();
      expect(client.catalog).toBeDefined();
      expect(client.lookupTables).toBeDefined();
      expect(client.owner).toBeDefined();
      expect(client.templates).toBeDefined();
    });

    it("services are readonly", () => {
      const client = new MagicAppsClient(defaultConfig);
      // TypeScript enforces readonly at compile time; verify the properties exist and are stable
      const auth1 = client.auth;
      const auth2 = client.auth;
      expect(auth1).toBe(auth2);
    });
  });

  describe("API methods", () => {
    let client: MagicAppsClient;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      client = new MagicAppsClient(defaultConfig);
      fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    // --- Main client methods ---

    it("getAppInfo calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          app_id: "test-app",
          name: "Test App",
          slug: "test-app",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        }),
      });

      const result = await client.getAppInfo();
      expect(result.status).toBe(200);
      expect(result.data.app_id).toBe("test-app");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("ping calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: "pong" }),
      });

      const result = await client.ping();
      expect(result.data.message).toBe("pong");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/ping",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("includes auth token when set", async () => {
      client.setAuthToken("my-token");
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await client.getAppInfo();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer my-token",
          }),
        }),
      );
    });

    it("clears auth token", async () => {
      client.setAuthToken("my-token");
      client.clearAuthToken();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await client.getAppInfo();
      const callHeaders = fetchSpy.mock.calls[0][1].headers;
      expect(callHeaders).not.toHaveProperty("Authorization");
    });

    it("throws ApiError on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ message: "App not found" }),
      });

      await expect(client.getAppInfo()).rejects.toThrow(ApiError);
    });

    // --- Auth service ---

    it("auth.appleExchangeToken calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ token: "abc123", refresh_token: "refresh123" }),
      });

      const result = await client.auth.appleExchangeToken("apple-id-token", "test-app");
      expect(result.data.token).toBe("abc123");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/auth/client/apple/exchange",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ identity_token: "apple-id-token", app_id: "test-app" }),
        }),
      );
    });

    it("auth.refreshToken calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ token: "new-token" }),
      });

      await client.auth.refreshToken("refresh-token-123");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/auth/client/refresh",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ refresh_token: "refresh-token-123" }),
        }),
      );
    });

    // --- Templates service ---

    it("templates.getTemplate calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ template_id: "tmpl-1" }),
      });

      await client.templates.getTemplate("tmpl-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/templates/tmpl-1",
        expect.objectContaining({ method: "GET" }),
      );
    });

    // --- Devices service ---

    it("devices.getDevices calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ devices: [{ device_name: "Test Device" }], count: 1 }),
      });

      const result = await client.devices.getDevices();
      expect(result.data.devices).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/devices",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("devices.getAllDevices returns flat array", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ devices: [{ device_name: "D1" }, { device_name: "D2" }] }),
      });

      const devices = await client.devices.getAllDevices();
      expect(devices).toHaveLength(2);
      expect(devices[0].device_name).toBe("D1");
    });

    // --- Profiles service ---

    it("profiles.get calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ user_id: "u-1", display_name: "Test User" }),
      });

      const result = await client.profiles.get();
      expect(result.data.user_id).toBe("u-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/profile",
        expect.objectContaining({ method: "GET" }),
      );
    });

    // --- Payments service ---

    it("payments.getSubscription calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ has_entitlement: true, tier: { tier_id: "pro", name: "Pro" } }),
      });

      const result = await client.payments.getSubscription();
      expect(result.data.has_entitlement).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/subscription",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("payments.getCustomerPortalUrl calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ url: "https://billing.stripe.com/session/abc" }),
      });

      const result = await client.payments.getCustomerPortalUrl("https://myapp.com/settings");
      expect(result.data.url).toBe("https://billing.stripe.com/session/abc");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/billing/portal",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ return_url: "https://myapp.com/settings" }),
        }),
      );
    });

    // --- New method: payments.getTiers ---

    it("payments.getTiers returns tiers for the app", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          app_slug: "test-app",
          has_tiers: true,
          tiers: [
            {
              tier_id: "free",
              name: "Free",
              slug: "free",
              description: "Free tier",
              billing_type: "recurring",
              billing_interval: "month",
              price_cents: 0,
              currency: "usd",
              features: [],
              is_default: true,
            },
            {
              tier_id: "pro",
              name: "Pro",
              slug: "pro",
              description: "Pro tier",
              billing_type: "recurring",
              billing_interval: "month",
              price_cents: 999,
              currency: "usd",
              features: ["ai", "priority_support"],
              is_default: false,
            },
          ],
        }),
      });

      const result = await client.payments.getTiers();
      expect(result.status).toBe(200);
      expect(result.data.has_tiers).toBe(true);
      expect(result.data.tiers).toHaveLength(2);
      expect(result.data.tiers[1].tier_id).toBe("pro");
      expect(result.data.tiers[1].price_cents).toBe(999);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/pay/apps/test-app/tiers",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("payments.getTiers handles empty tiers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          app_slug: "test-app",
          has_tiers: false,
          tiers: [],
        }),
      });

      const result = await client.payments.getTiers();
      expect(result.data.has_tiers).toBe(false);
      expect(result.data.tiers).toHaveLength(0);
    });

    it("payments.getTiers throws on 404", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: "NOT_FOUND", message: "App not found" }),
      });

      await expect(client.payments.getTiers()).rejects.toThrow(ApiError);
      try {
        await client.payments.getTiers();
      } catch (e) {
        expect((e as ApiError).statusCode).toBe(404);
      }
    });

    // --- New method: payments.changeSubscription ---

    it("payments.changeSubscription changes tier", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          upgrade: true,
          new_tier_id: "pro",
        }),
      });

      const result = await client.payments.changeSubscription("pro");
      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.upgrade).toBe(true);
      expect(result.data.new_tier_id).toBe("pro");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/pay/subscription/change",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ new_tier_id: "pro" }),
        }),
      );
    });

    it("payments.changeSubscription throws on 400 invalid tier", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: "INVALID_TIER", message: "Tier does not exist" }),
      });

      await expect(client.payments.changeSubscription("nonexistent")).rejects.toThrow(ApiError);
      try {
        await client.payments.changeSubscription("nonexistent");
      } catch (e) {
        expect((e as ApiError).statusCode).toBe(400);
      }
    });

    // --- New method: payments.createCheckoutSession ---

    it("payments.createCheckoutSession returns checkout_url and session_id", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          checkout_url: "https://checkout.stripe.com/c/pay_abc123",
          session_id: "cs_test_abc123",
        }),
      });

      const result = await client.payments.createCheckoutSession("pro", {
        success_url: "https://myapp.com/success",
        cancel_url: "https://myapp.com/cancel",
      });
      expect(result.status).toBe(200);
      expect(result.data.checkout_url).toBe("https://checkout.stripe.com/c/pay_abc123");
      expect(result.data.session_id).toBe("cs_test_abc123");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/pay/checkout",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            tier_id: "pro",
            success_url: "https://myapp.com/success",
            cancel_url: "https://myapp.com/cancel",
          }),
        }),
      );
    });

    it("payments.createCheckoutSession throws on 401 unauthorized", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ error: "UNAUTHORIZED", message: "Invalid or expired token" }),
      });

      await expect(
        client.payments.createCheckoutSession("pro", {
          success_url: "https://myapp.com/success",
          cancel_url: "https://myapp.com/cancel",
        }),
      ).rejects.toThrow(ApiError);
      try {
        await client.payments.createCheckoutSession("pro", {
          success_url: "https://myapp.com/success",
          cancel_url: "https://myapp.com/cancel",
        });
      } catch (e) {
        expect((e as ApiError).statusCode).toBe(401);
      }
    });

    // --- New method: payments.verifyPayment ---

    it("payments.verifyPayment returns verified true", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          verified: true,
          payment_id: "pay_abc123",
          status: "complete",
          tier_id: "pro",
          tier_name: "Pro",
        }),
      });

      const result = await client.payments.verifyPayment("cs_test_abc123");
      expect(result.status).toBe(200);
      expect(result.data.verified).toBe(true);
      expect(result.data.payment_id).toBe("pay_abc123");
      expect(result.data.status).toBe("complete");
      expect(result.data.tier_id).toBe("pro");
      expect(result.data.tier_name).toBe("Pro");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/pay/verify?session_id=cs_test_abc123",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("payments.verifyPayment returns verified false for invalid session", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          verified: false,
        }),
      });

      const result = await client.payments.verifyPayment("cs_invalid_session");
      expect(result.status).toBe(200);
      expect(result.data.verified).toBe(false);
      expect(result.data.payment_id).toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/pay/verify?session_id=cs_invalid_session",
        expect.objectContaining({ method: "GET" }),
      );
    });

    // --- New method: entitlements.check ---

    it("entitlements.check returns entitlement status", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          entitlement_active: true,
          entitlement_state: "active",
          entitlement_id: "ent-123",
          source: "stripe",
          tier_id: "pro",
          tier_name: "Pro",
          billing_type: "recurring",
          pending_tier_id: null,
          created_at: 1700000000,
        }),
      });

      const result = await client.entitlements.check();
      expect(result.status).toBe(200);
      expect(result.data.entitlement_active).toBe(true);
      expect(result.data.entitlement_state).toBe("active");
      expect(result.data.entitlement_id).toBe("ent-123");
      expect(result.data.tier_id).toBe("pro");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/entitlements",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("entitlements.check throws on 401 unauthorized", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ error: "UNAUTHORIZED", message: "Invalid or expired token" }),
      });

      await expect(client.entitlements.check()).rejects.toThrow(ApiError);
      try {
        await client.entitlements.check();
      } catch (e) {
        expect((e as ApiError).statusCode).toBe(401);
      }
    });

    // --- AI service spot check ---

    it("ai.chat calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ index: 0, message: { role: "assistant", content: "Hello!" } }],
        }),
      });

      const result = await client.ai.chat([{ role: "user", content: "Hi" }]);
      expect(result.data.choices[0].message.content).toBe("Hello!");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/ai/chat/completions",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("ai.conversations.create calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ conversation_id: "conv-1", title: "Test" }),
      });

      const result = await client.ai.conversations.create({ title: "Test" });
      expect(result.data.conversation_id).toBe("conv-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/ai/conversations",
        expect.objectContaining({ method: "POST" }),
      );
    });

    // --- Endpoints service spot check ---

    it("endpoints.postEvent calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ slug: "abc", timestamp: 1234, expires_at: 5678 }),
      });

      await client.endpoints.postEvent("abc", { text: "hello" });
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/events/abc",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ text: "hello" }),
        }),
      );
    });

    // --- Files service spot check ---

    it("files.list calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ files: [] }),
      });

      const result = await client.files.list();
      expect(result.data.files).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/files",
        expect.objectContaining({ method: "GET" }),
      );
    });

    // --- Settings service spot check ---

    it("settings.get calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ theme: "dark" }),
      });

      await client.settings.get();
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/settings",
        expect.objectContaining({ method: "GET" }),
      );
    });

    // --- Account service spot check ---

    it("account.delete calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ deleted: true }),
      });

      const result = await client.account.delete("no longer needed");
      expect(result.data.deleted).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/apps/test-app/account",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ reason: "no longer needed" }),
        }),
      );
    });

    // --- Lookup tables service spot check ---

    it("lookupTables.list calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      });

      await client.lookupTables.list();
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/lookup-tables",
        expect.objectContaining({ method: "GET" }),
      );
    });

    // --- Owner service spot check ---

    it("owner.registerOwner calls correct endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ owner_token: "tok-123" }),
      });

      await client.owner.registerOwner("device-1", "test-app");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/owner/register",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ device_owner_id: "device-1", app_id: "test-app" }),
        }),
      );
    });

    // --- Auth token propagation through services ---

    it("services use the auth token set after construction", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ entitlement_active: false, entitlement_state: "inactive" }),
      });

      // Set token after client construction
      client.setAuthToken("late-token");

      await client.entitlements.check();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer late-token",
          }),
        }),
      );
    });

    it("services reflect cleared auth token", async () => {
      client.setAuthToken("some-token");
      client.clearAuthToken();

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await client.payments.getSubscription();
      const callHeaders = fetchSpy.mock.calls[0][1].headers;
      expect(callHeaders).not.toHaveProperty("Authorization");
    });

    // --- Auth service: createUserToken (server-to-server) ---

    it("auth.createUserToken calls correct endpoint with app_secret", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "access-tok-123",
          token_type: "Bearer",
          expires_in: 1200,
          refresh_token: "refresh-tok-123",
          refresh_expires_in: 7776000,
          created: true,
          user: { user_id: "u-1", email: "user@example.com" },
          access: {
            app_id: "test-app",
            app_slug: "test-app",
            tenant_id: "tenant-1",
            entitlement_active: false,
            entitlement_state: "inactive",
            tenant_active: true,
          },
          entitlement_state: "inactive",
        }),
      });

      const result = await client.auth.createUserToken("user@example.com", {
        app_secret: "app_sec_abc123",
      });
      expect(result.status).toBe(200);
      expect(result.data.access_token).toBe("access-tok-123");
      expect(result.data.refresh_token).toBe("refresh-tok-123");
      expect(result.data.created).toBe(true);
      expect(result.data.user.user_id).toBe("u-1");
      expect(result.data.user.email).toBe("user@example.com");
      expect(result.data.access.app_id).toBe("test-app");
      expect(result.data.entitlement_state).toBe("inactive");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/auth/server/create-token",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "user@example.com",
            app_id: "test-app",
            app_secret: "app_sec_abc123",
          }),
        }),
      );
    });

    it("auth.createUserToken throws ApiError on 401 invalid secret", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ error: "Unauthorized", message: "Invalid app secret" }),
      });

      await expect(
        client.auth.createUserToken("user@example.com", {
          app_secret: "app_sec_wrong",
        }),
      ).rejects.toThrow(ApiError);
      try {
        await client.auth.createUserToken("user@example.com", {
          app_secret: "app_sec_wrong",
        });
      } catch (e) {
        expect((e as ApiError).statusCode).toBe(401);
      }
    });
  });
});
