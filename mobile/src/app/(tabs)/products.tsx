import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, ScrollView, Text, TextInput, View } from "react-native";

import { FadeIn, ListSkeleton } from "../../components/motion";
import { Card, Chip, Empty, ErrorText, Pill, Thumb } from "../../components/ui";
import { api, type Paged, type ProductRow } from "../../lib/api";
import { STATUS_COLOR, stockText } from "../../lib/format";
import { theme } from "../../lib/theme";

const FILTERS = [
  ["", "All"],
  ["low", "Low stock"],
  ["out", "Out of stock"],
] as const;

export default function Products() {
  const router = useRouter();
  const [stock, setStock] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page_size: "100" });
  if (stock) params.set("stock", stock);
  if (debounced) params.set("q", debounced);
  const q = useQuery({
    queryKey: ["products", params.toString()],
    queryFn: () => api<Paged<ProductRow>>(`/api/products?${params}`),
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ padding: 16, gap: 12 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search products or SKUs"
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
            <Chip key={label} label={label} active={stock === v} onPress={() => setStock(v)} />
          ))}
        </ScrollView>
      </View>
      <ErrorText error={q.error} onRetry={() => q.refetch()} />
      {q.isLoading ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={q.data?.results ?? []}
          keyExtractor={(p) => String(p.id)}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={<Empty title="No products found" text="Try a different search or filter." />}
          renderItem={({ item: p, index }) => (
            <FadeIn index={index}>
              <Card onPress={() => router.push(`/product/${p.id}`)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Thumb title={p.title} size={52} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: theme.text, fontWeight: "800", fontSize: 16 }}>{p.title}</Text>
                    <Text style={{ color: STATUS_COLOR[p.stock] === theme.ok ? theme.sub : STATUS_COLOR[p.stock] }}>
                      {stockText(p.total_available, p.variants_count)}
                    </Text>
                    <Text style={{ color: theme.sub, fontSize: 12 }}>{p.vendor}</Text>
                  </View>
                  <Pill
                    label={(p.status || "unknown").toUpperCase()}
                    color={p.status === "active" ? theme.ok : theme.info}
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
