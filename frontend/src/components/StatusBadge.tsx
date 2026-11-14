import { Badge } from "@shopify/polaris";

import type { StockStatus } from "../api";

const MAP: Record<StockStatus, { tone: "success" | "warning" | "critical"; label: string }> = {
  ok: { tone: "success", label: "In stock" },
  low: { tone: "warning", label: "Low stock" },
  out: { tone: "critical", label: "Out of stock" },
};

export function StatusBadge({ status }: { status: StockStatus }) {
  const { tone, label } = MAP[status];
  return <Badge tone={tone}>{label}</Badge>;
}
