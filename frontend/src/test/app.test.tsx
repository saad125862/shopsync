import { AppProvider } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import Inventory from "../pages/Inventory";

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AppProvider i18n={en}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AppProvider>
    </QueryClientProvider>,
  );
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("api()", () => {
  beforeEach(() => {
    delete (window as Window).shopify;
  });
  afterEach(() => vi.restoreAllMocks());

  it("uses the App Bridge session token when embedded", async () => {
    window.shopify = { idToken: async () => "abc" };
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(() => json({ ok: 1 }));
    await api("/api/x");
    const headers = (f.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer abc");
  });

  it("throws ApiError with the server's detail", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => json({ detail: "nope" }, 502));
    await expect(api("/api/x")).rejects.toMatchObject({ status: 502, message: "nope" });
    expect(new ApiError(1, "m")).toBeInstanceOf(Error);
  });
});

describe("StatusBadge", () => {
  it.each([
    ["ok", "In stock"],
    ["low", "Low stock"],
    ["out", "Out of stock"],
  ] as const)("renders %s", (status, label) => {
    wrap(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("Inventory page", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists rows from the API", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/api/locations")) return json([{ id: 1, name: "Dhaka" }]);
      return json({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 1,
            product: "Hoodie",
            image_url: "",
            variant_title: "M / Black",
            sku: "HD-M-BLK",
            location: 1,
            location_name: "Dhaka",
            available: 3,
            threshold: 5,
            status: "low",
          },
        ],
      });
    });
    wrap(<Inventory />);
    await waitFor(() => expect(screen.getByText("Hoodie")).toBeInTheDocument());
    expect(screen.getByText("HD-M-BLK")).toBeInTheDocument();
    // once in the status filter option, once as the row badge
    expect(screen.getAllByText("Low stock")).toHaveLength(2);
  });

  it("shows an error banner when the API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => json({ detail: "boom" }, 500));
    wrap(<Inventory />);
    await waitFor(() => expect(screen.getByText("Couldn't load this page")).toBeInTheDocument());
  });
});
