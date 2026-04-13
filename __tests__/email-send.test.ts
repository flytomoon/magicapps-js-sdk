import { describe, it, expect, vi, beforeEach } from "vitest";
import { MagicAppsClient } from "../src/client.js";

const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ message_id: "ses-abc123", status: "sent" }),
});
vi.stubGlobal("fetch", mockFetch);

describe("EmailService.send", () => {
  beforeEach(() => { mockFetch.mockClear(); });

  it("sends email with correct endpoint and body", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "jwt",
    });
    const result = await client.email.send({
      to: "user@example.com",
      token: "img_abc",
      subject: "Game result",
      senderName: "Chris C.",
    });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test/apps/app1/routines/email-send");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.to).toBe("user@example.com");
    expect(body.token).toBe("img_abc");
    expect(body.subject).toBe("Game result");
    expect(body.sender_name).toBe("Chris C.");
    expect(result.data.message_id).toBe("ses-abc123");
  });

  it("omits sender_name when not provided", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "jwt",
    });
    await client.email.send({ to: "user@example.com", token: "img_abc", subject: "Test" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sender_name).toBeUndefined();
  });

  it("uses auth fallback (bearer when no owner token)", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.test",
      appId: "app1",
      accessToken: "web-jwt",
    });
    await client.email.send({ to: "user@example.com", token: "img_abc", subject: "Test" });
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer web-jwt");
  });
});
