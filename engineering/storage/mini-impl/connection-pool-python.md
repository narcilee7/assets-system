# 手写数据库连接池（Python）

## 目标

实现一个简化版数据库连接池，支持：
1. 连接复用（适配 `psycopg2` / `pymysql` / 通用 DBAPI）
2. 最大/最小连接数控制
3. 连接超时获取
4. 空闲连接检测与回收
5. 连接泄漏检测
6. 上下文管理器支持

## 实现

```python
# connection_pool.py

import threading
import queue
import time
import uuid
import logging
from contextlib import contextmanager
from typing import Optional, Callable, Any, Dict

logger = logging.getLogger(__name__)


class PooledConnection:
    """包装连接，附加元数据"""
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

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()
        return False

    def release(self):
        """归还连接到池中"""
        if self.pool and not self._closed:
            self.pool._release(self)

    def close(self):
        """实际关闭连接"""
        self._closed = True
        if hasattr(self.raw, 'close'):
            self.raw.close()

    def ping(self) -> bool:
        """检查连接是否有效"""
        try:
            if hasattr(self.raw, 'ping'):
                self.raw.ping(reconnect=False)
                return True
            # fallback: 尝试执行简单查询
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
        self._idle_connections: list[PooledConnection] = []
        self._active_connections: Dict[str, PooledConnection] = {}
        self._wait_queue: queue.Queue = queue.Queue()
        self._lock = threading.RLock()
        self._condition = threading.Condition(self._lock)
        self._closed = False
        self._total_count = 0
        self._house_keeper: Optional[threading.Thread] = None
        self._stop_house_keeper = threading.Event()

        # 统计
        self._stats = {
            'hits': 0,
            'misses': 0,
            'timeouts': 0,
        }

        # 初始化
        self._initialize()
        self._start_house_keeper()

    def _initialize(self):
        """初始化最小连接数"""
        for _ in range(self.config.min_idle):
            try:
                conn = self._create_connection()
                if conn:
                    self._idle_connections.append(conn)
            except Exception as e:
                logger.warning(f"Failed to create initial connection: {e}")

    def _create_connection(self) -> Optional[PooledConnection]:
        """创建新连接"""
        if self._total_count >= self.config.max_active:
            return None

        raw = self.config.connection_factory()
        self._total_count += 1
        conn = PooledConnection(raw, self)
        logger.debug(f"Created connection {conn.id}, total={self._total_count}")
        return conn

    def get_connection(self, timeout: Optional[float] = None) -> PooledConnection:
        """获取连接"""
        if self._closed:
            raise RuntimeError("Pool is closed")

        timeout = timeout or self.config.max_wait
        deadline = time.time() + timeout

        with self._lock:
            # 1. 尝试获取空闲连接
            while self._idle_connections:
                conn = self._idle_connections.pop()
                if self._is_valid(conn):
                    conn._in_use = True
                    conn.last_used_at = time.time()
                    self._active_connections[conn.id] = conn
                    self._stats['hits'] += 1
                    self._setup_leak_detection(conn)
                    return conn
                else:
                    self._destroy_connection(conn)

            # 2. 尝试创建新连接
            if self._total_count < self.config.max_active:
                self._total_count += 1
                try:
                    raw = self.config.connection_factory()
                    conn = PooledConnection(raw, self)
                    conn._in_use = True
                    self._active_connections[conn.id] = conn
                    self._stats['misses'] += 1
                    self._setup_leak_detection(conn)
                    return conn
                except Exception as e:
                    self._total_count -= 1
                    raise

            # 3. 等待
            self._stats['misses'] += 1

        # 在锁外等待
        remaining = deadline - time.time()
        if remaining <= 0:
            self._stats['timeouts'] += 1
            raise TimeoutError(
                f"Timeout waiting for connection ({timeout}s). "
                f"active={len(self._active_connections)}, "
                f"idle={len(self._idle_connections)}, "
                f"total={self._total_count}"
            )

        with self._lock:
            if self._condition.wait(timeout=remaining):
                # 被唤醒后重试
                return self.get_connection(timeout=0)

        self._stats['timeouts'] += 1
        raise TimeoutError(f"Timeout waiting for connection ({timeout}s)")

    @contextmanager
    def connection(self, timeout: Optional[float] = None):
        """上下文管理器获取连接"""
        conn = self.get_connection(timeout)
        try:
            yield conn.raw
        finally:
            conn.release()

    def _release(self, conn: PooledConnection):
        """归还连接（内部方法）"""
        with self._lock:
            if conn.id in self._active_connections:
                del self._active_connections[conn.id]

            conn._in_use = False

            if self._closed or not self._is_valid(conn):
                self._destroy_connection(conn)
                self._condition.notify()
                return

            if time.time() - conn.created_at > self.config.max_lifetime:
                self._destroy_connection(conn)
                self._ensure_min_idle()
                self._condition.notify()
                return

            # 优先给等待者
            if not self._wait_queue.empty():
                self._wait_queue.get_nowait()
                conn._in_use = True
                self._active_connections[conn.id] = conn
                self._setup_leak_detection(conn)
                return

            conn.last_used_at = time.time()
            self._idle_connections.append(conn)
            self._condition.notify()

    def _is_valid(self, conn: PooledConnection) -> bool:
        """检查连接有效性"""
        if conn._closed:
            return False
        try:
            return conn.ping()
        except Exception:
            return False

    def _destroy_connection(self, conn: PooledConnection):
        """销毁连接"""
        self._total_count -= 1
        try:
            conn.close()
        except Exception:
            pass
        logger.debug(f"Destroyed connection {conn.id}, total={self._total_count}")

    def _setup_leak_detection(self, conn: PooledConnection):
        """设置泄漏检测"""
        threshold = self.config.leak_detection_threshold
        if threshold <= 0:
            return

        def check_leak():
            time.sleep(threshold)
            if conn.id in self._active_connections:
                logger.error(
                    f"Connection leak detected: {conn.id}, "
                    f"borrowed for more than {threshold}s"
                )

        threading.Thread(target=check_leak, daemon=True).start()

    def _start_house_keeper(self):
        """启动 housekeeping 线程"""
        def housekeeping():
            while not self._stop_house_keeper.is_set():
                self._stop_house_keeper.wait(30)
                if not self._stop_house_keeper.is_set():
                    self._house_keep()

        self._house_keeper = threading.Thread(target=housekeeping, daemon=True)
        self._house_keeper.start()

    def _house_keep(self):
        """清理超时空闲连接"""
        with self._lock:
            now = time.time()
            valid_idle = []
            for conn in self._idle_connections:
                if now - conn.last_used_at > self.config.idle_timeout:
                    if len(valid_idle) + len(self._active_connections) >= self.config.min_idle:
                        self._destroy_connection(conn)
                        continue
                valid_idle.append(conn)
            self._idle_connections = valid_idle

            self._ensure_min_idle()

    def _ensure_min_idle(self):
        """确保最小连接数"""
        needed = self.config.min_idle - len(self._idle_connections) - len(self._active_connections)
        for _ in range(max(0, needed)):
            if self._total_count >= self.config.max_active:
                break
            try:
                conn = self._create_connection()
                if conn:
                    self._idle_connections.append(conn)
            except Exception:
                break

    def stats(self) -> dict:
        """获取统计信息"""
        with self._lock:
            total = self._stats['hits'] + self._stats['misses']
            return {
                'total': self._total_count,
                'active': len(self._active_connections),
                'idle': len(self._idle_connections),
                'max': self.config.max_active,
                'hits': self._stats['hits'],
                'misses': self._stats['misses'],
                'hit_rate': self._stats['hits'] / total if total > 0 else 0,
            }

    def close(self):
        """关闭连接池"""
        self._closed = True
        self._stop_house_keeper.set()

        with self._lock:
            for conn in list(self._active_connections.values()):
                self._destroy_connection(conn)
            self._active_connections.clear()

            for conn in self._idle_connections:
                self._destroy_connection(conn)
            self._idle_connections.clear()

        if self._house_keeper:
            self._house_keeper.join(timeout=5)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False


# ========== 使用示例 ==========

# import psycopg2
#
# def create_conn():
#     return psycopg2.connect(
#         host="localhost",
#         database="mydb",
#         user="user",
#         password="pass"
#     )
#
# pool = ConnectionPool(PoolConfig(
#     connection_factory=create_conn,
#     min_idle=2,
#     max_active=10,
#     leak_detection_threshold=30.0
# ))
#
# # 方式 1: 手动管理
# conn = pool.get_connection()
# try:
#     cursor = conn.raw.cursor()
#     cursor.execute("SELECT * FROM users")
#     rows = cursor.fetchall()
# finally:
#     conn.release()
#
# # 方式 2: 上下文管理器
# with pool.connection() as raw_conn:
#     cursor = raw_conn.cursor()
#     cursor.execute("SELECT * FROM users")
#
# # 方式 3: 连接池上下文
# with ConnectionPool(config) as pool:
#     with pool.connection() as conn:
#         pass
#
# print(pool.stats())
```
