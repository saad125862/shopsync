import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import en from "@shopify/polaris/locales/en.json";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link } from "react-router-dom";

import App from "./App";
import "./theme.css";

// Load App Bridge only when embedded in the Shopify admin iframe.
if (window.top !== window.self) {
  const s = document.createElement("script");
  s.src = "https://cdn.shopify.com/shopifycloud/app-bridge.js";
  document.head.appendChild(s);
}

/** Lets Polaris navigation/links use client-side routing instead of full page loads. */
function RouterLink({
  url,
  children,
  external,
  ...rest
}: {
  url: string;
  children?: ReactNode;
  external?: boolean;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (external || /^https?:/.test(url)) {
    return (
      <a href={url} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link to={url} {...rest}>
      {children}
    </Link>
  );
}

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <AppProvider i18n={en} linkComponent={RouterLink}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
