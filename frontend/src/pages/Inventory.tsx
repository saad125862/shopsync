import {
  BlockStack,
  Card,
  IndexTable,
  InlineStack,
  Page,
  Pagination,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api, type InventoryRow, type LocationRow, type Paged } from "../api";
import { QueryState } from "../components/QueryState";
import { StatusBadge } from "../components/StatusBadge";
import { useAdjust } from "../hooks/useAdjust";

export default function Inventory() {
  const { adjust, busy } = useAdjust();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), page_size: "25" });
  if (debounced) params.set("q", debounced);
  if (status) params.set("status", status);
  if (location) params.set("location", location);

  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: () => api<LocationRow[]>("/api/locations"),
  });
  const q = useQuery({
    queryKey: ["inventory", params.toString()],
    queryFn: () => api<Paged<InventoryRow>>(`/api/inventory?${params}`),
    placeholderData: keepPreviousData,
  });

  return (
    <Page title="Inventory" subtitle="Changes are pushed to Shopify. Use Undo in the toast to revert.">
      <Card padding="0">
        <div style={{ padding: 12 }}>
          <InlineStack gap="300" wrap>
            <div style={{ minWidth: 240, flex: 1 }}>
              <TextField
                label="Search"
                labelHidden
                placeholder="Search product or SKU"
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
            <Select
              label="Status"
              labelHidden
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { label: "All statuses", value: "" },
                { label: "Out of stock", value: "out" },
                { label: "Low stock", value: "low" },
                { label: "In stock", value: "ok" },
              ]}
            />
            <Select
              label="Location"
              labelHidden
              value={location}
              onChange={(v) => {
                setLocation(v);
                setPage(1);
              }}
              options={[
                { label: "All locations", value: "" },
                ...(locations.data ?? []).map((l) => ({ label: l.name, value: String(l.id) })),
              ]}
            />
          </InlineStack>
        </div>
        <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()}>
          {q.data && q.data.results.length === 0 ? (
            <div className="empty">
              <Text as="h3" variant="headingMd">
                No matching inventory
              </Text>
              <p>Try clearing the filters.</p>
            </div>
          ) : (
            <BlockStack>
              <IndexTable
                resourceName={{ singular: "item", plural: "items" }}
                itemCount={q.data?.count ?? 0}
                selectable={false}
                headings={[
                  { title: "Product" },
                  { title: "Variant" },
                  { title: "SKU" },
                  { title: "Location" },
                  { title: "Available", alignment: "end" },
                  { title: "Status" },
                  { title: "Adjust" },
                ]}
              >
                {(q.data?.results ?? []).map((r, i) => (
                  <IndexTable.Row id={String(r.id)} key={r.id} position={i}>
                    <IndexTable.Cell>
                      <Text as="span" fontWeight="semibold">
                        {r.product}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{r.variant_title}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <span className="mono sub">{r.sku}</span>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{r.location_name}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <span className="mono strong">{r.available}</span>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <StatusBadge status={r.status} />
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <span className="stepper" role="group" aria-label={`Adjust ${r.sku}`}>
                        {[-10, -1, 1, 10].map((d) => (
                          <button
                            key={d}
                            disabled={busy === r.id || r.available + d < 0}
                            onClick={() => adjust(r.id, d, `${r.sku} @ ${r.location_name}`)}
                            aria-label={`Adjust ${r.sku} by ${d}`}
                          >
                            {d > 0 ? `+${d}` : d}
                          </button>
                        ))}
                      </span>
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
                  label={`${q.data?.count ?? 0} items`}
                />
              </div>
            </BlockStack>
          )}
        </QueryState>
      </Card>
    </Page>
  );
}
