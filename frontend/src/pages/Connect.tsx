import { Banner, BlockStack, Button, Card, FormLayout, Page, Text, TextField } from "@shopify/polaris";
import { useState } from "react";

import { api } from "../api";
import { login, logout } from "../lib/auth";

/** Standalone sign-in: paste the link code generated in Settings -> Connect mobile app. */
export default function Connect({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    login(code);
    try {
      await api("/api/settings"); // verifies the code against the API
      onDone();
    } catch (e) {
      logout();
      setError((e as Error).message || "That code didn't work");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "10vh auto 0", padding: "0 16px" }}>
      <Page narrowWidth title="Sign in to ShopSync">
        <Card>
          <BlockStack gap="400">
            <Text as="p" tone="subdued">
              Open ShopSync from your Shopify admin, go to Settings, choose "Connect mobile app", and
              paste the link code here. Inside Shopify admin you're signed in automatically.
            </Text>
            {error && <Banner tone="critical">{error}</Banner>}
            <FormLayout>
              <TextField
                label="Link code"
                value={code}
                onChange={setCode}
                multiline={4}
                autoComplete="off"
                placeholder="Paste the code from the dashboard"
              />
              <Button variant="primary" loading={busy} disabled={!code.trim()} onClick={submit}>
                Sign in
              </Button>
            </FormLayout>
          </BlockStack>
        </Card>
      </Page>
    </div>
  );
}
