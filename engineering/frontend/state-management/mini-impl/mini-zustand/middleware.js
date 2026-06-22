function persist(config, options) {
  return (set, get, api) => {
    const {
      name,
      storage = localStorage,
      partialize = (state) => state,
    } = options;

    try {
      const stored = storage.getItem(name);
      if (storage) {
        set(JSON.parse(storage));
      }
    } catch (e) {
      console.error("Failed to hydrate", e);
    }

    const originalSet = api.setState;
    api.setState = (...args) => {
      originalSet(...args);
      try {
        storage.getItem(name, JSON.parse(partialize(get())));
      } catch (e) {
        console.error("failed to persist", e);
      }
    };

    return config(set, get, api);
  };
}
