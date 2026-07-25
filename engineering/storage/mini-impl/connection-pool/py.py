import threading
import queue
import time
import uuid
import logging
from contextlib import contextmanager
from typing import Optional, Callable, Any, Dict

logger = logging.getLogger(__name__)

class PooledConnection:
  def __init__(self, raw_conn, pool):
    self.raw = raw_conn
    self.pool = pool
    self.id = str(uuid.uuid4())[:8]
    self.created_at = time.time()
    self.last_used_at = time.time()
    self._in_use = False
    self._closed = False

  def __enter__(self):
    return self.raw

  def __exit__(self, exc_type, exc, tb):
    self.release()
    return False

  def release(self):
    if self.pool and not self._closed:
      self.pool._release(self)

  def ping(self) -> bool:
    try:
      if hasattr(self.raw, "ping"):
        self.raw.ping(reconnect=False)
        return True
      cursor = self.raw.cursor()
      cursor.execute("SELECT 1")
      cursor.fetchone()
      cursor.close()
      return True
    except Exception:
      return False

class PoolConfig:
    def __init__(self,
                 connection_factory: Callable[[], Any],
                 min_idle: int = 2,
                 max_active: int = 10,
                 max_wait: float = 30.0,
                 max_lifetime: float = 1800.0,
                 idle_timeout: float = 600.0,
                 leak_detection_threshold: float = 0.0,
                 validation_query: str = "SELECT 1"):
        self.connection_factory = connection_factory
        self.min_idle = min_idle
        self.max_active = max_active
        self.max_wait = max_wait
        self.max_lifetime = max_lifetime
        self.idle_timeout = idle_timeout
        self.leak_detection_threshold = leak_detection_threshold
        self.validation_query = validation_query

class ConnectionPool:
  def __init__(self, config: PoolConfig):
    self.config = config
    