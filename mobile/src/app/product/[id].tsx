import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { CountUp, FadeIn, ListSkeleton, Tap } from "../../components/motion";
import { Card, ErrorText, Pill, Thumb } from "../../components/ui";
import { useAdjust } from "../../hooks/useAdjust";
import { api, type ProductDetail } from "../../lib/api";
import { money, STATUS_COLOR, STATUS_LABEL } from "../../lib/format";
import { theme } from "../../lib/theme";

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { adjust, busy } = useAdjust();
  const q = useQuery({
    queryKey: ["product", id],
    queryFn: () => api<ProductDetail>(`/api/products/${id}`),
  });
  const p = q.data;
  if (q.isLoading) return <ListSkeleton rows={5} />;
  if (!p) return <ErrorText error={q.error} onRetry={() => q.refetch()} />;

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ paddingBottom: 120 }}>
      <FadeIn index={0}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Thumb title={p.title} size={72} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: theme.text, fontSize: 20, fontWeight: "800" }}>{p.title}</Text>
              <Text style={{ color: theme.sub }}>{p.vendor}</Text>
              <Pill
                label={(p.status || "unknown").toUpperCase()}
                color={p.status === "active" ? theme.ok : theme.info}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 24, marginTop: 14 }}>
            <View>
              <Text style={{ color: theme.sub, fontSize: 12 }}>In stock</Text>
              <CountUp value={p.total_available} style={{ color: theme.text, fontSize: 24, fontWeight: "800" }} />
            </View>
            <View>
              <Text style={{ color: theme.sub, fontSize: 12 }}>Units sold</Text>
              <CountUp value={p.units_sold} style={{ color: theme.text, fontSize: 24, fontWeight: "800" }} />
            </View>
          </View>
        </Card>
      </FadeIn>

      {p.variants.map((v, i) => (
        <FadeIn key={v.id} index={i + 1}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.text, fontWeight: "800" }}>{v.title}</Text>
              <Text style={{ color: theme.text }}>{money(v.price)}</Text>
            </View>
            <Text style={{ color: theme.sub, marginBottom: 6 }}>{v.sku}</Text>
            {v.levels.map((lv) => (
              <View key={lv.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: theme.text }}>{lv.location_name}</Text>
                    <Pill label={STATUS_LABEL[lv.status].toUpperCase()} color={STATUS_COLOR[lv.status]} />
                  </View>
                  <Text style={{ color: theme.text, fontSize: 24, fontWeight: "800" }}>{lv.available}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  {[-10, -1, 1, 10].map((d) => (
                    <Tap
                      key={d}
                      label={`${d > 0 ? "Add" : "Remove"} ${Math.abs(d)}`}
                      disabled={busy === lv.id || lv.available + d < 0}
                      onPress={() => adjust(lv.id, d, `${v.sku} @ ${lv.location_name}`)}
                      haptics={false}
                      wrapStyle={{ flex: 1 }}
                      style={{
                        alignItems: "center",
                        paddingVertical: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: theme.border,
                        backgroundColor: theme.card2,
                      }}
                    >
                      <Text style={{ color: theme.text, fontWeight: "800" }}>{d > 0 ? `+${d}` : d}</Text>
                    </Tap>
                  ))}
                </View>
              </View>
            ))}
          </Card>
        </FadeIn>
      ))}
    </ScrollView>
  );
}
