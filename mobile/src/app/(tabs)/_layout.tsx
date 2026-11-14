import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { useTheme } from "../../lib/theme";

type IconName = React.ComponentProps<typeof FontAwesome>["name"];

function icon(name: IconName) {
  return ({ color }: { color: ColorValue }) => (
    <FontAwesome size={22} name={name} color={color as string} />
  );
}

export default function TabLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.primary,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.card },
        headerTitleStyle: { color: t.text },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Alerts", tabBarIcon: icon("bell") }} />
      <Tabs.Screen name="inventory" options={{ title: "Inventory", tabBarIcon: icon("cubes") }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: icon("shopping-bag") }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: icon("cog") }} />
    </Tabs>
  );
}
