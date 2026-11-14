import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { Btn, Card, ErrorText } from "../../components/ui";
import { api, type Settings } from "../../lib/api";
import { registerForPush } from "../../lib/push";
import { useSession } from "../../lib/session";
import { useTheme } from "../../lib/theme";

export default function SettingsScreen() {
  const t = useTheme();
  const { session, disconnect } = useSession();
  const q = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/api/settings") });
  const [threshold, setThreshold] = useState("5");
  const [email, setEmail] = useState("");
  const [pushMsg, setPushMsg] = useState("");

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
  });
  const push = useMutation({
    mutationFn: registerForPush,
    onSuccess: () => setPushMsg("Push notifications enabled on this device."),
    onError: (e: Error) => setPushMsg(e.message),
  });

  const input = {
    color: t.text,
    backgroundColor: t.bg,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
  };
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ paddingVertical: 12 }}>
      <Card>
        <Text style={{ color: t.sub }}>Low-stock threshold</Text>
        <TextInput
          style={input}
          value={threshold}
          onChangeText={setThreshold}
          keyboardType="number-pad"
        />
        <Text style={{ color: t.sub }}>Alert email</Text>
        <TextInput
          style={input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <ErrorText error={q.error ?? save.error} />
        <Btn label={save.isPending ? "Saving..." : "Save"} onPress={() => save.mutate()} />
        {save.isSuccess && <Text style={{ color: "#1a7f4b", marginTop: 8 }}>Saved.</Text>}
      </Card>
      <Card>
        <Text style={{ color: t.text, fontWeight: "700", marginBottom: 6 }}>Push notifications</Text>
        <Btn label="Enable on this device" kind="ghost" onPress={() => push.mutate()} />
        {!!pushMsg && <Text style={{ color: t.sub, marginTop: 8 }}>{pushMsg}</Text>}
      </Card>
      <Card>
        <Text style={{ color: t.sub, marginBottom: 8 }}>Connected to {session?.apiUrl}</Text>
        <View>
          <Btn label="Disconnect" kind="ghost" onPress={disconnect} />
        </View>
      </Card>
    </ScrollView>
  );
}
