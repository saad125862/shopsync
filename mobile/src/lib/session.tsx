import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { setCurrentSession, type Session } from "./api";
import { storage } from "./storage";

const KEY = "shopsync.session";

interface Ctx {
  ready: boolean;
  session: Session | null;
  connect: (s: Session) => Promise<void>;
  disconnect: () => Promise<void>;
}

const SessionContext = createContext<Ctx>({
  ready: false,
  session: null,
  connect: async () => {},
  disconnect: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await storage.get(KEY);
      if (raw) {
        try {
          const s = JSON.parse(raw) as Session;
          setCurrentSession(s);
          setSession(s);
        } catch {
          /* corrupt value: ignore */
        }
      }
      setReady(true);
    })();
  }, []);

  const connect = useCallback(async (s: Session) => {
    await storage.set(KEY, JSON.stringify(s));
    setCurrentSession(s);
    setSession(s);
  }, []);

  const disconnect = useCallback(async () => {
    await storage.del(KEY);
    setCurrentSession(null);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ ready, session, connect, disconnect }),
    [ready, session, connect, disconnect],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
