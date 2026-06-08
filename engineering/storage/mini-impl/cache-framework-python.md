# 手写缓存框架（Python）

## 目标

实现一个简化版缓存框架，支持：
1. TTL 过期
2. LRU / LFU / FIFO 淘汰策略
3. 线程安全（threading.RLock）
4. 事件回调
5. 统计监控
6. functools.lru_cache 风格的函数装饰器

## 实现

```python
# cache_framework.py

import threading
import time
import functools
import heapq
from collections import OrderedDict, defaultdict
from typing import Any, Optional, Callable, Dict, List, Set
from dataclasses import dataclass, field
from enum import Enum, auto


class EventType(Enum):
    GET_HIT = auto()
    GET_MISS = auto()
    SET = auto()
    EXPIRE = auto()
    EVICT = auto()
    DELETE = auto()
    CLEAR = auto()


@dataclass
class Event:
    type: EventType
    key: Optional[str] = None
    value: Any = None
    timestamp: float = field(default_factory=time.time)


@dataclass
class CacheEntry:
    key: str
    value: Any
    created_at: float = field(default_factory=time.time)
    last_access: float = field(default_factory=time.time)
    access_count: int = 1
    expire_at: Optional[float] = None

    def is_expired(self) -> bool:
        if self.expire_at is None:
            return False
        return time.time() > self.expire_at

    @property
    def ttl(self) -> Optional[float]:
        if self.expire_at is None:
            return None
        remaining = self.expire_at - time.time()
        return remaining if remaining > 0 else 0


class EvictionPolicy(Enum):
    LRU = "lru"
    LFU = "lfu"
    FIFO = "fifo"


class Cache:
    """线程安全的本地缓存"""

    def __init__(self,
                 max_size: int = 1000,
                 default_ttl: Optional[float] = None,
                 policy: EvictionPolicy = EvictionPolicy.LRU,
                 cleanup_interval: float = 60.0):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.policy = policy
        self.cleanup_interval = cleanup_interval

        self._store: Dict[str, CacheEntry] = {}
        self._lock = threading.RLock()

        # LRU: OrderedDict 维护顺序
        self._lru: OrderedDict[str, Any] = OrderedDict()

        # LFU: 频率记录
        self._freq: Dict[str, int] = defaultdict(int)
        self._min_freq = 0

        # 事件监听器
        self._listeners: List[Callable[[Event], None]] = []

        # 统计
        self._hits = 0
        self._misses = 0
        self._evictions = 0
        self._expirations = 0

        # 自动清理
        self._cleanup_timer: Optional[threading.Timer] = None
        self._closed = False
        if cleanup_interval > 0:
            self._schedule_cleanup()

    def get(self, key: str) -> Any:
        """获取值"""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                self._emit(Event(EventType.GET_MISS, key))
                raise KeyError(key)

            if entry.is_expired():
                self._remove_entry(key)
                self._expirations += 1
                self._emit(Event(EventType.EXPIRE, key, entry.value))
                self._misses += 1
                raise KeyError(key)

            # 更新访问记录
            entry.last_access = time.time()
            entry.access_count += 1
            self._freq[key] = entry.access_count

            if self.policy == EvictionPolicy.LRU:
                self._lru.move_to_end(key)

            self._hits += 1
            self._emit(Event(EventType.GET_HIT, key, entry.value))
            return entry.value

    def get_or_none(self, key: str) -> Optional[Any]:
        """获取值，不存在返回 None"""
        try:
            return self.get(key)
        except KeyError:
            return None

    def set(self, key: str, value: Any, ttl: Optional[float] = None) -> None:
        """设置值"""
        ttl = ttl if ttl is not None else self.default_ttl
        expire_at = time.time() + ttl if ttl else None

        with self._lock:
            # 已存在则更新
            if key in self._store:
                entry = self._store[key]
                entry.value = value
                entry.expire_at = expire_at
                entry.last_access = time.time()
                if self.policy == EvictionPolicy.LRU:
                    self._lru.move_to_end(key)
                self._emit(Event(EventType.SET, key, value))
                return

            # 检查容量，淘汰
            if len(self._store) >= self.max_size:
                self._evict()

            entry = CacheEntry(
                key=key,
                value=value,
                expire_at=expire_at
            )
            self._store[key] = entry
            self._lru[key] = None
            self._freq[key] = 1
            self._emit(Event(EventType.SET, key, value))

    def delete(self, key: str) -> bool:
        """删除键"""
        with self._lock:
            entry = self._store.get(key)
            if entry:
                self._remove_entry(key)
                self._emit(Event(EventType.DELETE, key, entry.value))
                return True
            return False

    def has(self, key: str) -> bool:
        """检查是否存在（未过期）"""
        try:
            self.get(key)
            return True
        except KeyError:
            return False

    def keys(self) -> List[str]:
        """获取所有未过期的 key"""
        with self._lock:
            now = time.time()
            return [
                key for key, entry in self._store.items()
                if entry.expire_at is None or entry.expire_at > now
            ]

    def clear(self) -> None:
        """清空缓存"""
        with self._lock:
            self._store.clear()
            self._lru.clear()
            self._freq.clear()
            self._emit(Event(EventType.CLEAR))

    def ttl(self, key: str) -> Optional[float]:
        """获取剩余 TTL（秒），-1 表示永不过期，None 表示不存在"""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            return entry.ttl

    def expire(self, key: str, ttl: float) -> bool:
        """设置过期时间"""
        with self._lock:
            entry = self._store.get(key)
            if entry:
                entry.expire_at = time.time() + ttl
                return True
            return False

    def get_or_set(self, key: str, factory: Callable[[], Any], ttl: Optional[float] = None) -> Any:
        """获取或设置"""
        try:
            return self.get(key)
        except KeyError:
            value = factory()
            self.set(key, value, ttl)
            return value

    def get_or_set_async(self, key: str, factory: Callable[[], Any], ttl: Optional[float] = None) -> Any:
        """获取或设置（异步工厂，简化版）"""
        return self.get_or_set(key, factory, ttl)

    def mget(self, keys: List[str]) -> Dict[str, Any]:
        """批量获取"""
        result = {}
        for key in keys:
            try:
                result[key] = self.get(key)
            except KeyError:
                pass
        return result

    def mset(self, mapping: Dict[str, Any], ttl: Optional[float] = None) -> None:
        """批量设置"""
        for key, value in mapping.items():
            self.set(key, value, ttl)

    def _remove_entry(self, key: str) -> None:
        """从所有数据结构中移除"""
        self._store.pop(key, None)
        self._lru.pop(key, None)
        self._freq.pop(key, None)

    def _evict(self) -> None:
        """淘汰一个条目"""
        if not self._store:
            return

        victim_key = None

        if self.policy == EvictionPolicy.LRU:
            # 淘汰最久未使用
            victim_key = next(iter(self._lru))

        elif self.policy == EvictionPolicy.FIFO:
            # 淘汰最早创建
            oldest = float('inf')
            for key, entry in self._store.items():
                if entry.created_at < oldest:
                    oldest = entry.created_at
                    victim_key = key

        elif self.policy == EvictionPolicy.LFU:
            # 淘汰访问次数最少
            min_freq = float('inf')
            for key, entry in self._store.items():
                freq = self._freq.get(key, 0)
                if freq < min_freq:
                    min_freq = freq
                    victim_key = key

        if victim_key:
            entry = self._store.get(victim_key)
            self._remove_entry(victim_key)
            self._evictions += 1
            self._emit(Event(EventType.EVICT, victim_key, entry.value if entry else None))

    def _cleanup(self) -> int:
        """清理过期条目"""
        with self._lock:
            expired = [
                key for key, entry in self._store.items()
                if entry.is_expired()
            ]
            for key in expired:
                entry = self._store.get(key)
                self._remove_entry(key)
                self._expirations += 1
                self._emit(Event(EventType.EXPIRE, key, entry.value if entry else None))
            return len(expired)

    def _schedule_cleanup(self) -> None:
        """调度下次清理"""
        if self._closed:
            return
        self._cleanup_timer = threading.Timer(self.cleanup_interval, self._cleanup_and_reschedule)
        self._cleanup_timer.daemon = True
        self._cleanup_timer.start()

    def _cleanup_and_reschedule(self) -> None:
        self._cleanup()
        self._schedule_cleanup()

    def add_listener(self, listener: Callable[[Event], None]) -> None:
        """添加事件监听器"""
        self._listeners.append(listener)

    def _emit(self, event: Event) -> None:
        """触发事件"""
        for listener in self._listeners:
            try:
                listener(event)
            except Exception:
                pass

    def stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        with self._lock:
            total = self._hits + self._misses
            return {
                'size': len(self._store),
                'max_size': self.max_size,
                'hits': self._hits,
                'misses': self._misses,
                'hit_rate': self._hits / total if total > 0 else 0.0,
                'evictions': self._evictions,
                'expirations': self._expirations,
            }

    def close(self) -> None:
        """关闭缓存"""
        self._closed = True
        if self._cleanup_timer:
            self._cleanup_timer.cancel()
        self.clear()

    def __len__(self) -> int:
        return len(self._store)

    # ========== 函数装饰器 ==========

    def cached(self, ttl: Optional[float] = None, key_fn: Optional[Callable] = None):
        """缓存装饰器"""
        def decorator(func: Callable) -> Callable:
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                if key_fn:
                    cache_key = key_fn(*args, **kwargs)
                else:
                    cache_key = f"{func.__name__}:{args}:{kwargs}"

                try:
                    return self.get(cache_key)
                except KeyError:
                    result = func(*args, **kwargs)
                    self.set(cache_key, result, ttl)
                    return result
            return wrapper
        return decorator


class MultiLevelCache:
    """多级缓存：L1（本地）+ L2（分布式）"""

    def __init__(self, l1: Cache, l2: Optional[Any] = None):
        self.l1 = l1
        self.l2 = l2

    def get(self, key: str) -> Any:
        # L1
        value = self.l1.get_or_none(key)
        if value is not None:
            return value

        # L2
        if self.l2:
            # 假设 l2 有 get 方法
            value = getattr(self.l2, 'get', lambda k: None)(key)
            if value is not None:
                self.l1.set(key, value)
                return value

        raise KeyError(key)

    def set(self, key: str, value: Any, l1_ttl: Optional[float] = None, l2_ttl: Optional[float] = None) -> None:
        self.l1.set(key, value, l1_ttl)
        if self.l2:
            getattr(self.l2, 'set', lambda k, v, t: None)(key, value, l2_ttl)

    def delete(self, key: str) -> None:
        self.l1.delete(key)
        if self.l2:
            getattr(self.l2, 'delete', lambda k: None)(key)


# ========== 使用示例 ==========

# cache = Cache(
#     max_size=100,
#     default_ttl=300.0,
#     policy=EvictionPolicy.LRU,
#     cleanup_interval=60.0
# )
#
# cache.add_listener(lambda e: print(f"[Cache] {e.type.name} key={e.key}"))
#
# # 基础使用
# cache.set("user:1", {"name": "Alice"}, ttl=600)
# user = cache.get("user:1")
#
# # 懒加载
# config = cache.get_or_set("config", load_config, ttl=3600)
#
# # 装饰器
# @cache.cached(ttl=60)
# def expensive_compute(x, y):
#     time.sleep(1)
#     return x + y
#
# result = expensive_compute(1, 2)  # 首次计算
# result = expensive_compute(1, 2)  # 缓存命中
#
# print(cache.stats())
```
