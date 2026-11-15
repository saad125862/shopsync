import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { CountUp, FadeIn, ListSkeleton, PulseDot, Ring, Sparkline } from "../../components/motion";
import { Card, Chip, ErrorText, Pill, SectionTitle, Thumb } from "../../components/ui";
import { api, type OrderRow, type Overview, type Paged } from "../../lib/api";
import { greeting, money, timeAgo } from "../../lib/format";
import { theme } from "../../lib/theme";

const RANGES = [
  ["7", "7 days"],
  ["30", "30 days"],
  ["90", "90 days"],
] as const;

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <Pill label="NEW" color={theme.info} />;
  const up = pct >= 0;
  return <Pill label={`${up ? "▲" : "▼"} ${Math.abs(pct)}%`} color={up ? theme.ok : theme.danger} />;
}

export default function Home() {
  const router = useRouter();
  const [days, setDays] = useState("30");
  const q = useQuery({
    queryKey: ["overview", Number(days)],
    queryFn: () => api<Overview>(`/api/overview?days=${days}`),
  });
  const orders = useQuery({
    queryKey: ["orders", "home"],
    queryFn: () => api<Paged<OrderRow>>("/api/orders?page_size=4"),
  });
  const d = q.data;
  const done = d ? d.setup.filter((s) => s.done).length : 0;
  const alerts = (d?.low_stock ?? 0) + (d?.out_of_stock ?? 0);

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          tintColor={theme.primary}
          onRefresh={() => {
            q.refetch();
            orders.refetch();
          }}
        />
      }
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Text style={{ color: theme.sub }}>{greeting()}</Text>
        <Text style={{ color: theme.text, fontSize: 26, fontWeight: "800" }}>
          {d ? d.shop.replace(".myshopify.com", "") : "ShopSync"}
        </Text>
      </View>

      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 14 }}>
        {RANGES.map(([v, label]) => (
          <Chip key={v} label={label} active={days === v} onPress={() => setDays(v)} />
        ))}
      </View>

      <ErrorText error={q.error} onRetry={() => q.refetch()} />
      {q.isLoading && <ListSkeleton rows={4} />}

      {d && (
        <>
          <FadeIn index={0}>
            <Card>
              <Text style={{ color: theme.sub }}>Total sales</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 }}>
                <CountUp
                  value={Number(d.revenue)}
                  format={(n) => money(n, d.currency, 0)}
                  style={{ color: theme.text, fontSize: 34, fontWeight: "800" }}
                />
                <Delta pct={d.change.revenue} />
              </View>
              <View style={{ marginTop: 10 }}>
                <Sparkline data={d.daily.map((x) => Number(x.revenue))} />
              </View>
            </Card>
          </FadeIn>

          <FadeIn index={1}>
            <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 6 }}>
              {[
                ["Orders", d.orders, (n: number) => String(Math.round(n))],
                ["Units", d.units, (n: number) => String(Math.round(n))],
                ["AOV", Number(d.aov), (n: number) => money(n, d.currency, 0)],
              ].map(([label, value, fmt]) => (
                <View
                  key={label as string}
                  style={{
                    flex: 1,
                    backgroundColor: theme.card,
                    borderRadius: theme.radius,
                    borderWidth: 1,
                    borderColor: theme.border,
                    padding: 12,
                  }}
                >
                  <Text style={{ color: theme.sub, fontSize: 12 }}>{label as string}</Text>
                  <CountUp
                    value={value as number}
                    format={fmt as (n: number) => string}
                    style={{ color: theme.text, fontSize: 20, fontWeight: "800", marginTop: 2 }}
                  />
                </View>
              ))}
            </View>
          </FadeIn>

          {alerts > 0 && (
            <FadeIn index={2}>
              <Card onPress={() => router.push("/alerts")}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <PulseDot color={d.out_of_stock ? theme.danger : theme.warn} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: "800" }}>Stock needs attention</Text>
                    <Text style={{ color: theme.sub }}>
                      {d.out_of_stock} out of stock · {d.low_stock} low stock
                    </Text>
                  </View>
                  <Text style={{ color: theme.primary, fontWeight: "800" }}>View</Text>
                </View>
              </Card>
            </FadeIn>
          )}

          {done < d.setup.length && (
            <FadeIn index={3}>
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Ring progress={done / d.setup.length} label={`${done}/${d.setup.length}`} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: "800" }}>Setup guide</Text>
                    <Text style={{ color: theme.sub }}>
                      {d.setup.find((s) => !s.done)?.title ?? "All set"}
                    </Text>
                  </View>
                </View>
              </Card>
            </FadeIn>
          )}

          <SectionTitle>Top products</SectionTitle>
          {d.top_products.length === 0 && (
            <Text style={{ color: theme.sub, paddingHorizontal: 16 }}>No sales in this period.</Text>
          )}
          {d.top_products.map((p, i) => (
            <FadeIn key={p.title} index={i + 4}>
              <Card onPress={p.id ? () => router.push(`/product/${p.id}`) : undefined}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Thumb title={p.title} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: "700" }}>{p.title}</Text>
                    <Text style={{ color: theme.sub }}>{p.units} sold</Text>
                  </View>
                  <Text style={{ color: theme.text, fontWeight: "700" }}>{money(p.revenue, d.currency, 0)}</Text>
                </View>
              </Card>
            </FadeIn>
          ))}

          <SectionTitle>Recent orders</SectionTitle>
          {(orders.data?.results ?? []).map((o, i) => (
            <FadeIn key={o.id} index={i + 6}>
              <Card onPress={() => router.push(`/order/${o.id}`)}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: theme.text, fontWeight: "800" }}>{o.name}</Text>
                  <Text style={{ color: theme.text, fontWeight: "700" }}>
                    {money(o.total_price, o.currency)}
                  </Text>
                </View>
                <Text style={{ color: theme.sub, marginTop: 2 }}>
                  {o.item_count} items{o.created_at_shopify ? ` · ${timeAgo(o.created_at_shopify)}` : ""}
                </Text>
              </Card>
            </FadeIn>
          ))}
        </>
      )}
    </ScrollView>
  );
}
