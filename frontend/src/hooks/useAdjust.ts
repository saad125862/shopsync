import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { api } from "../api";
import { useToast } from "./useToast";

/** Push a stock change to Shopify; shows a toast with Undo (which applies the inverse change). */
export function useAdjust() {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);

  const refresh = useCallback(() => {
    for (const key of ["inventory", "product", "products", "alerts", "overview"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  }, [qc]);

  const adjust = useCallback(
    async (levelId: number, delta: number, label: string, allowUndo = true) => {
      setBusy(levelId);
      try {
        await api(`/api/inventory/${levelId}/adjust`, {
          method: "POST",
          body: JSON.stringify({ delta }),
        });
        refresh();
        toast.show(`${label}: ${delta > 0 ? "+" : ""}${delta}`, {
          action: allowUndo
            ? {
                label: "Undo",
                onAction: () => {
                  void adjust(levelId, -delta, `Undid ${label}`, false);
                },
              }
            : undefined,
        });
      } catch (e) {
        toast.show((e as Error).message || "Could not update stock", { error: true });
      } finally {
        setBusy(null);
      }
    },
    [refresh, toast],
  );

  return { adjust, busy };
}
