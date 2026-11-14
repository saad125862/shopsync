import { Badge, Banner, BlockStack, Card, IndexTable, Page, Text } from "@shopify/polaris";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Paged, type SyncLogRow } from "../api";
import { QueryState } from "../components/QueryState";

const TONE = { ok: "success", failed: "critical", running: "info" } as const;

export default function SyncLogs() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["sync"],
    queryFn: () => api<Paged<SyncLogRow>>("/api/sync"),
    refetchInterval: 10_000,
  });
  const run = useMutation({
    mutationFn: () => api("/api/sync", { method: "POST" }),
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ["sync"] }), 1500),
  });
  return (
    <Page
      title="Sync log"
      primaryAction={{
        content: "Run full sync",
        loading: run.isPending,
        onAction: () => run.mutate(),
      }}
    >
      <BlockStack gap="400">
        {run.isSuccess && <Banner tone="success">Sync queued. This page refreshes automatically.</Banner>}
        {run.error && (
          <Banner tone="critical" title="Could not start sync">
            {(run.error as Error).message}
          </Banner>
        )}
        <QueryState isLoading={q.isLoading} error={q.error}>
          <Card padding="0">
            <IndexTable
              resourceName={{ singular: "sync", plural: "syncs" }}
              itemCount={q.data?.results.length ?? 0}
              selectable={false}
              headings={[
                { title: "Type" },
                { title: "Status" },
                { title: "Started" },
                { title: "Details" },
              ]}
            >
              {(q.data?.results ?? []).map((s, i) => (
                <IndexTable.Row id={String(s.id)} key={s.id} position={i}>
                  <IndexTable.Cell>{s.kind}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={TONE[s.status]}>{s.status}</Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{new Date(s.started_at).toLocaleString()}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" tone="subdued">
                      {s.detail || "-"}
                    </Text>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        </QueryState>
      </BlockStack>
    </Page>
  );
}
