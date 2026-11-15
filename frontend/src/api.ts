import { getDevToken, getStoredToken, isEmbedded } from "./lib/auth";

declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

const BASE = import.meta.env.VITE_API_URL ?? "";

/** Session token: App Bridge inside the Shopify admin, a dev token when running standalone. */
export async function getToken(): Promise<string> {
  // Embedded in Shopify admin: App Bridge loads asynchronously, so wait for it (up to ~5s).
  if (isEmbedded()) {
    for (let i = 0; i < 50 && !window.shopify?.idToken; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  // Outside Shopify admin App Bridge cannot issue tokens, so only trust it when embedded.
  if (isEmbedded() && window.shopify?.idToken) return window.shopify.idToken();
  return getStoredToken() ?? getDevToken();
}

/** Where to send a merchant who opened the app before it was installed (OAuth entry point). */
export function installRedirectUrl(search: string, base = BASE): string | null {
  const params = new URLSearchParams(search);
  if (!params.get("shop")) return null;
  return `${base}/auth/install?${params.toString()}`;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 401 && detail === "Shop not installed") {
      const url = installRedirectUrl(window.location.search);
      if (url) window.open(url, "_top");
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export interface Paged<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type StockStatus = "ok" | "low" | "out";

export interface InventoryRow {
  id: number;
  product: string;
  image_url: string;
  variant_title: string;
  sku: string;
  location: number;
  location_name: string;
  available: number;
  threshold: number;
  status: StockStatus;
}


export interface AlertRow {
  id: number;
  product: string;
  variant_title: string;
  sku: string;
  location_name: string;
  level: "low" | "out";
  available: number;
  threshold: number;
  created_at: string;
}

export interface SyncLogRow {
  id: number;
  kind: string;
  status: "running" | "ok" | "failed";
  detail: string;
  started_at: string;
  finished_at: string | null;
}


export interface LocationRow {
  id: number;
  name: string;
}

export interface Settings {
  low_stock_threshold: number;
  alert_email: string;
}

export interface OrderRow {
  id: number;
  name: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string;
  created_at_shopify: string | null;
  item_count: number;
  items: { title: string; sku: string; quantity: number; price: string }[];
  subtotal?: string;
}

export interface TopProduct {
  id: number | null;
  title: string;
  image_url: string;
  units: number;
  revenue: string | number;
}

export interface SetupStep {
  id: string;
  title: string;
  done: boolean;
  link?: string;
}

export interface Change {
  orders: number | null;
  revenue: number | null;
  units: number | null;
  aov: number | null;
}

export interface Overview {
  days: number;
  shop: string;
  products: number;
  variants: number;
  low_stock: number;
  out_of_stock: number;
  orders: number;
  revenue: string | number;
  units: number;
  aov: string | number;
  change: Change;
  last_sync: string | null;
  daily: { date: string; orders: number; revenue: string | number }[];
  top_products: TopProduct[];
  setup: SetupStep[];
}

export interface ProductRow {
  id: number;
  title: string;
  vendor: string;
  status: string;
  image_url: string;
  variants_count: number;
  total_available: number;
  out_levels: number;
  low_levels: number;
  stock: StockStatus;
}

export interface ProductList extends Paged<ProductRow> {
  vendors: string[];
}

export interface ProductLevel {
  id: number;
  location_name: string;
  available: number;
  threshold: number;
  status: StockStatus;
}

export interface ProductDetail {
  id: number;
  title: string;
  vendor: string;
  status: string;
  image_url: string;
  total_available: number;
  units_sold: number;
  variants: {
    id: number;
    title: string;
    sku: string;
    price: string;
    available: number;
    levels: ProductLevel[];
  }[];
}

export interface SearchResults {
  products: { id: number; title: string; image_url: string; vendor: string }[];
  orders: { id: number; name: string; total_price: string; currency: string }[];
}
