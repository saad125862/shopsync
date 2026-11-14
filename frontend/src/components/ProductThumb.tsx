import { hueFor } from "../lib/format";

interface Props {
  title: string;
  url?: string;
  size?: number;
}

/** Product image, or a colored initial tile like Shopify's placeholder when there is no image. */
export function ProductThumb({ title, url, size = 40 }: Props) {
  const style = {
    width: size,
    height: size,
    borderRadius: 8,
    flex: "none" as const,
    border: "1px solid var(--m-border)",
  };
  if (url) return <img src={url} alt="" style={{ ...style, objectFit: "cover" }} />;
  const hue = hueFor(title);
  return (
    <div
      aria-hidden="true"
      style={{
        ...style,
        display: "grid",
        placeItems: "center",
        background: `hsl(${hue} 40% 20%)`,
        color: `hsl(${hue} 70% 75%)`,
        fontWeight: 600,
        fontSize: size * 0.4,
      }}
    >
      {title.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}
