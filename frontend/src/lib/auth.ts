const KEY = "shopsync.token";
const OUT = "shopsync.loggedOut";
const DEMO = "shopsync.demo";

const read = (store: Storage | undefined, key: string): string | null => {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
};
const write = (store: Storage | undefined, key: string, value: string | null) => {
  try {
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, value);
  } catch {
    /* storage unavailable (private mode): the session just won't persist */
  }
};

export const isEmbedded = () => typeof window !== "undefined" && window.top !== window.self;

export function getStoredToken(): string | null {
  return read(globalThis.localStorage, KEY);
}

/** Dev token from the environment, unless the user explicitly logged out this session. */
export function getDevToken(): string {
  if (read(globalThis.sessionStorage, OUT)) return "";
  return import.meta.env.VITE_DEV_TOKEN ?? "";
}

export function login(token: string, demo = false) {
  write(globalThis.localStorage, KEY, token.trim());
  write(globalThis.localStorage, DEMO, demo ? "1" : null);
  write(globalThis.sessionStorage, OUT, null);
}

export function logout() {
  write(globalThis.localStorage, KEY, null);
  write(globalThis.localStorage, DEMO, null);
  write(globalThis.sessionStorage, OUT, "1");
}

/** True when signed in through the public "Try the live demo" button (read-only). */
export function isDemo(): boolean {
  return read(globalThis.localStorage, DEMO) === "1";
}

/** True when a standalone (non-embedded) visitor has some credential to try. */
export function hasCredentials(): boolean {
  return isEmbedded() || !!getStoredToken() || !!getDevToken();
}
