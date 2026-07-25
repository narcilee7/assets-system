const { EventEmitter } = require("events");

class Cache extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || null;
    this.policy = options.policy || 'lru'; // lru lfu fifo
    this.cleanupInterval = options.cleanupInterval || 60000;

    this.store = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };
    this.freqMap = new Map();

    this.cleanupTimer = null;

    if (this.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.cleanupInterval);
    } 
  }

  get(key) {
    const entry = this.store.get(key);

    if (!entry) {
      this.stats.misses++;
      this.emit('miss', { key });
      return undefined;
    }

    if (this._isExpired(entry)) {
      this.store.delete(key);
      this.freqMap.delete(key);
      this.stats.expirations++;
      this.emit("expire", { key, value: entry.value });
      this.stats.misses++;
      return undefined;
    }

    entry.lastAccess = Date.now();
    
  }
}