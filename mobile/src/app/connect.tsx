import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Btn, ErrorText } from "../components/ui";
import { api, demoLogin, normalizeUrl } from "../lib/api";
import { useSession } from "../lib/session";
import { theme as t } from "../lib/theme";

/** Set at build time (eas.json) so release builds talk to the live API by default. */
const DEFAULT_API = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Connect() {
  const { connect } = useSession();
  const [apiUrl, setApiUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const tryDemo = () =>
    run(async () => {
      await connect(await demoLogin(apiUrl));
    });

  const submit = () =>
    run(async () => {
      const session = { apiUrl: normalizeUrl(apiUrl), token: token.trim() };
      await api("/api/settings", {}, session); // verifies URL + token
      await connect(session);
    });

  const input = [styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }];
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { backgroundColor: t.bg }]}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.box}>
          <Text style={[styles.title, { color: t.text }]}>ShopSync</Text>
          <Text style={{ color: t.sub, marginBottom: 8 }}>
            Inventory and order sync for Shopify.
          </Text>

          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>Just looking?</Text>
            <Text style={{ color: t.sub, marginVertical: 6 }}>
              Explore a live Shopify store connected to ShopSync. It's read-only: browse products,
              orders and alerts, but nothing can be changed.
            </Text>
            <Btn label={busy ? "Opening..." : "Try the live demo"} onPress={tryDemo} disabled={busy} />
          </View>

          <Text style={{ color: t.sub, marginTop: 16 }}>
            Store owner? In the dashboard, open Settings and choose "Connect mobile app" to get your
            link code.
          </Text>
          <Text style={{ color: t.sub }}>API URL</Text>
          <TextInput
            style={input}
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://your-api.onrender.com"
            placeholderTextColor={t.sub}
          />
          <Text style={{ color: t.sub }}>Link code</Text>
          <TextInput
            style={[...input, { height: 96 }]}
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            placeholder="Paste the code from the dashboard"
            placeholderTextColor={t.sub}
          />
          <ErrorText error={error} />
          <Btn
            label={busy ? "Connecting..." : "Connect"}
            kind="ghost"
            onPress={submit}
            disabled={busy || !token}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center" },
  box: { padding: 24, gap: 8, maxWidth: 520, width: "100%", alignSelf: "center" },
  title: { fontSize: 32, fontWeight: "800", marginBottom: 0 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, textAlignVertical: "top" },
});
