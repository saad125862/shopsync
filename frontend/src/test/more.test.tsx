import { AppProvider } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductThumb } from "../components/ProductThumb";
import { useCountUp } from "../hooks/useCountUp";
import { hueFor, money, stockText, timeAgo } from "../lib/format";
import Products from "../pages/Products";

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

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

describe("format helpers", () => {
  it("formats money and stock text", () => {
    expect(money(1234.5)).toBe("$1,234.50");
    expect(money("49", "USD", 0)).toBe("$49");
    expect(stockText(87, 3)).toBe("87 in stock for 3 variants");
    expect(stockText(5, 1)).toBe("5 in stock");
  });
  it("is stable for hues and relative time", () => {
    expect(hueFor("Hoodie")).toBe(hueFor("Hoodie"));
    expect(timeAgo("2026-01-01T11:30:00Z", Date.parse("2026-01-01T12:00:00Z"))).toBe("30m ago");
  });
});

describe("ProductThumb", () => {
  it("shows the first letter when there is no image", () => {
    render(<ProductThumb title="hoodie" />);
    expect(screen.getByText("H")).toBeInTheDocument();
  });
  it("renders the image when given a url", () => {
    const { container } = render(<ProductThumb title="x" url="https://img/x.png" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://img/x.png");
  });
});

describe("useCountUp", () => {
  it("reaches the target", async () => {
    const { result } = renderHook(() => useCountUp(100, 50));
    await waitFor(() => expect(Math.round(result.current)).toBe(100), { timeout: 1500 });
  });
  it("jumps straight to the target with reduced motion", async () => {
    const mm = vi.spyOn(window, "matchMedia").mockImplementation(
      (q) => ({ matches: true, media: q }) as MediaQueryList,
    );
    const { result } = renderHook(() => useCountUp(42));
    await act(async () => {});
    expect(result.current).toBe(42);
    mm.mockRestore();
  });
});

describe("Products page", () => {
  afterEach(() => vi.restoreAllMocks());
  it("lists products with Shopify-style stock text", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      json({
        count: 1,
        next: null,
        previous: null,
        vendors: ["Capital Caps"],
        results: [
          {
            id: 1,
            title: "Baseball Cap",
            vendor: "Capital Caps",
            status: "active",
            image_url: "",
            variants_count: 3,
            total_available: 87,
            out_levels: 0,
            low_levels: 0,
            stock: "ok",
          },
        ],
      }),
    );
    wrap(<Products />);
    await waitFor(() => expect(screen.getByText("Baseball Cap")).toBeInTheDocument());
    expect(screen.getByText("87 in stock for 3 variants")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });
});
