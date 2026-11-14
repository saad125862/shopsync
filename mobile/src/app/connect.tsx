import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { Btn, ErrorText } from "../components/ui";
import { api, normalizeUrl } from "../lib/api";
import { useSession } from "../lib/session";
import { theme as t } from "../lib/theme";

export default function Connect() {
  const { connect } = useSession();
  const [apiUrl, setApiUrl] = useState("http://localhost:8000");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const session = { apiUrl: normalizeUrl(apiUrl), token: token.trim() };
    try {
      await api("/api/settings", {}, session); // verifies URL + token
      await connect(session);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const input = [styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }];
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { backgroundColor: t.bg }]}
    >
      <View style={styles.box}>
        <Text style={[styles.title, { color: t.text }]}>ShopSync</Text>
        <Text style={{ color: t.sub, marginBottom: 16 }}>
          In the dashboard, open Settings and choose "Connect mobile app" to get your link code.
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
        <Btn label={busy ? "Connecting..." : "Connect"} onPress={submit} disabled={busy || !token} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center" },
  box: { padding: 24, gap: 8, maxWidth: 520, width: "100%", alignSelf: "center" },
  title: { fontSize: 32, fontWeight: "800", marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, textAlignVertical: "top" },
});
