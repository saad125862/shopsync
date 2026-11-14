import * as Haptics from "expo-haptics";
import { AccessibilityInfo, Platform } from "react-native";

export const native = Platform.OS !== "web";

let reducedMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => {
    reducedMotion = v;
  })
  .catch(() => {});
AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => {
  reducedMotion = v;
});

export const isReduced = () => reducedMotion;

/** Duration helper: collapses to ~0 when the user prefers reduced motion. */
export const dur = (ms: number) => (reducedMotion ? 1 : ms);

type Kind = "light" | "medium" | "success" | "warning" | "error" | "select";

/** Haptic feedback; silently does nothing on web or unsupported devices. */
export function haptic(kind: Kind = "light") {
  if (!native) return;
  try {
    switch (kind) {
      case "light":
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case "medium":
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case "select":
        void Haptics.selectionAsync();
        break;
      case "success":
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case "warning":
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case "error":
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    /* haptics unavailable */
  }
}
