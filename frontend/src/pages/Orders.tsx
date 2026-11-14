import {
  Badge,
  BlockStack,
  Card,
  IndexTable,
  InlineStack,
  Modal,
  Page,
  Pagination,
  Tabs,
  Text,
  TextField,
} from "@shopify/polaris";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api, type OrderRow, type Paged } from "../api";
import { QueryState } from "../components/QueryState";
import { money } from "../lib/format";

const TABS = [
  { id: "all", content: "All", status: "" },
  { id: "unfulfilled", content: "Unfulfilled", status: "unfulfilled" },
  { id: "fulfilled", content: "Fulfilled", status: "fulfilled" },
  { id: "paid", content: "Paid", status: "paid" },
] as const;

function OrderModal({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["order", id],
    queryFn: () => api<OrderRow>(`/api/orders/${id}`),
  });
  const o = q.data;
  return (
    <Modal open onClose={onClose} title={o ? `Order ${o.name}` : "Order"} size="large">
      <Modal.Section>
        <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()}>
          {o && (
            <BlockStack gap="400">
              <InlineStack gap="200">
                <Badge tone={o.financial_status === "paid" ? "success" : "attention"}>
                  {o.financial_status || "unknown"}
                </Badge>
                <Badge tone={o.fulfillment_status === "fulfilled" ? "success" : "attention"}>
                  {o.fulfillment_status || "unfulfilled"}
                </Badge>
                {o.created_at_shopify && (
                  <Text as="span" tone="subdued">
                    {new Date(o.created_at_shopify).toLocaleString()}
                  </Text>
                )}
              </InlineStack>
              <div>
                {o.items.map((li, i) => (
                  <div key={i} className="line-item">
                    <span style={{ flex: 1 }}>
                      {li.title}
                      <div className="mono sub">{li.sku}</div>
                    </span>
                    <span className="mono sub">
                      {money(li.price, o.currency)} × {li.quantity}
                    </span>
                    <span className="mono">{money(Number(li.price) * li.quantity, o.currency)}</span>
                  </div>
                ))}
              </div>
              <InlineStack align="end">
                <BlockStack gap="100" inlineAlign="end">
                  <Text as="span" tone="subdued">
                    Subtotal {money(o.subtotal ?? 0, o.currency)}
                  </Text>
                  <Text as="span" variant="headingMd">
                    Total {money(o.total_price, o.currency)}
                  </Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          )}
        </QueryState>
      </Modal.Section>
    </Modal>
  );
}

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const open = params.get("open") ? Number(params.get("open")) : null;
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const qs = new URLSearchParams({ page: String(page), page_size: "25" });
  if (TABS[tab].status) qs.set("status", TABS[tab].status);
  if (debounced) qs.set("q", debounced);

  const q = useQuery({
    queryKey: ["orders", qs.toString()],
    queryFn: () => api<Paged<OrderRow>>(`/api/orders?${qs}`),
    placeholderData: keepPreviousData,
  });
  const close = () => {
    params.delete("open");
    setParams(params, { replace: true });
  };

  return (
    <Page title="Orders" subtitle={q.data ? `${q.data.count} orders` : undefined}>
      <Card padding="0">
        <Tabs
          tabs={TABS.map((t) => ({ id: t.id, content: t.content }))}
          selected={tab}
          onSelect={(i) => {
            setTab(i);
            setPage(1);
          }}
        />
        <div style={{ padding: 12 }}>
          <TextField
            label="Search orders"
            labelHidden
            placeholder="Search by order number, e.g. #1001"
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearch("")}
          />
        </div>
        <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()}>
          {q.data && q.data.results.length === 0 ? (
            <div className="empty">
              <Text as="h3" variant="headingMd">
                No orders found
              </Text>
              <p>Orders appear here as soon as customers check out.</p>
            </div>
          ) : (
            <BlockStack>
              <IndexTable
                resourceName={{ singular: "order", plural: "orders" }}
                itemCount={q.data?.count ?? 0}
                selectable={false}
                headings={[
                  { title: "Order" },
                  { title: "Date" },
                  { title: "Items", alignment: "end" },
                  { title: "Payment" },
                  { title: "Fulfillment" },
                  { title: "Total", alignment: "end" },
                ]}
              >
                {(q.data?.results ?? []).map((o, i) => (
                  <IndexTable.Row
                    id={String(o.id)}
                    key={o.id}
                    position={i}
                    onClick={() => setParams({ open: String(o.id) })}
                  >
                    <IndexTable.Cell>
                      <span className="mono strong">{o.name}</span>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {o.created_at_shopify ? new Date(o.created_at_shopify).toLocaleDateString() : "-"}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <span className="mono">{o.item_count}</span>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={o.financial_status === "paid" ? "success" : "attention"}>
                        {o.financial_status || "unknown"}
                      </Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={o.fulfillment_status === "fulfilled" ? "success" : "attention"}>
                        {o.fulfillment_status || "unfulfilled"}
                      </Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <span className="mono">{money(o.total_price, o.currency)}</span>
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
                />
              </div>
            </BlockStack>
          )}
        </QueryState>
      </Card>
      {open && <OrderModal id={open} onClose={close} />}
    </Page>
  );
}
