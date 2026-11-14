import type { StockStatus } from "./api";

export const STATUS_LABEL: Record<StockStatus, string> = {
  ok: "In stock",
  low: "Low stock",
  out: "Out of stock",
};

export const STATUS_COLOR: Record<StockStatus, string> = {
  ok: "#1a7f4b",
  low: "#b45309",
  out: "#c0262d",
};

export function money(amount: string | number, currency: string): string {
  return `${Number(amount).toFixed(2)} ${currency}`.trim();
}

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
