/** "Sunset commerce": dark, warm, orange energy. */
export const theme = {
  bg: "#17110f",
  card: "#221915",
  card2: "#2b201b",
  text: "#fbeee6",
  sub: "#b39a8c",
  border: "#3a2b24",
  primary: "#ff7a3d",
  onPrimary: "#2a1204",
  danger: "#ff6b6b",
  warn: "#ffc247",
  ok: "#4ade80",
  info: "#6aa8ff",
  radius: 14,
};

export type Theme = typeof theme;

/** Kept as a hook so screens read like they would with a switchable theme. */
export function useTheme(): Theme {
  return theme;
}
