import {
  Badge,
  BlockStack,
  Card,
  IndexTable,
  InlineStack,
  Page,
  Pagination,
  Select,
  Tabs,
  Text,
  TextField,
} from "@shopify/polaris";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, type ProductList } from "../api";
import { ProductThumb } from "../components/ProductThumb";
import { QueryState } from "../components/QueryState";
import { stockText } from "../lib/format";

const TABS = [
  { id: "all", content: "All", params: {} },
  { id: "active", content: "Active", params: { status: "active" } },
  { id: "draft", content: "Draft", params: { status: "draft" } },
  { id: "low", content: "Low stock", params: { stock: "low" } },
  { id: "out", content: "Out of stock", params: { stock: "out" } },
] as const;

const STATUS_TONE: Record<string, "success" | "info" | undefined> = {
  active: "success",
  draft: "info",
};

export default function Products() {
  const nav = useNavigate();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [vendor, setVendor] = useState("");
  const [sort, setSort] = useState("title");
  const [page, setPage] = useState(1);
  const [debounced, setDebounced] = useState("");
  const input = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), sort, page_size: "25" });
  Object.entries(TABS[tab].params).forEach(([k, v]) => params.set(k, v));
  if (debounced) params.set("q", debounced);
  if (vendor) params.set("vendor", vendor);

  const q = useQuery({
    queryKey: ["products", params.toString()],
    queryFn: () => api<ProductList>(`/api/products?${params}`),
    placeholderData: keepPreviousData,
  });
  const reset = () => setPage(1);

  return (
    <Page title="Products" subtitle={q.data ? `${q.data.count} products` : undefined}>
      <Card padding="0">
        <Tabs
          tabs={TABS.map((t) => ({ id: t.id, content: t.content }))}
          selected={tab}
          onSelect={(i) => {
            setTab(i);
            reset();
          }}
        />
        <div style={{ padding: 12 }}>
          <InlineStack gap="300" wrap>
            <div ref={input} style={{ flex: 1, minWidth: 220 }}>
              <TextField
                label="Search"
                labelHidden
                placeholder="Search by name or SKU"
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  reset();
                }}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => setSearch("")}
              />
            </div>
            <Select
              label="Vendor"
              labelHidden
              value={vendor}
              onChange={(v) => {
                setVendor(v);
                reset();
              }}
              options={[
                { label: "All vendors", value: "" },
                ...(q.data?.vendors ?? []).map((v) => ({ label: v, value: v })),
              ]}
            />
            <Select
              label="Sort"
              labelHidden
              value={sort}
              onChange={(v) => {
                setSort(v);
                reset();
              }}
              options={[
                { label: "Name A-Z", value: "title" },
                { label: "Name Z-A", value: "-title" },
                { label: "Stock: low to high", value: "stock" },
                { label: "Stock: high to low", value: "-stock" },
              ]}
            />
          </InlineStack>
        </div>
        <QueryState isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()}>
          {q.data && q.data.results.length === 0 ? (
            <div className="empty">
              <Text as="h3" variant="headingMd">
                No products found
              </Text>
              <p>Try a different search or filter.</p>
            </div>
          ) : (
            <BlockStack>
              <IndexTable
                resourceName={{ singular: "product", plural: "products" }}
                itemCount={q.data?.count ?? 0}
                selectable={false}
                headings={[
                  { title: "Product" },
                  { title: "Status" },
                  { title: "Inventory" },
                  { title: "Vendor" },
                ]}
              >
                {(q.data?.results ?? []).map((p, i) => (
                  <IndexTable.Row
                    id={String(p.id)}
                    key={p.id}
                    position={i}
                    onClick={() => nav(`/products/${p.id}`)}
                  >
                    <IndexTable.Cell>
                      <InlineStack gap="300" blockAlign="center" wrap={false}>
                        <ProductThumb title={p.title} url={p.image_url} size={40} />
                        <Text as="span" fontWeight="semibold">
                          {p.title}
                        </Text>
                      </InlineStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={STATUS_TONE[p.status]}>{p.status || "unknown"}</Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <span className={`stock-text ${p.stock}`}>
                        {stockText(p.total_available, p.variants_count)}
                      </span>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{p.vendor || "-"}</IndexTable.Cell>
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
    </Page>
  );
}
