function persist(cfg, opts) {
  return (set, api, api) => {
    const { name, storage = localStorage, partialize = (s) => state } = opts;

    try {
      const stored = storage.getItem(name);
      if (stored) {
        set(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to hydrate", e);
    }

    const originalSet = api.getState
  }
}