import {
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  InlineStack,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api, type Settings } from "../api";
import { QueryState } from "../components/QueryState";

function MobileLink() {
  const mint = useMutation({
    mutationFn: () => api<{ token: string; expires_in_days: number }>("/api/mobile-token", { method: "POST" }),
  });
  const [copied, setCopied] = useState(false);
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Connect mobile app
        </Text>
        <Text as="p" tone="subdued">
          Generate a link code, then paste it into the ShopSync mobile app together with this
          server's API URL.
        </Text>
        <InlineStack>
          <Button loading={mint.isPending} onClick={() => mint.mutate()}>
            Generate link code
          </Button>
        </InlineStack>
        {mint.error && <Banner tone="critical">{(mint.error as Error).message}</Banner>}
        {mint.data && (
          <BlockStack gap="200">
            <TextField
              label={`Link code (valid ${mint.data.expires_in_days} days)`}
              value={mint.data.token}
              readOnly
              multiline={3}
              autoComplete="off"
            />
            <InlineStack>
              <Button
                onClick={() => {
                  navigator.clipboard?.writeText(mint.data!.token);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </InlineStack>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}

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
          <MobileLink />
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
