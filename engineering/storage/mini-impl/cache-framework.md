# 手写缓存框架

## 目标

实现一个简化版缓存框架，支持：
1. TTL 过期
2. LRU / LFU 淘汰策略
3. 并发安全
4. 事件监听
5. 统计监控
6. 多级缓存适配

## 实现

```java
// CacheFramework.java

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.function.Function;

// ========== 核心接口 ==========

public interface Cache<K, V> {
    V get(K key);
    void put(K key, V value);
    void put(K key, V value, long ttlMillis);
    V computeIfAbsent(K key, Function<K, V> loader);
    V computeIfAbsent(K key, Function<K, V> loader, long ttlMillis);
    boolean remove(K key);
    void clear();
    long size();
    CacheStats stats();
    void addListener(CacheEventListener<K, V> listener);
    void removeListener(CacheEventListener<K, V> listener);
}

public interface CacheEventListener<K, V> {
    void onEvent(CacheEvent<K, V> event);
}

public enum CacheEventType {
    PUT, GET_HIT, GET_MISS, EXPIRE, EVICT, REMOVE, CLEAR
}

public class CacheEvent<K, V> {
    public final CacheEventType type;
    public final K key;
    public final V value;
    public final long timestamp;
    
    CacheEvent(CacheEventType type, K key, V value) {
        this.type = type;
        this.key = key;
        this.value = value;
        this.timestamp = System.currentTimeMillis();
    }
}

// ========== 缓存配置 ==========

public class CacheConfig {
    private int maxSize = 1000;
    private long defaultTtl = -1;  // -1 = 永不过期
    private EvictionPolicy evictionPolicy = EvictionPolicy.LRU;
    private boolean recordStats = true;
    private boolean autoCleanup = true;
    private long cleanupInterval = 60_000;  // 60 秒
    
    // Builder...
    public CacheConfig maxSize(int maxSize) { this.maxSize = maxSize; return this; }
    public CacheConfig defaultTtl(long ttl) { this.defaultTtl = ttl; return this; }
    public CacheConfig evictionPolicy(EvictionPolicy policy) { this.evictionPolicy = policy; return this; }
    public CacheConfig recordStats(boolean record) { this.recordStats = record; return this; }
}

public enum EvictionPolicy {
    LRU, LFU, FIFO
}

// ========== 缓存条目 ==========

class CacheEntry<V> {
    V value;
    long createTime;
    long expireTime;  // -1 = 永不过期
    long lastAccessTime;
    long accessCount;
    
    CacheEntry(V value, long ttlMillis) {
        this.value = value;
        this.createTime = System.currentTimeMillis();
        this.expireTime = ttlMillis > 0 ? createTime + ttlMillis : -1;
        this.lastAccessTime = createTime;
        this.accessCount = 1;
    }
    
    boolean isExpired() {
        return expireTime > 0 && System.currentTimeMillis() > expireTime;
    }
    
    void recordAccess() {
        this.lastAccessTime = System.currentTimeMillis();
        this.accessCount++;
    }
}

// ========== 本地缓存实现 ==========

public class LocalCache<K, V> implements Cache<K, V> {
    private final String name;
    private final CacheConfig config;
    private final Map<K, CacheEntry<V>> store;
    private final ReadWriteLock lock = new ReentrantReadWriteLock();
    private final List<CacheEventListener<K, V>> listeners = new CopyOnWriteArrayList<>();
    private final CacheStats stats = new CacheStats();
    private final ScheduledExecutorService cleanupExecutor;

    public LocalCache(String name, CacheConfig config) {
        this.name = name;
        this.config = config;
        this.store = createStore(config.evictionPolicy);
        
        if (config.autoCleanup) {
            this.cleanupExecutor = Executors.newSingleThreadScheduledExecutor(
                r -> new Thread(r, "cache-cleanup-" + name)
            );
            this.cleanupExecutor.scheduleWithFixedDelay(
                this::cleanup, config.cleanupInterval, config.cleanupInterval, TimeUnit.MILLISECONDS
            );
        } else {
            this.cleanupExecutor = null;
        }
    }

    private Map<K, CacheEntry<V>> createStore(EvictionPolicy policy) {
        switch (policy) {
            case LRU:
                return new LinkedHashMap<K, CacheEntry<V>>(16, 0.75f, true) {
                    @Override
                    protected boolean removeEldestEntry(Map.Entry<K, CacheEntry<V>> eldest) {
                        boolean shouldRemove = size() > config.maxSize;
                        if (shouldRemove) {
                            notifyEvent(CacheEventType.EVICT, eldest.getKey(), eldest.getValue().value);
                            stats.recordEviction();
                        }
                        return shouldRemove;
                    }
                };
            case LFU:
                return new ConcurrentHashMap<>();  // LFU 需自定义
            case FIFO:
                return new LinkedHashMap<K, CacheEntry<V>>(16, 0.75f, false) {
                    @Override
                    protected boolean removeEldestEntry(Map.Entry<K, CacheEntry<V>> eldest) {
                        return size() > config.maxSize;
                    }
                };
            default:
                return new ConcurrentHashMap<>();
        }
    }

    @Override
    public V get(K key) {
        lock.readLock().lock();
        try {
            CacheEntry<V> entry = store.get(key);
            if (entry == null) {
                stats.recordMiss();
                notifyEvent(CacheEventType.GET_MISS, key, null);
                return null;
            }
            
            if (entry.isExpired()) {
                lock.readLock().unlock();
                lock.writeLock().lock();
                try {
                    // 双重检查
                    entry = store.get(key);
                    if (entry != null && entry.isExpired()) {
                        store.remove(key);
                        stats.recordExpiration();
                        notifyEvent(CacheEventType.EXPIRE, key, entry.value);
                    }
                } finally {
                    lock.writeLock().unlock();
                }
                lock.readLock().lock();
                stats.recordMiss();
                return null;
            }
            
            entry.recordAccess();
            stats.recordHit();
            notifyEvent(CacheEventType.GET_HIT, key, entry.value);
            return entry.value;
        } finally {
            lock.readLock().unlock();
        }
    }

    @Override
    public void put(K key, V value) {
        put(key, value, config.defaultTtl);
    }

    @Override
    public void put(K key, V value, long ttlMillis) {
        lock.writeLock().lock();
        try {
            CacheEntry<V> entry = new CacheEntry<>(value, ttlMillis);
            CacheEntry<V> old = store.put(key, entry);
            
            if (old != null) {
                notifyEvent(CacheEventType.EVICT, key, old.value);
            }
            notifyEvent(CacheEventType.PUT, key, value);
        } finally {
            lock.writeLock().unlock();
        }
    }

    @Override
    public V computeIfAbsent(K key, Function<K, V> loader) {
        return computeIfAbsent(key, loader, config.defaultTtl);
    }

    @Override
    public V computeIfAbsent(K key, Function<K, V> loader, long ttlMillis) {
        V value = get(key);
        if (value != null) return value;
        
        lock.writeLock().lock();
        try {
            // 双重检查
            CacheEntry<V> entry = store.get(key);
            if (entry != null && !entry.isExpired()) {
                return entry.value;
            }
            
            value = loader.apply(key);
            if (value != null) {
                put(key, value, ttlMillis);
            }
            return value;
        } finally {
            lock.writeLock().unlock();
        }
    }

    @Override
    public boolean remove(K key) {
        lock.writeLock().lock();
        try {
            CacheEntry<V> entry = store.remove(key);
            if (entry != null) {
                notifyEvent(CacheEventType.REMOVE, key, entry.value);
                return true;
            }
            return false;
        } finally {
            lock.writeLock().unlock();
        }
    }

    @Override
    public void clear() {
        lock.writeLock().lock();
        try {
            store.clear();
            notifyEvent(CacheEventType.CLEAR, null, null);
        } finally {
            lock.writeLock().unlock();
        }
    }

    @Override
    public long size() {
        lock.readLock().lock();
        try {
            return store.size();
        } finally {
            lock.readLock().unlock();
        }
    }

    @Override
    public CacheStats stats() {
        return stats.snapshot();
    }

    private void cleanup() {
        lock.writeLock().lock();
        try {
            Iterator<Map.Entry<K, CacheEntry<V>>> it = store.entrySet().iterator();
            while (it.hasNext()) {
                Map.Entry<K, CacheEntry<V>> entry = it.next();
                if (entry.getValue().isExpired()) {
                    it.remove();
                    stats.recordExpiration();
                    notifyEvent(CacheEventType.EXPIRE, entry.getKey(), entry.getValue().value);
                }
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void notifyEvent(CacheEventType type, K key, V value) {
        if (listeners.isEmpty()) return;
        CacheEvent<K, V> event = new CacheEvent<>(type, key, value);
        for (CacheEventListener<K, V> listener : listeners) {
            try {
                listener.onEvent(event);
            } catch (Exception e) {
                // ignore listener errors
            }
        }
    }

    @Override
    public void addListener(CacheEventListener<K, V> listener) {
        listeners.add(listener);
    }

    @Override
    public void removeListener(CacheEventListener<K, V> listener) {
        listeners.remove(listener);
    }

    public void shutdown() {
        if (cleanupExecutor != null) {
            cleanupExecutor.shutdown();
        }
    }
}

// ========== 统计 ==========

public class CacheStats {
    private final AtomicLong hits = new AtomicLong(0);
    private final AtomicLong misses = new AtomicLong(0);
    private final AtomicLong evictions = new AtomicLong(0);
    private final AtomicLong expirations = new AtomicLong(0);
    private final AtomicLong totalLoadTime = new AtomicLong(0);

    void recordHit() { hits.incrementAndGet(); }
    void recordMiss() { misses.incrementAndGet(); }
    void recordEviction() { evictions.incrementAndGet(); }
    void recordExpiration() { expirations.incrementAndGet(); }

    public long hitCount() { return hits.get(); }
    public long missCount() { return misses.get(); }
    public long evictionCount() { return evictions.get(); }
    public long expirationCount() { return expirations.get(); }
    
    public double hitRate() {
        long total = hits.get() + misses.get();
        return total == 0 ? 0.0 : (double) hits.get() / total;
    }
    
    public double missRate() {
        return 1.0 - hitRate();
    }

    CacheStats snapshot() {
        CacheStats s = new CacheStats();
        s.hits.set(hits.get());
        s.misses.set(misses.get());
        s.evictions.set(evictions.get());
        s.expirations.set(expirations.get());
        return s;
    }

    @Override
    public String toString() {
        return String.format("CacheStats{hits=%d, misses=%d, hitRate=%.2f%%, evictions=%d, expirations=%d}",
            hitCount(), missCount(), hitRate() * 100, evictionCount(), expirationCount());
    }
}

// ========== 使用 ==========

public class Main {
    public static void main(String[] args) {
        CacheConfig config = new CacheConfig()
            .maxSize(100)
            .defaultTtl(5000)
            .evictionPolicy(EvictionPolicy.LRU)
            .recordStats(true);
        
        Cache<String, String> cache = new LocalCache<>("user-cache", config);
        
        cache.addListener(event -> {
            System.out.println("Event: " + event.type + " key=" + event.key);
        });
        
        // 放入
        cache.put("user:1", "Alice");
        cache.put("user:2", "Bob", 10000);  // 10 秒 TTL
        
        // 读取
        String user1 = cache.get("user:1");
        System.out.println("User 1: " + user1);
        
        // 懒加载
        String user3 = cache.computeIfAbsent("user:3", k -> loadFromDB(k));
        
        System.out.println(cache.stats());
        
        ((LocalCache<String, String>) cache).shutdown();
    }
    
    static String loadFromDB(String key) {
        // 模拟数据库查询
        return "User from DB: " + key;
    }
}
```
