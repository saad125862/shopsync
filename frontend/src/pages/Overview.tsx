import { BlockStack, Card, InlineGrid, Page, Text } from "@shopify/polaris";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api, type Overview as OverviewData } from "../api";
import { QueryState } from "../components/QueryState";

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "caution" | "critical";
}) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="heading2xl" tone={tone}>
          {value}
        </Text>
      </BlockStack>
    </Card>
  );
}

export default function Overview() {
  const q = useQuery({ queryKey: ["overview"], queryFn: () => api<OverviewData>("/api/overview") });
  const d = q.data;
  return (
    <Page title="Overview">
      <QueryState isLoading={q.isLoading} error={q.error}>
        {d && (
          <BlockStack gap="400">
            <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
              <Kpi label="Products" value={d.products} />
              <Kpi label="Low stock" value={d.low_stock} tone={d.low_stock ? "caution" : undefined} />
              <Kpi
                label="Out of stock"
                value={d.out_of_stock}
                tone={d.out_of_stock ? "critical" : undefined}
              />
              <Kpi label="Orders (30d)" value={d.orders_30d} />
            </InlineGrid>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Revenue, last 30 days
                </Text>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <AreaChart data={d.daily.map((x) => ({ ...x, revenue: Number(x.revenue) }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="revenue" stroke="#008060" fill="#b4e1d1" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <Text as="p" tone="subdued">
                  Last sync: {d.last_sync ? new Date(d.last_sync).toLocaleString() : "never"}
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        )}
      </QueryState>
    </Page>
  );
}
