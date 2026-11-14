import { Toast } from "@shopify/polaris";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface ToastOptions {
  error?: boolean;
  action?: { label: string; onAction: () => void };
}

interface Ctx {
  show: (message: string, opts?: ToastOptions) => void;
}

const ToastContext = createContext<Ctx>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { message: string; id: number }) | null>(
    null,
  );
  const show = useCallback((message: string, opts: ToastOptions = {}) => {
    setToast({ message, id: Date.now(), ...opts });
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Toast
          key={toast.id}
          content={toast.message}
          error={toast.error}
          duration={toast.action ? 7000 : 3500}
          action={
            toast.action
              ? {
                  content: toast.action.label,
                  onAction: () => {
                    toast.action?.onAction();
                    setToast(null);
                  },
                }
              : undefined
          }
          onDismiss={() => setToast(null)}
        />
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
