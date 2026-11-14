import { Badge, Card, IndexTable, Page, Text } from "@shopify/polaris";
import { useQuery } from "@tanstack/react-query";

import { api, type AlertRow, type Paged } from "../api";
import { QueryState } from "../components/QueryState";
import { timeAgo } from "../lib/format";

export default function Alerts() {
  const q = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api<Paged<AlertRow>>("/api/alerts?open=1&page_size=100"),
  });
  const rows = q.data?.results ?? [];
  return (
    <Page title="Alerts" subtitle="Open low-stock and out-of-stock alerts">
      <Card padding="0">
        <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()}>
          {rows.length === 0 ? (
            <div className="empty">
              <div className="ok-ring">✓</div>
              <Text as="h3" variant="headingMd">
                All stocked up
              </Text>
              <p>Nothing is below its threshold right now.</p>
            </div>
          ) : (
            <IndexTable
              resourceName={{ singular: "alert", plural: "alerts" }}
              itemCount={rows.length}
              selectable={false}
              headings={[
                { title: "Level" },
                { title: "Product" },
                { title: "Variant" },
                { title: "Location" },
                { title: "Left / threshold", alignment: "end" },
                { title: "Since" },
              ]}
            >
              {rows.map((a, i) => (
                <IndexTable.Row id={String(a.id)} key={a.id} position={i}>
                  <IndexTable.Cell>
                    <Badge tone={a.level === "out" ? "critical" : "warning"}>
                      {a.level === "out" ? "Out of stock" : "Low stock"}
                    </Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" fontWeight="semibold">
                      {a.product}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{a.variant_title}</IndexTable.Cell>
                  <IndexTable.Cell>{a.location_name}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <span className="mono">
                      {a.available} / {a.threshold}
                    </span>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{timeAgo(a.created_at)}</IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          )}
        </QueryState>
      </Card>
    </Page>
  );
}
