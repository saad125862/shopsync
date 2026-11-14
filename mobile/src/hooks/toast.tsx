import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Animated, Easing, Text, View } from "react-native";

import { Tap } from "../components/motion";
import { dur, haptic, native } from "../lib/motion";
import { theme } from "../lib/theme";

interface Opts {
  error?: boolean;
  action?: { label: string; onAction: () => void };
}
interface Item extends Opts {
  id: number;
  message: string;
}

const Ctx = createContext<{ show: (m: string, o?: Opts) => void }>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<Item | null>(null);
  const v = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(v, { toValue: 0, duration: dur(200), useNativeDriver: native }).start(() =>
      setItem(null),
    );
  }, [v]);

  const show = useCallback(
    (message: string, opts: Opts = {}) => {
      if (timer.current) clearTimeout(timer.current);
      setItem({ id: Date.now(), message, ...opts });
      haptic(opts.error ? "error" : "success");
    },
    [],
  );

  useEffect(() => {
    if (!item) return;
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: dur(280),
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: native,
    }).start();
    timer.current = setTimeout(hide, item.action ? 6500 : 3200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [item, v, hide]);

  const value = useMemo(() => ({ show }), [show]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {item && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 96,
            opacity: v,
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          }}
        >
          <View
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: theme.card2,
              borderColor: item.error ? theme.danger : theme.border,
              borderWidth: 1,
              borderRadius: 14,
              paddingVertical: 10,
              paddingHorizontal: 14,
            }}
          >
            <Text style={{ color: theme.text, flex: 1 }}>{item.message}</Text>
            {item.action && (
              <Tap
                label={item.action.label}
                onPress={() => {
                  item.action?.onAction();
                  hide();
                }}
              >
                <Text style={{ color: theme.primary, fontWeight: "800", padding: 6 }}>{item.action.label}</Text>
              </Tap>
            )}
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
