// Vitest setup: guarantee a working `localStorage` under jsdom. Some jsdom /
// vitest combinations don't expose Storage on an opaque origin; this installs a
// minimal, spec-shaped, in-memory Storage only when one is missing. Node-env
// test files (no `window`) are skipped.
if (typeof window !== "undefined" && !window.localStorage) {
  const store = new Map<string, string>();
  const storage: Storage = {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
}
