import { Badge, Card, IndexTable, Page, Pagination, Text } from "@shopify/polaris";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api, type OrderRow, type Paged } from "../api";
import { QueryState } from "../components/QueryState";

export default function Orders() {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["orders", page],
    queryFn: () => api<Paged<OrderRow>>(`/api/orders?page=${page}`),
    placeholderData: keepPreviousData,
  });
  return (
    <Page title="Orders">
      <QueryState isLoading={q.isLoading} error={q.error}>
        <Card padding="0">
          <IndexTable
            resourceName={{ singular: "order", plural: "orders" }}
            itemCount={q.data?.count ?? 0}
            selectable={false}
            headings={[
              { title: "Order" },
              { title: "Date" },
              { title: "Items" },
              { title: "Payment" },
              { title: "Fulfillment" },
              { title: "Total", alignment: "end" },
            ]}
          >
            {(q.data?.results ?? []).map((o, i) => (
              <IndexTable.Row id={String(o.id)} key={o.id} position={i}>
                <IndexTable.Cell>
                  <Text as="span" fontWeight="semibold">
                    {o.name}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  {o.created_at_shopify ? new Date(o.created_at_shopify).toLocaleDateString() : "-"}
                </IndexTable.Cell>
                <IndexTable.Cell>{o.items.reduce((n, l) => n + l.quantity, 0)}</IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={o.financial_status === "paid" ? "success" : "attention"}>
                    {o.financial_status || "unknown"}
                  </Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={o.fulfillment_status === "fulfilled" ? "success" : "info"}>
                    {o.fulfillment_status || "unfulfilled"}
                  </Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" alignment="end" numeric>
                    {Number(o.total_price).toFixed(2)} {o.currency}
                  </Text>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
          <div style={{ padding: 12, display: "flex", justifyContent: "center" }}>
            <Pagination
              hasPrevious={!!q.data?.previous}
              hasNext={!!q.data?.next}
              onPrevious={() => setPage((p) => p - 1)}
              onNext={() => setPage((p) => p + 1)}
              label={`${q.data?.count ?? 0} orders`}
            />
          </div>
        </Card>
      </QueryState>
    </Page>
  );
}
