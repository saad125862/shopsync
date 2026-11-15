import { theme } from "./theme";
import type { StockStatus } from "./api";

export const STATUS_LABEL: Record<StockStatus, string> = {
  ok: "In stock",
  low: "Low stock",
  out: "Out of stock",
};

export const STATUS_COLOR: Record<StockStatus, string> = {
  ok: theme.ok,
  low: theme.warn,
  out: theme.danger,
};

const SYMBOLS: Record<string, string> = { USD: "$", BDT: "\u09F3", EUR: "\u20AC", GBP: "\u00A3" };

export function money(amount: string | number, currency = "USD", digits = 2): string {
  const n = Number(amount) || 0;
  const body = n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const symbol = SYMBOLS[currency];
  return symbol ? `${symbol}${body}` : `${body} ${currency}`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function hueFor(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function stockText(total: number, variants: number): string {
  return `${total} in stock${variants > 1 ? ` for ${variants} variants` : ""}`;
}

export function greeting(hour = new Date().getHours()): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
