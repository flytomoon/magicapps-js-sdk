import { describe, it, expect, vi, afterEach } from "vitest";
import { MagicAppsClient } from "../src/client.js";

describe("getAllDevices", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns flat array of devices from catalog", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.example.com",
      appId: "test-app",
    });
    const devices = [
      { device_name: "Device A", device_id: "d1" },
      { device_name: "Device B", device_id: "d2" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ devices, count: 2 }),
      }),
    );

    const result = await client.getAllDevices();
    expect(result).toEqual(devices);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when catalog has no devices", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.example.com",
      appId: "test-app",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ devices: [], count: 0 }),
      }),
    );

    const result = await client.getAllDevices();
    expect(result).toEqual([]);
  });

  it("returns empty array when devices field is missing/null", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.example.com",
      appId: "test-app",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      }),
    );

    const result = await client.getAllDevices();
    expect(result).toEqual([]);
  });

  it("calls GET /apps/{app_id}/devices", async () => {
    const client = new MagicAppsClient({
      baseUrl: "https://api.example.com",
      appId: "my-app",
    });
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ devices: [] }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await client.getAllDevices();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.com/apps/my-app/devices",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
