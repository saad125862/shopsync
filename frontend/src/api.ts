declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

const BASE = import.meta.env.VITE_API_URL ?? "";

/** Session token: App Bridge inside the Shopify admin, a dev token when running standalone. */
export async function getToken(): Promise<string> {
  if (window.shopify?.idToken) return window.shopify.idToken();
  return import.meta.env.VITE_DEV_TOKEN ?? "";
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

export interface OrderRow {
  id: number;
  name: string;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string;
  created_at_shopify: string | null;
  items: { title: string; sku: string; quantity: number }[];
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

export interface Overview {
  products: number;
  variants: number;
  low_stock: number;
  out_of_stock: number;
  orders_30d: number;
  revenue_30d: string | number;
  last_sync: string | null;
  daily: { date: string; orders: number; revenue: string | number }[];
}

export interface LocationRow {
  id: number;
  name: string;
}

export interface Settings {
  low_stock_threshold: number;
  alert_email: string;
}
