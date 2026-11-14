import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "./api";

/** Ask for permission, fetch the Expo push token and register it with the backend. */
export async function registerForPush(): Promise<string> {
  if (Platform.OS === "web") throw new Error("Push notifications need a real device");
  if (!Device.isDevice) throw new Error("Use a physical device for push notifications");

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") throw new Error("Notification permission denied");

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  await api("/api/devices", { method: "POST", body: JSON.stringify({ token }) });
  return token;
}
