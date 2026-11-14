import { Banner, BlockStack, Button, Card, FormLayout, Page, TextField } from "@shopify/polaris";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api, type Settings } from "../api";
import { QueryState } from "../components/QueryState";

export default function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/api/settings") });
  const [threshold, setThreshold] = useState("5");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (q.data) {
      setThreshold(String(q.data.low_stock_threshold));
      setEmail(q.data.alert_email);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      api<Settings>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ low_stock_threshold: Number(threshold), alert_email: email }),
      }),
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });

  return (
    <Page title="Settings">
      <QueryState isLoading={q.isLoading} error={q.error}>
        <BlockStack gap="400">
          {save.isSuccess && <Banner tone="success">Settings saved.</Banner>}
          {save.error && (
            <Banner tone="critical" title="Could not save">
              {(save.error as Error).message}
            </Banner>
          )}
          <Card>
            <FormLayout>
              <TextField
                label="Default low-stock threshold"
                type="number"
                min={0}
                value={threshold}
                onChange={setThreshold}
                autoComplete="off"
                helpText="Alert when available units fall to this number or below."
              />
              <TextField
                label="Alert email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                helpText="Low-stock alerts are emailed here. Leave empty to disable email."
              />
              <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
                Save
              </Button>
            </FormLayout>
          </Card>
        </BlockStack>
      </QueryState>
    </Page>
  );
}
