import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, ScrollView, Text, TextInput, View } from "react-native";

import { FadeIn, ListSkeleton } from "../../components/motion";
import { Card, Chip, Empty, ErrorText, Pill } from "../../components/ui";
import { api, type OrderRow, type Paged } from "../../lib/api";
import { money, timeAgo } from "../../lib/format";
import { theme } from "../../lib/theme";

const FILTERS = [
  ["", "All"],
  ["unfulfilled", "Unfulfilled"],
  ["fulfilled", "Fulfilled"],
  ["paid", "Paid"],
] as const;

export default function Orders() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page_size: "50" });
  if (status) params.set("status", status);
  if (debounced) params.set("q", debounced);
  const q = useQuery({
    queryKey: ["orders", params.toString()],
    queryFn: () => api<Paged<OrderRow>>(`/api/orders?${params}`),
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ padding: 16, gap: 12 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search order number"
          placeholderTextColor={theme.sub}
          autoCapitalize="none"
          style={{
            color: theme.text,
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
          }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map(([v, label]) => (
            <Chip key={label} label={label} active={status === v} onPress={() => setStatus(v)} />
          ))}
        </ScrollView>
      </View>
      <ErrorText error={q.error} onRetry={() => q.refetch()} />
      {q.isLoading ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={q.data?.results ?? []}
          keyExtractor={(o) => String(o.id)}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={<Empty title="No orders found" text="Orders appear here as customers check out." />}
          renderItem={({ item: o, index }) => (
            <FadeIn index={index}>
              <Card onPress={() => router.push(`/order/${o.id}`)}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: theme.text, fontWeight: "800", fontSize: 16 }}>{o.name}</Text>
                  <Text style={{ color: theme.text, fontWeight: "700" }}>{money(o.total_price, o.currency)}</Text>
                </View>
                <Text style={{ color: theme.sub, marginVertical: 4 }}>
                  {o.item_count} items{o.created_at_shopify ? ` · ${timeAgo(o.created_at_shopify)}` : ""}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
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
          )}
        />
      )}
    </View>
  );
}
