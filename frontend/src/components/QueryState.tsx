import { Banner } from "@shopify/polaris";
import type { ReactNode } from "react";

interface Props {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  skeleton?: "table" | "cards";
  children: ReactNode;
}

export function Skeleton({ h = 16, w = "100%" }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w }} aria-hidden="true" />;
}

function TableSkeleton() {
  return (
    <div role="status" aria-label="Loading" style={{ display: "grid", gap: 14, padding: 16 }}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Skeleton h={36} w={36} />
          <Skeleton h={14} w="30%" />
          <Skeleton h={14} w="15%" />
          <Skeleton h={14} w="20%" />
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="kpi-grid">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="kpi" style={{ ["--i" as string]: i }}>
          <Skeleton h={12} w="50%" />
          <div style={{ height: 12 }} />
          <Skeleton h={30} w="70%" />
        </div>
      ))}
    </div>
  );
}

export function QueryState({ isLoading, error, onRetry, skeleton = "table", children }: Props) {
  if (isLoading) return skeleton === "cards" ? <CardsSkeleton /> : <TableSkeleton />;
  if (error)
    return (
      <Banner
        tone="critical"
        title="Couldn't load this page"
        action={onRetry ? { content: "Try again", onAction: onRetry } : undefined}
      >
        {error instanceof Error ? error.message : "Something went wrong."}
      </Banner>
    );
  return <>{children}</>;
}
