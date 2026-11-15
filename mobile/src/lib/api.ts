export interface Session {
  apiUrl: string;
  token: string;
}

let current: Session | null = null;

export function setCurrentSession(s: Session | null) {
  current = s;
}

export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}, session = current): Promise<T> {
  if (!session) throw new ApiError(401, "Not connected");
  const res = await fetch(`${normalizeUrl(session.apiUrl)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
      ...init.headers,
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* non-JSON body */
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

export interface ProductRow {
  id: number;
  title: string;
  vendor: string;
  status: string;
  image_url: string;
  variants_count: number;
  total_available: number;
  stock: StockStatus;
}

export interface ProductDetail {
  id: number;
  currency: string;
  title: string;
  vendor: string;
  status: string;
  total_available: number;
  units_sold: number;
  variants: {
    id: number;
    title: string;
    sku: string;
    price: string;
    available: number;
    levels: {
      id: number;
      location_name: string;
      available: number;
      threshold: number;
      status: StockStatus;
    }[];
  }[];
}

export interface Settings {
  low_stock_threshold: number;
  alert_email: string;
}

export interface Overview {
  days: number;
  shop: string;
  currency: string;
  products: number;
  low_stock: number;
  out_of_stock: number;
  orders: number;
  revenue: string | number;
  units: number;
  aov: string | number;
  change: { orders: number | null; revenue: number | null; units: number | null; aov: number | null };
  daily: { date: string; orders: number; revenue: string | number }[];
  top_products: { id: number | null; title: string; units: number; revenue: string | number }[];
  setup: { id: string; title: string; done: boolean }[];
}
