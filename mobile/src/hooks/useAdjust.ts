import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { api } from "../lib/api";
import { haptic } from "../lib/motion";
import { useToast } from "./toast";

/** Push a stock change to Shopify, with a toast whose Undo applies the inverse change. */
export function useAdjust() {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);

  const adjust = useCallback(
    async (levelId: number, delta: number, label: string, allowUndo = true) => {
      setBusy(levelId);
      haptic("select");
      try {
        await api(`/api/inventory/${levelId}/adjust`, {
          method: "POST",
          body: JSON.stringify({ delta }),
        });
        for (const key of ["product", "products", "alerts", "overview"]) {
          qc.invalidateQueries({ queryKey: [key] });
        }
        toast.show(`${label}: ${delta > 0 ? "+" : ""}${delta}`, {
          action: allowUndo
            ? { label: "Undo", onAction: () => void adjust(levelId, -delta, `Undid ${label}`, false) }
            : undefined,
        });
      } catch (e) {
        toast.show((e as Error).message || "Couldn't update stock", { error: true });
      } finally {
        setBusy(null);
      }
    },
    [qc, toast],
  );

  return { adjust, busy };
}
