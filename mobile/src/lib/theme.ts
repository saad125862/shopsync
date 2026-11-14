import { useColorScheme } from "react-native";

const light = {
  bg: "#f4f5f7",
  card: "#ffffff",
  text: "#111827",
  sub: "#6b7280",
  border: "#e5e7eb",
  primary: "#008060",
  onPrimary: "#ffffff",
};
const dark: typeof light = {
  bg: "#0f1115",
  card: "#1a1d23",
  text: "#f3f4f6",
  sub: "#9ca3af",
  border: "#2a2f37",
  primary: "#2fb98a",
  onPrimary: "#04251a",
};

export function useTheme() {
  return useColorScheme() === "dark" ? dark : light;
}
