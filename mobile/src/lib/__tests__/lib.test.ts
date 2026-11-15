import { api, ApiError, demoLogin, normalizeUrl } from "../api";
import { greeting, money, STATUS_LABEL, stockText, timeAgo } from "../format";

describe("format", () => {
  it("formats money", () => {
    expect(money("12.5", "USD")).toBe("$12.50");
    expect(money(1234, "USD", 0)).toBe("$1,234");
    expect(money(2150, "BDT", 0)).toBe("\u09F32,150");
    expect(money(5, "XYZ")).toBe("5.00 XYZ");
  });
  it("describes stock like Shopify", () => {
    expect(stockText(87, 3)).toBe("87 in stock for 3 variants");
    expect(stockText(2, 1)).toBe("2 in stock");
  });
  it("greets by time of day", () => {
    expect(greeting(8)).toBe("Good morning");
    expect(greeting(14)).toBe("Good afternoon");
    expect(greeting(20)).toBe("Good evening");
  });
  it("formats relative time", () => {
    const now = Date.parse("2026-01-01T12:00:00Z");
    expect(timeAgo("2026-01-01T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-01-01T11:30:00Z", now)).toBe("30m ago");
    expect(timeAgo("2026-01-01T09:00:00Z", now)).toBe("3h ago");
    expect(timeAgo("2025-12-30T12:00:00Z", now)).toBe("2d ago");
  });
  it("labels every status", () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(["low", "ok", "out"]);
  });
});

describe("api", () => {
  const session = { apiUrl: "https://api.example.com/", token: "tok" };
  afterEach(() => jest.restoreAllMocks());

  it("normalizes urls", () => {
    expect(normalizeUrl(" https://x.com/// ")).toBe("https://x.com");
  });

  it("sends the bearer token to the normalized url", async () => {
    const f = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    await api("/api/settings", {}, session);
    expect(f.mock.calls[0][0]).toBe("https://api.example.com/api/settings");
    const headers = (f.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
  });

  it("throws ApiError with the server detail", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ detail: "nope" }), { status: 502 }));
    await expect(api("/x", {}, session)).rejects.toMatchObject({ status: 502, message: "nope" });
  });

  it("fails fast when not connected", async () => {
    await expect(api("/x", {}, null)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("demoLogin", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns a read-only demo session for the given API", async () => {
    const f = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ token: "demo-token" })));
    const s = await demoLogin(" https://api.example.com/ ");
    expect(f.mock.calls[0][0]).toBe("https://api.example.com/api/demo-login");
    expect((f.mock.calls[0][1] as RequestInit).method).toBe("POST");
    expect(s).toEqual({ apiUrl: "https://api.example.com", token: "demo-token", demo: true });
  });

  it("explains when the demo is unavailable", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ detail: "Demo is not available." }), { status: 404 }));
    await expect(demoLogin("https://x.com")).rejects.toMatchObject({
      status: 404,
      message: "Demo is not available.",
    });
  });

  it("gives a friendly message when the network is down", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network request failed"));
    await expect(demoLogin("https://x.com")).rejects.toMatchObject({ status: 0 });
  });
});
