import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { api, type Overview } from "../../lib/api";
import { theme } from "../../lib/theme";

type IconName = React.ComponentProps<typeof FontAwesome>["name"];

function icon(name: IconName) {
  return ({ color }: { color: ColorValue }) => (
    <FontAwesome size={21} name={name} color={color as string} />
  );
}

export default function TabLayout() {
  const overview = useQuery({
    queryKey: ["overview", 30],
    queryFn: () => api<Overview>("/api/overview?days=30"),
  });
  const count = (overview.data?.low_stock ?? 0) + (overview.data?.out_of_stock ?? 0);
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.sub,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
        headerStyle: { backgroundColor: theme.bg },
        headerTitleStyle: { color: theme.text, fontWeight: "800" },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", headerShown: false, tabBarIcon: icon("home") }}
      />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: icon("inbox") }} />
      <Tabs.Screen name="products" options={{ title: "Products", tabBarIcon: icon("tag") }} />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: icon("bell"),
          tabBarBadge: count ? Math.min(count, 99) : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.danger, color: "#2a0606" },
        }}
      />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: icon("ellipsis-h") }} />
    </Tabs>
  );
}
