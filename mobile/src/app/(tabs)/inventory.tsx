import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";

import { Btn, Card, Empty, ErrorText, Pill } from "../../components/ui";
import { api, type InventoryRow, type Paged } from "../../lib/api";
import { STATUS_COLOR, STATUS_LABEL } from "../../lib/format";
import { useTheme } from "../../lib/theme";

const FILTERS = [
  ["", "All"],
  ["out", "Out"],
  ["low", "Low"],
] as const;

export default function Inventory() {
  const t = useTheme();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const params = new URLSearchParams({ page_size: "100" });
  if (search) params.set("q", search);
  if (status) params.set("status", status);

  const q = useQuery({
    queryKey: ["inventory", params.toString()],
    queryFn: () => api<Paged<InventoryRow>>(`/api/inventory?${params}`),
  });
  const adjust = useMutation({
    mutationFn: (v: { id: number; delta: number }) =>
      api(`/api/inventory/${v.id}/adjust`, { method: "POST", body: JSON.stringify({ delta: v.delta }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16, gap: 10 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search product or SKU"
          placeholderTextColor={t.sub}
          autoCapitalize="none"
          style={{
            color: t.text,
            backgroundColor: t.card,
            borderColor: t.border,
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
          }}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {FILTERS.map(([value, label]) => (
            <Btn
              key={label}
              label={label}
              kind={status === value ? "primary" : "ghost"}
              onPress={() => setStatus(value)}
            />
          ))}
        </View>
        <ErrorText error={adjust.error ?? q.error} />
      </View>
      {q.isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={q.data?.results ?? []}
          keyExtractor={(r) => String(r.id)}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={<Empty text="No matching items." />}
          renderItem={({ item: r }) => (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: t.text, fontWeight: "700" }}>{r.product}</Text>
                  <Text style={{ color: t.sub }}>
                    {r.variant_title} · {r.sku}
                  </Text>
                  <Text style={{ color: t.sub }}>{r.location_name}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Text style={{ color: t.text, fontSize: 24, fontWeight: "800" }}>{r.available}</Text>
                  <Pill label={STATUS_LABEL[r.status]} color={STATUS_COLOR[r.status]} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                {[-10, -1, 1, 10].map((d) => (
                  <Btn
                    key={d}
                    label={d > 0 ? `+${d}` : String(d)}
                    kind="ghost"
                    disabled={adjust.isPending || r.available + d < 0}
                    onPress={() => adjust.mutate({ id: r.id, delta: d })}
                  />
                ))}
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
