import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { FadeIn, ListSkeleton } from "../../components/motion";
import { Card, ErrorText, Pill } from "../../components/ui";
import { api, type OrderRow } from "../../lib/api";
import { money } from "../../lib/format";
import { theme } from "../../lib/theme";

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ["order", id], queryFn: () => api<OrderRow>(`/api/orders/${id}`) });
  const o = q.data;
  if (q.isLoading) return <ListSkeleton rows={4} />;
  if (!o) return <ErrorText error={q.error} onRetry={() => q.refetch()} />;

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ paddingBottom: 60 }}>
      <FadeIn index={0}>
        <Card>
          <Text style={{ color: theme.text, fontSize: 24, fontWeight: "800" }}>{o.name}</Text>
          {o.created_at_shopify && (
            <Text style={{ color: theme.sub, marginVertical: 4 }}>
              {new Date(o.created_at_shopify).toLocaleString()}
            </Text>
          )}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <Pill
              label={(o.financial_status || "unknown").toUpperCase()}
              color={o.financial_status === "paid" ? theme.ok : theme.warn}
            />
            <Pill
              label={(o.fulfillment_status || "unfulfilled").toUpperCase()}
              color={o.fulfillment_status === "fulfilled" ? theme.ok : theme.info}
            />
          </View>
        </Card>
      </FadeIn>
      <FadeIn index={1}>
        <Card>
          {o.items.map((li, i) => (
            <View
              key={i}
              style={{
                paddingVertical: 10,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: theme.border,
                flexDirection: "row",
                gap: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text }}>{li.title}</Text>
                <Text style={{ color: theme.sub, fontSize: 12 }}>
                  {li.sku} · {money(li.price, o.currency)} × {li.quantity}
                </Text>
              </View>
              <Text style={{ color: theme.text, fontWeight: "700" }}>
                {money(Number(li.price) * li.quantity, o.currency)}
              </Text>
            </View>
          ))}
          <View style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.sub }}>Subtotal</Text>
              <Text style={{ color: theme.text }}>{money(o.subtotal ?? 0, o.currency)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.text, fontWeight: "800" }}>Total</Text>
              <Text style={{ color: theme.text, fontWeight: "800", fontSize: 18 }}>
                {money(o.total_price, o.currency)}
              </Text>
            </View>
          </View>
        </Card>
      </FadeIn>
    </ScrollView>
  );
}
