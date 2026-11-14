import { BlockStack, Card, InlineGrid, InlineStack, Page, Select, Text } from "@shopify/polaris";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api, type Overview } from "../api";
import { ProductThumb } from "../components/ProductThumb";
import { QueryState } from "../components/QueryState";
import { money, shortDate } from "../lib/format";

const tip = { background: "#161b22", border: "1px solid #262d36", borderRadius: 8 };

export default function Analytics() {
  const [days, setDays] = useState("30");
  const q = useQuery({
    queryKey: ["overview", Number(days)],
    queryFn: () => api<Overview>(`/api/overview?days=${days}`),
  });
  const d = q.data;
  const data = d?.daily.map((x) => ({ ...x, revenue: Number(x.revenue) })) ?? [];
  return (
    <Page
      title="Analytics"
      subtitle="Sales and orders over time"
      primaryAction={
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
      }
    >
      <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()} skeleton="cards">
        {d && (
          <BlockStack gap="400">
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Total sales
                  </Text>
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer>
                      <LineChart data={data}>
                        <CartesianGrid stroke="#262d36" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={shortDate} stroke="#8b949e" fontSize={12} minTickGap={32} />
                        <YAxis stroke="#8b949e" fontSize={12} width={48} tickFormatter={(v) => `$${v}`} />
                        <Tooltip
                          contentStyle={tip}
                          labelFormatter={(l) => shortDate(String(l))}
                          formatter={(v) => [money(Number(v)), "Sales"]}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="#2dd4bf" strokeWidth={2} dot={false} animationDuration={1200} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Orders
                  </Text>
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer>
                      <BarChart data={data}>
                        <CartesianGrid stroke="#262d36" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={shortDate} stroke="#8b949e" fontSize={12} minTickGap={32} />
                        <YAxis stroke="#8b949e" fontSize={12} width={32} allowDecimals={false} />
                        <Tooltip contentStyle={tip} labelFormatter={(l) => shortDate(String(l))} />
                        <Bar dataKey="orders" fill="#2dd4bf" radius={[3, 3, 0, 0]} animationDuration={900} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </BlockStack>
              </Card>
            </InlineGrid>
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Best-selling products
                </Text>
                {d.top_products.map((p, i) => (
                  <InlineStack key={p.title} gap="300" blockAlign="center" wrap={false}>
                    <span className="mono sub" style={{ width: 16 }}>{i + 1}</span>
                    <ProductThumb title={p.title} url={p.image_url} size={32} />
                    <span style={{ flex: 1 }}>{p.title}</span>
                    <span className="mono sub">{p.units} units</span>
                    <span className="mono">{money(p.revenue, "USD", 0)}</span>
                  </InlineStack>
                ))}
                {d.top_products.length === 0 && <Text as="p" tone="subdued">No sales in this period.</Text>}
              </BlockStack>
            </Card>
          </BlockStack>
        )}
      </QueryState>
    </Page>
  );
}
