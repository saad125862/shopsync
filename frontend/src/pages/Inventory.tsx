import {
  Banner,
  BlockStack,
  Button,
  ButtonGroup,
  Card,
  IndexTable,
  InlineStack,
  Page,
  Pagination,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, type InventoryRow, type LocationRow, type Paged } from "../api";
import { QueryState } from "../components/QueryState";
import { StatusBadge } from "../components/StatusBadge";

export default function Inventory() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("q", search);
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
  const adjust = useMutation({
    mutationFn: (v: { id: number; delta: number }) =>
      api(`/api/inventory/${v.id}/adjust`, {
        method: "POST",
        body: JSON.stringify({ delta: v.delta }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    setPage(1);
    fn(v);
  };

  return (
    <Page title="Inventory" subtitle="Changes are pushed to Shopify and mirrored here">
      <BlockStack gap="400">
        {adjust.error && (
          <Banner tone="critical" title="Adjustment failed">
            {(adjust.error as Error).message}
          </Banner>
        )}
        <Card>
          <InlineStack gap="300" wrap>
            <div style={{ minWidth: 240, flex: 1 }}>
              <TextField
                label="Search"
                labelHidden
                placeholder="Search product or SKU"
                value={search}
                onChange={reset(setSearch)}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => reset(setSearch)("")}
              />
            </div>
            <Select
              label="Status"
              labelHidden
              value={status}
              onChange={reset(setStatus)}
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
              onChange={reset(setLocation)}
              options={[
                { label: "All locations", value: "" },
                ...(locations.data ?? []).map((l) => ({ label: l.name, value: String(l.id) })),
              ]}
            />
          </InlineStack>
        </Card>
        <QueryState isLoading={q.isLoading} error={q.error}>
          <Card padding="0">
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
                  <IndexTable.Cell>{r.sku}</IndexTable.Cell>
                  <IndexTable.Cell>{r.location_name}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" alignment="end" numeric>
                      {r.available}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <StatusBadge status={r.status} />
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <ButtonGroup variant="segmented">
                      {[-10, -1, 1, 10].map((d) => (
                        <Button
                          key={d}
                          size="micro"
                          disabled={adjust.isPending || r.available + d < 0}
                          onClick={() => adjust.mutate({ id: r.id, delta: d })}
                          accessibilityLabel={`Adjust ${r.sku} by ${d}`}
                        >
                          {d > 0 ? `+${d}` : String(d)}
                        </Button>
                      ))}
                    </ButtonGroup>
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
          </Card>
        </QueryState>
      </BlockStack>
    </Page>
  );
}
