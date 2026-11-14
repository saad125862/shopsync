import { useQuery } from "@tanstack/react-query";
import { FlatList, Text, View } from "react-native";

import { FadeIn, ListSkeleton, PulseDot } from "../../components/motion";
import { Card, Empty, ErrorText, Pill } from "../../components/ui";
import { api, type AlertRow, type Paged } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import { theme } from "../../lib/theme";

export default function Alerts() {
  const q = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api<Paged<AlertRow>>("/api/alerts?open=1&page_size=100"),
  });
  if (q.isLoading) return <ListSkeleton />;
  return (
    <FlatList
      style={{ backgroundColor: theme.bg }}
      data={q.data?.results ?? []}
      keyExtractor={(a) => String(a.id)}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      ListHeaderComponent={<ErrorText error={q.error} onRetry={() => q.refetch()} />}
      ListEmptyComponent={<Empty title="All stocked up" text="Nothing is below its threshold right now." />}
      renderItem={({ item: a, index }) => {
        const out = a.level === "out";
        return (
          <FadeIn index={index}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {out && <PulseDot color={theme.danger} size={8} />}
                  <Pill
                    label={out ? "OUT OF STOCK" : "LOW STOCK"}
                    color={out ? theme.danger : theme.warn}
                  />
                </View>
                <Text style={{ color: theme.sub }}>{timeAgo(a.created_at)}</Text>
              </View>
              <Text style={{ color: theme.text, fontWeight: "800", fontSize: 16, marginTop: 8 }}>
                {a.product}
              </Text>
              <Text style={{ color: theme.sub }}>
                {a.variant_title} · {a.sku}
              </Text>
              <Text style={{ color: theme.text, marginTop: 4 }}>
                {a.available} left at {a.location_name} (threshold {a.threshold})
              </Text>
            </Card>
          </FadeIn>
        );
      }}
    />
  );
}
