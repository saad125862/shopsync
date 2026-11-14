import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { dur, haptic, native } from "../lib/motion";
import { theme } from "../lib/theme";

/** Fades and slides children up; use `index` to stagger list items. */
export function FadeIn({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: dur(380),
      delay: dur(Math.min(index, 10) * 55),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    }).start();
  }, [v, index]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable that squishes slightly and gives a light haptic tap. */
export function Tap({
  onPress,
  children,
  style,
  disabled,
  label,
  haptics = true,
  wrapStyle,
}: {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Style for the outer Pressable (use for flex/width in rows). */
  wrapStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  label?: string;
  haptics?: boolean;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (value: number) =>
    Animated.spring(s, { toValue: value, useNativeDriver: native, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      style={wrapStyle}
      onPressIn={() => to(0.96)}
      onPressOut={() => to(1)}
      onPress={() => {
        if (haptics) haptic("light");
        onPress?.();
      }}
    >
      <Animated.View style={[style, { transform: [{ scale: s }], opacity: disabled ? 0.4 : 1 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/** Number that counts up to its value. */
export function CountUp({
  value,
  format = (n: number) => String(Math.round(n)),
  style,
}: {
  value: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const v = new Animated.Value(from.current);
    const id = v.addListener(({ value: x }) => setShown(x));
    Animated.timing(v, {
      toValue: value,
      duration: dur(900),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      from.current = value;
    });
    return () => v.removeListener(id);
  }, [value]);
  return <Text style={style}>{format(shown)}</Text>;
}

/** Shimmering placeholder block. */
export function Skeleton({
  h = 16,
  w = "100%",
  r = 8,
}: {
  h?: number;
  w?: number | `${number}%`;
  r?: number;
}) {
  const v = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.9, duration: 700, useNativeDriver: native }),
        Animated.timing(v, { toValue: 0.4, duration: 700, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={{ height: h, width: w, borderRadius: r, backgroundColor: theme.card2, opacity: v }}
    />
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View style={{ padding: 16, gap: 14 }} accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Skeleton h={44} w={44} r={10} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton h={14} w="60%" />
            <Skeleton h={12} w="35%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Pulsing glow dot for live/urgent status. */
export function PulseDot({ color, size = 10 }: { color: string; size?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: dur(1600), easing: Easing.out(Easing.ease), useNativeDriver: native }),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ width: size * 2.4, height: size * 2.4, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Progress ring that fills in. `progress` is 0..1. */
export function Ring({
  progress,
  size = 56,
  stroke = 6,
  label,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: progress,
      duration: dur(900),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [v, progress]);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.border} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={v.interpolate({ inputRange: [0, 1], outputRange: [c, 0] })}
        />
      </Svg>
      {label ? (
        <Text style={{ position: "absolute", color: theme.text, fontWeight: "700", fontSize: size * 0.28 }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Sales sparkline that draws itself in. */
export function Sparkline({
  data,
  width = 300,
  height = 64,
  color = theme.primary,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const pts = data.map((d, i) => [i * step, height - 4 - (d / max) * (height - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const len = pts.reduce((acc, p, i) => (i ? acc + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0) + 1;
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: dur(1100),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [v, d]);
  if (data.length < 2) return <View style={{ height }} />;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <AnimatedPath
        d={d}
        stroke={color}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${len} ${len}`}
        strokeDashoffset={v.interpolate({ inputRange: [0, 1], outputRange: [len, 0] })}
      />
    </Svg>
  );
}
