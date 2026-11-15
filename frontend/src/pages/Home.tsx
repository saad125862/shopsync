import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Page,
  ProgressBar,
  Select,
  Text,
} from "@shopify/polaris";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  api,
  type AlertRow,
  type Overview,
  type OrderRow,
  type Paged,
} from "../api";
import { ProductThumb } from "../components/ProductThumb";
import { QueryState } from "../components/QueryState";
import { useCountUp } from "../hooks/useCountUp";
import { compact, money, shortDate, timeAgo } from "../lib/format";

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="delta flat">new</span>;
  const up = pct >= 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

function Kpi({
  label,
  value,
  fmt,
  pct,
  i,
  tone,
  live,
}: {
  label: string;
  value: number;
  fmt: (n: number) => string;
  pct?: number | null;
  i: number;
  tone?: "warn" | "danger";
  live?: boolean;
}) {
  const shown = useCountUp(value);
  return (
    <div
      className={`kpi ${tone ?? ""} ${live && value > 0 ? "live" : ""}`}
      style={{ ["--i" as string]: i }}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{fmt(shown)}</div>
      {pct !== undefined && <Delta pct={pct} />}
    </div>
  );
}

export default function Home() {
  const [days, setDays] = useState("30");
  const q = useQuery({
    queryKey: ["overview", Number(days)],
    queryFn: () => api<Overview>(`/api/overview?days=${days}`),
  });
  const alerts = useQuery({
    queryKey: ["alerts", "home"],
    queryFn: () => api<Paged<AlertRow>>("/api/alerts?open=1&page_size=5"),
  });
  const orders = useQuery({
    queryKey: ["orders", "home"],
    queryFn: () => api<Paged<OrderRow>>("/api/orders?page_size=5"),
  });
  const d = q.data;
  const done = d ? d.setup.filter((s) => s.done).length : 0;
  const total = d?.setup.length ?? 0;

  return (
    <Page
      title="Home"
      subtitle={d ? `Here's what's happening at ${d.shop.replace(".myshopify.com", "")}` : ""}
      secondaryActions={[]}
    >
      <BlockStack gap="400">
        {d && done < total && (
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Setup guide
                </Text>
                <Text as="span" tone="subdued">
                  {done} of {total} steps done
                </Text>
              </InlineStack>
              <ProgressBar progress={(done / total) * 100} size="small" tone="primary" />
              <BlockStack gap="200">
                {d.setup.map((s) => (
                  <InlineStack key={s.id} gap="300" blockAlign="center" wrap={false}>
                    <span className={`check ${s.done ? "done" : ""}`} aria-hidden="true">
                      {s.done ? "✓" : ""}
                    </span>
                    <div style={{ flex: 1 }}>
                      <Text as="span" tone={s.done ? "subdued" : undefined}>
                        {s.title}
                      </Text>
                    </div>
                    {!s.done && s.link && (
                      <Link to={s.link}>
                        <Button size="slim">Open</Button>
                      </Link>
                    )}
                  </InlineStack>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        )}

        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Sales overview
          </Text>
          <div style={{ width: 160 }}>
            <Select
              label="Date range"
              labelHidden
              value={days}
              onChange={setDays}
              options={[
                { label: "Last 7 days", value: "7" },
                { label: "Last 30 days", value: "30" },
                { label: "Last 90 days", value: "90" },
              ]}
            />
          </div>
        </InlineStack>

        <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()} skeleton="cards">
          {d && (
            <BlockStack gap="400">
              <div className="kpi-grid">
                <Kpi label="Total sales" value={Number(d.revenue)} fmt={(n) => money(n, d.currency, 0)} pct={d.change.revenue} i={0} />
                <Kpi label="Orders" value={d.orders} fmt={(n) => String(Math.round(n))} pct={d.change.orders} i={1} />
                <Kpi label="Units sold" value={d.units} fmt={(n) => String(Math.round(n))} pct={d.change.units} i={2} />
                <Kpi label="Avg order value" value={Number(d.aov)} fmt={(n) => money(n, d.currency, 2)} pct={d.change.aov} i={3} />
              </div>

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Total sales over time
                  </Text>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer>
                      <AreaChart data={d.daily.map((x) => ({ ...x, revenue: Number(x.revenue) }))}>
                        <defs>
                          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#262d36" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={shortDate} stroke="#8b949e" fontSize={12} minTickGap={32} />
                        <YAxis stroke="#8b949e" fontSize={12} width={48} tickFormatter={(v) => compact(Number(v), d.currency)} />
                        <Tooltip
                          contentStyle={{ background: "#161b22", border: "1px solid #262d36", borderRadius: 8 }}
                          labelFormatter={(l) => shortDate(String(l))}
                          formatter={(v) => [money(Number(v), d.currency), "Sales"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#2dd4bf"
                          strokeWidth={2}
                          fill="url(#rev)"
                          animationDuration={1200}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </BlockStack>
              </Card>

              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingSm">
                      Top products
                    </Text>
                    {d.top_products.length === 0 && <Text as="p" tone="subdued">No sales in this period.</Text>}
                    {d.top_products.map((p, i) => (
                      <InlineStack key={p.title} gap="300" blockAlign="center" wrap={false}>
                        <span className="mono" style={{ width: 16, color: "var(--m-sub)" }}>{i + 1}</span>
                        <ProductThumb title={p.title} url={p.image_url} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {p.id ? <Link to={`/products/${p.id}`}>{p.title}</Link> : p.title}
                          <div><Text as="span" tone="subdued" variant="bodySm">{p.units} sold</Text></div>
                        </div>
                        <span className="mono">{money(p.revenue, d.currency, 0)}</span>
                      </InlineStack>
                    ))}
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text as="h3" variant="headingSm">
                        Needs attention
                      </Text>
                      <Link to="/alerts">View all</Link>
                    </InlineStack>
                    <InlineStack gap="200">
                      <Badge tone="critical">{`${d.out_of_stock} out of stock`}</Badge>
                      <Badge tone="warning">{`${d.low_stock} low stock`}</Badge>
                    </InlineStack>
                    {(alerts.data?.results ?? []).map((a) => (
                      <InlineStack key={a.id} gap="200" blockAlign="center" wrap={false}>
                        <span className={`dot ${a.level}`} aria-hidden="true" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text as="span">{a.product}</Text>{" "}
                          <Text as="span" tone="subdued">{a.variant_title}</Text>
                          <div><Text as="span" variant="bodySm" tone="subdued">{a.location_name}</Text></div>
                        </div>
                        <span className="mono">{a.available}</span>
                      </InlineStack>
                    ))}
                  </BlockStack>
                </Card>
              </InlineGrid>

              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingSm">
                      Recent orders
                    </Text>
                    <Link to="/orders">View all</Link>
                  </InlineStack>
                  {(orders.data?.results ?? []).map((o) => (
                    <InlineStack key={o.id} gap="300" blockAlign="center" wrap={false}>
                      <Link to={`/orders?open=${o.id}`}><span className="mono">{o.name}</span></Link>
                      <div style={{ flex: 1 }}>
                        <Text as="span" tone="subdued">
                          {o.item_count} items{o.created_at_shopify ? ` · ${timeAgo(o.created_at_shopify)}` : ""}
                        </Text>
                      </div>
                      <Badge tone={o.fulfillment_status === "fulfilled" ? "success" : "attention"}>
                        {o.fulfillment_status || "unfulfilled"}
                      </Badge>
                      <span className="mono">{money(o.total_price, o.currency)}</span>
                    </InlineStack>
                  ))}
                </BlockStack>
              </Card>
            </BlockStack>
          )}
        </QueryState>
      </BlockStack>
    </Page>
  );
}
