import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { Card, Empty, ErrorText, Pill } from "../../components/ui";
import { api, type OrderRow, type Paged } from "../../lib/api";
import { money, timeAgo } from "../../lib/format";
import { useTheme } from "../../lib/theme";

export default function Orders() {
  const t = useTheme();
  const q = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<Paged<OrderRow>>("/api/orders?page_size=50"),
  });
  if (q.isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      data={q.data?.results ?? []}
      keyExtractor={(o) => String(o.id)}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      ListHeaderComponent={<ErrorText error={q.error} />}
      ListEmptyComponent={<Empty text="No orders yet." />}
      renderItem={({ item: o }) => (
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: t.text, fontWeight: "700", fontSize: 16 }}>{o.name}</Text>
            <Text style={{ color: t.text, fontWeight: "700" }}>{money(o.total_price, o.currency)}</Text>
          </View>
          <Text style={{ color: t.sub, marginVertical: 4 }}>
            {o.items.reduce((n, l) => n + l.quantity, 0)} items
            {o.created_at_shopify ? ` · ${timeAgo(o.created_at_shopify)}` : ""}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pill
              label={o.financial_status || "unknown"}
              color={o.financial_status === "paid" ? "#1a7f4b" : "#b45309"}
            />
            <Pill
              label={o.fulfillment_status || "unfulfilled"}
              color={o.fulfillment_status === "fulfilled" ? "#1a7f4b" : "#2563eb"}
            />
          </View>
        </Card>
      )}
    />
  );
}
