import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { Card, Empty, ErrorText, Pill } from "../../components/ui";
import { api, type AlertRow, type Overview, type Paged } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import { useTheme } from "../../lib/theme";

export default function Alerts() {
  const t = useTheme();
  const alerts = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api<Paged<AlertRow>>("/api/alerts?open=1&page_size=100"),
  });
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => api<Overview>("/api/overview") });

  if (alerts.isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
  const o = overview.data;
  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      data={alerts.data?.results ?? []}
      keyExtractor={(a) => String(a.id)}
      refreshing={alerts.isRefetching}
      onRefresh={() => {
        alerts.refetch();
        overview.refetch();
      }}
      ListHeaderComponent={
        <View>
          <ErrorText error={alerts.error} />
          {o && (
            <View style={{ flexDirection: "row", padding: 16, gap: 12 }}>
              <Stat label="Out" value={o.out_of_stock} color="#c0262d" />
              <Stat label="Low" value={o.low_stock} color="#b45309" />
              <Stat label="Orders 30d" value={o.orders_30d} color={t.text} />
            </View>
          )}
        </View>
      }
      ListEmptyComponent={<Empty text="No open alerts. Everything is above its threshold." />}
      renderItem={({ item: a }) => (
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Pill
              label={a.level === "out" ? "OUT OF STOCK" : "LOW STOCK"}
              color={a.level === "out" ? "#c0262d" : "#b45309"}
            />
            <Text style={{ color: t.sub }}>{timeAgo(a.created_at)}</Text>
          </View>
          <Text style={{ color: t.text, fontWeight: "700", fontSize: 16, marginTop: 8 }}>
            {a.product}
          </Text>
          <Text style={{ color: t.sub }}>
            {a.variant_title} · {a.sku}
          </Text>
          <Text style={{ color: t.text, marginTop: 4 }}>
            {a.available} left at {a.location_name} (threshold {a.threshold})
          </Text>
        </Card>
      )}
    />
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.card, borderRadius: 12, padding: 12 }}>
      <Text style={{ color: t.sub, fontSize: 12 }}>{label}</Text>
      <Text style={{ color, fontSize: 26, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}
