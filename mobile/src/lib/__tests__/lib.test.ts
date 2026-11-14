import { api, ApiError, normalizeUrl } from "../api";
import { money, STATUS_LABEL, timeAgo } from "../format";

describe("format", () => {
  it("formats money", () => {
    expect(money("12.5", "USD")).toBe("12.50 USD");
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
