import { Badge, BlockStack, Card, InlineGrid, InlineStack, Page, Text } from "@shopify/polaris";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { api, type ProductDetail, type StockStatus } from "../api";
import { ProductThumb } from "../components/ProductThumb";
import { QueryState } from "../components/QueryState";
import { useAdjust } from "../hooks/useAdjust";
import { money } from "../lib/format";

const LABEL: Record<StockStatus, string> = { ok: "In stock", low: "Low stock", out: "Out of stock" };
const TONE = { ok: "success", low: "warning", out: "critical" } as const;

export default function ProductDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { adjust, busy } = useAdjust();
  const q = useQuery({
    queryKey: ["product", id],
    queryFn: () => api<ProductDetail>(`/api/products/${id}`),
  });
  const p = q.data;

  return (
    <Page
      backAction={{ content: "Products", onAction: () => nav("/products") }}
      title={p?.title ?? "Product"}
      titleMetadata={p && <Badge tone={p.status === "active" ? "success" : "info"}>{p.status}</Badge>}
      subtitle={p?.vendor}
    >
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()}>
        {p && (
          <BlockStack gap="400">
            <InlineGrid columns={{ xs: 1, md: ["twoThirds", "oneThird"] }} gap="400">
              <Card>
                <InlineStack gap="400" blockAlign="center" wrap={false}>
                  <ProductThumb title={p.title} url={p.image_url} size={96} />
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      {p.title}
                    </Text>
                    <Text as="p" tone="subdued">
                      {p.variants.length} variants
                      {p.variants[0] ? ` · from ${money(Math.min(...p.variants.map((v) => Number(v.price))))}` : ""}
                    </Text>
                  </BlockStack>
                </InlineStack>
              </Card>
              <Card>
                <InlineGrid columns={2} gap="400">
                  <BlockStack gap="050">
                    <Text as="span" tone="subdued" variant="bodySm">In stock</Text>
                    <span className="kpi-value" style={{ fontSize: 26 }}>{p.total_available}</span>
                  </BlockStack>
                  <BlockStack gap="050">
                    <Text as="span" tone="subdued" variant="bodySm">Units sold</Text>
                    <span className="kpi-value" style={{ fontSize: 26 }}>{p.units_sold}</span>
                  </BlockStack>
                </InlineGrid>
              </Card>
            </InlineGrid>

            <Card padding="0">
              <div style={{ padding: 16 }}>
                <Text as="h3" variant="headingSm">
                  Variants and inventory
                </Text>
              </div>
              <div className="var-table" role="table">
                {p.variants.map((v) => (
                  <div key={v.id} className="var-block" role="rowgroup">
                    <div className="var-head" role="row">
                      <span style={{ flex: 1 }}>
                        <strong>{v.title}</strong> <span className="mono sub">{v.sku}</span>
                      </span>
                      <span className="mono">{money(v.price)}</span>
                      <span className="mono sub">{v.available} total</span>
                    </div>
                    {v.levels.map((lv) => (
                      <div key={lv.id} className="var-row" role="row">
                        <span style={{ flex: 1 }}>{lv.location_name}</span>
                        <Badge tone={TONE[lv.status]}>{LABEL[lv.status]}</Badge>
                        <span className="mono qty">{lv.available}</span>
                        <span className="stepper" role="group" aria-label={`Adjust ${v.sku} at ${lv.location_name}`}>
                          {[-10, -1, 1, 10].map((d) => (
                            <button
                              key={d}
                              disabled={busy === lv.id || lv.available + d < 0}
                              onClick={() => adjust(lv.id, d, `${v.sku} @ ${lv.location_name}`)}
                              aria-label={`${d > 0 ? "Add" : "Remove"} ${Math.abs(d)}`}
                            >
                              {d > 0 ? `+${d}` : d}
                            </button>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          </BlockStack>
        )}
      </QueryState>
    </Page>
  );
}
