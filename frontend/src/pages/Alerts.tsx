import { Badge, Card, EmptyState, IndexTable, Page, Text } from "@shopify/polaris";
import { useQuery } from "@tanstack/react-query";

import { api, type AlertRow, type Paged } from "../api";
import { QueryState } from "../components/QueryState";

export default function Alerts() {
  const q = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api<Paged<AlertRow>>("/api/alerts?open=1&page_size=100"),
  });
  const rows = q.data?.results ?? [];
  return (
    <Page title="Alerts" subtitle="Open low-stock and out-of-stock alerts">
      <QueryState isLoading={q.isLoading} error={q.error}>
        <Card padding="0">
          {rows.length === 0 ? (
            <EmptyState heading="No open alerts" image="">
              <p>Everything is above its stock threshold.</p>
            </EmptyState>
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
                { title: "Left", alignment: "end" },
                { title: "Since" },
              ]}
            >
              {rows.map((a, i) => (
                <IndexTable.Row id={String(a.id)} key={a.id} position={i}>
                  <IndexTable.Cell>
                    <Badge tone={a.level === "out" ? "critical" : "warning"}>
                      {a.level === "out" ? "Out" : "Low"}
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
                    <Text as="span" alignment="end" numeric>
                      {a.available} / {a.threshold}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{new Date(a.created_at).toLocaleString()}</IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          )}
        </Card>
      </QueryState>
    </Page>
  );
}
