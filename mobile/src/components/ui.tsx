import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { hueFor } from "../lib/format";
import { theme } from "../lib/theme";
import { Tap } from "./motion";

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const body = <View style={styles.card}>{children}</View>;
  return onPress ? (
    <Tap onPress={onPress} style={{ marginHorizontal: 16, marginVertical: 6 }}>
      <View style={[styles.card, { marginHorizontal: 0, marginVertical: 0 }]}>{children}</View>
    </Tap>
  ) : (
    body
  );
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + "26" }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Btn({
  label,
  onPress,
  disabled,
  kind = "primary",
  small,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: "primary" | "ghost";
  small?: boolean;
}) {
  const primary = kind === "primary";
  return (
    <Tap
      label={label}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        small && { paddingVertical: 6, paddingHorizontal: 10, minHeight: 34, minWidth: 40 },
        {
          backgroundColor: primary ? theme.primary : "transparent",
          borderColor: primary ? theme.primary : theme.border,
        },
      ]}
    >
      <Text style={{ color: primary ? theme.onPrimary : theme.text, fontWeight: "700" }}>{label}</Text>
    </Tap>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Tap
      label={label}
      onPress={onPress}
      haptics
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.primary : theme.card,
          borderColor: active ? theme.primary : theme.border,
        },
      ]}
    >
      <Text style={{ color: active ? theme.onPrimary : theme.text, fontWeight: "600", fontSize: 13 }}>
        {label}
      </Text>
    </Tap>
  );
}

export function ErrorText({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <View style={{ padding: 16, gap: 10 }}>
      <Text style={{ color: theme.danger }}>
        {error instanceof Error ? error.message : "Something went wrong."}
      </Text>
      {onRetry ? <Btn label="Try again" kind="ghost" small onPress={onRetry} /> : null}
    </View>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <View style={{ alignItems: "center", padding: 40, gap: 6 }}>
      <Text style={{ color: theme.text, fontSize: 17, fontWeight: "700" }}>{title}</Text>
      {text ? <Text style={{ color: theme.sub, textAlign: "center" }}>{text}</Text> : null}
    </View>
  );
}

/** Product image, or a colored initial tile when there is no image. */
export function Thumb({ title, size = 44 }: { title: string; size?: number }) {
  const hue = hueFor(title);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        backgroundColor: `hsl(${hue}, 45%, 22%)`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: `hsl(${hue}, 80%, 78%)`, fontWeight: "800", fontSize: size * 0.4 }}>
        {title.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={{ color: theme.text, fontSize: 17, fontWeight: "800" }}>{children}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  pillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  btn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    minHeight: 44,
  },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
});
