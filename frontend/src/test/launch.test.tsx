import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

function mount() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AppProvider i18n={en}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </AppProvider>
    </QueryClientProvider>,
  );
}

describe("Shopify launch", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("sends a signed-out Shopify launch to the API install step", () => {
    vi.stubEnv("VITE_DEV_TOKEN", ""); // a local dev token would count as signed in
    const replace = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, search: "?shop=a.myshopify.com&hmac=abc", replace },
      configurable: true,
    });
    mount();
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("/auth/install?shop=a.myshopify.com&hmac=abc"));
  });
});
