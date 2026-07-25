import threading
import time
import functools

from collections import OrderedDict, defaultdict
from typing import Any, Optional, Callable, Dict, List
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
  value: Any
  timestamp: float = field(default_factory=time.time)

@dataclass
class CacheEntry:
  key: str
  value: Any
  created_at: float = field(default_factory=time.time)
  last_access: float = field(default_factory=time.time)
  access_count: int = 1
  expred_at: Optional[float] = None

  def is_expired(self) -> bool:
    if self.is_expired is None:
      return False

    return time.time() > self.expred_at

  @property
  def ttl(self) -> Optional[float]:
    if self.expred_at is None:
      return None

    remaining = self.expred_at - time.time()

    return remaining if remaining > 0 else 0

class EvictionPolicy(Enum):
  LRU = "lru"
  LFU = "lfu"
  FIFO = "fifo"

class Cache:
  def __init__(
      self,
      max_size: int = 1000,
      defualt_ttl: Optional[float] = None,
      policy: EvictionPolicy = EvictionPolicy.LRU,
      cleanup_inteval: float = 60.0
  ):
    self.max_size = max_size
    self.default_ttl = defualt_ttl
    self.policy = policy
    self.cleanup_interval = self.cleanup_interval

    self._store: Dict[str, CacheEntry] = {}
    self._lock = threading.Lock()

    self._lru: OrderedDict[str, Any] = OrderedDict()

    self._freq: Dict[str, int] = defaultdict(int)
    self._min_freq = 0

    self._listeners: List[Callable[[Event], None]] = None

    self._hits = 0
    self._misses = 0
    self._evictions = 0
    self._expirations = 0

    self._cleanup_timer: Optional[threading.Timer] = None
    self._closed = False

    if cleanup_inteval > 0:
      self._schedule_cleanup()

  def get(self, key: str) -> Any:
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

      entry.last_access = time.time()
      entry.access_count += 1
      self._freq[key] = entry.access_count

      if self.policy == EvictionPolicy.LRU:
        self._lru_move_to_end(key)

      self._hits += 1
      self._emit(Event)