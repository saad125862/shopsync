import { Banner, Spinner } from "@shopify/polaris";
import type { ReactNode } from "react";

interface Props {
  isLoading: boolean;
  error: unknown;
  children: ReactNode;
}

export function QueryState({ isLoading, error, children }: Props) {
  if (isLoading) return <Spinner accessibilityLabel="Loading" size="large" />;
  if (error)
    return (
      <Banner tone="critical" title="Could not load data">
        {error instanceof Error ? error.message : "Unknown error"}
      </Banner>
    );
  return <>{children}</>;
}
