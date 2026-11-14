import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { ToastProvider } from "../hooks/toast";
import { SessionProvider, useSession } from "../lib/session";
import { theme } from "../lib/theme";

function Gate() {
  const { ready, session } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const onConnect = segments[0] === "connect";
    if (!session && !onConnect) router.replace("/connect");
    if (session && onConnect) router.replace("/");
  }, [ready, session, segments, router]);

  const header = {
    headerStyle: { backgroundColor: theme.bg },
    headerTintColor: theme.text,
    headerTitleStyle: { color: theme.text },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: theme.bg },
    animation: "slide_from_right" as const,
  };
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="connect" options={{ animation: "fade" }} />
      <Stack.Screen name="product/[id]" options={{ headerShown: true, title: "Product", ...header }} />
      <Stack.Screen name="order/[id]" options={{ headerShown: true, title: "Order", ...header }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <QueryClientProvider client={client}>
        <SessionProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <Gate />
          </ToastProvider>
        </SessionProvider>
      </QueryClientProvider>
    </View>
  );
}
