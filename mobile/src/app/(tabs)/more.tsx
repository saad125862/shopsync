import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { FadeIn } from "../../components/motion";
import { Btn, Card, ErrorText, SectionTitle } from "../../components/ui";
import { useToast } from "../../hooks/toast";
import { api, type Settings } from "../../lib/api";
import { registerForPush } from "../../lib/push";
import { useSession } from "../../lib/session";
import { theme } from "../../lib/theme";

export default function More() {
  const toast = useToast();
  const { session, disconnect } = useSession();
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
    onSuccess: () => toast.show("Settings saved"),
    onError: (e: Error) => toast.show(e.message, { error: true }),
  });
  const push = useMutation({
    mutationFn: registerForPush,
    onSuccess: () => toast.show("Push notifications enabled"),
    onError: (e: Error) => toast.show(e.message, { error: true }),
  });

  const input = {
    color: theme.text,
    backgroundColor: theme.bg,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
  };
  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ paddingBottom: 60 }}>
      <SectionTitle>Alerts</SectionTitle>
      <FadeIn index={0}>
        <Card>
          <Text style={{ color: theme.sub }}>Low-stock threshold</Text>
          <TextInput style={input} value={threshold} onChangeText={setThreshold} keyboardType="number-pad" />
          <Text style={{ color: theme.sub }}>Alert email</Text>
          <TextInput
            style={input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <ErrorText error={q.error} />
          <Btn label={save.isPending ? "Saving..." : "Save"} onPress={() => save.mutate()} />
        </Card>
      </FadeIn>

      <SectionTitle>Notifications</SectionTitle>
      <FadeIn index={1}>
        <Card>
          <Text style={{ color: theme.sub, marginBottom: 10 }}>
            Get a push when an item runs low or sells out.
          </Text>
          <Btn label="Enable on this device" kind="ghost" onPress={() => push.mutate()} />
        </Card>
      </FadeIn>

      <SectionTitle>Store</SectionTitle>
      <FadeIn index={2}>
        <Card>
          <Text style={{ color: theme.sub, marginBottom: 10 }}>Connected to {session?.apiUrl}</Text>
          <View>
            <Btn label="Disconnect" kind="ghost" onPress={disconnect} />
          </View>
        </Card>
      </FadeIn>
    </ScrollView>
  );
}
