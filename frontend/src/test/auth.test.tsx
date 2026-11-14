import { AppProvider } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import { getStoredToken, login, logout } from "../lib/auth";
import Connect from "../pages/Connect";

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("auth storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("stores the token on login and clears it on logout", () => {
    login("  abc  ");
    expect(getStoredToken()).toBe("abc");
    logout();
    expect(getStoredToken()).toBeNull();
  });

  it("sends the stored token with API calls", async () => {
    login("stored-token");
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(() => json({}));
    await api("/api/x");
    const headers = (f.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer stored-token");
    vi.restoreAllMocks();
  });
});

describe("Connect page", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  function setup(onDone = vi.fn()) {
    render(
      <AppProvider i18n={en}>
        <Connect onDone={onDone} />
      </AppProvider>,
    );
    return onDone;
  }

  it("signs in when the API accepts the code", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => json({ low_stock_threshold: 5 }));
    const onDone = setup();
    fireEvent.change(screen.getByLabelText("Link code"), { target: { value: "good" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(getStoredToken()).toBe("good");
  });

  it("shows an error and keeps you signed out when the code is rejected", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      json({ detail: "Invalid session token" }, 401),
    );
    const onDone = setup();
    fireEvent.change(screen.getByLabelText("Link code"), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByText("Invalid session token")).toBeInTheDocument());
    expect(onDone).not.toHaveBeenCalled();
    expect(getStoredToken()).toBeNull();
  });
});
