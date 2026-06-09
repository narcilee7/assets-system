# Python Distributed Lock

基于 Redis 的分布式锁实现，支持看门狗自动续期。

## Redlock

```python
# redis_lock.py
import redis
import uuid
import time
from contextlib import contextmanager

class RedisLock:
    def __init__(self, redis_client: redis.Redis, lock_name: str, expire: int = 30):
        self.redis = redis_client
        self.lock_name = f"lock:{lock_name}"
        self.identifier = str(uuid.uuid4())
        self.expire = expire
    
    def acquire(self) -> bool:
        return self.redis.set(self.lock_name, self.identifier, nx=True, ex=self.expire)
    
    def release(self):
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        self.redis.eval(lua_script, 1, self.lock_name, self.identifier)
    
    def __enter__(self):
        while not self.acquire():
            time.sleep(0.1)
        return self
    
    def __exit__(self, *args):
        self.release()

# 看门狗自动续期版本
class RedLockWithWatchdog:
    def __init__(self, redis_client, lock_name: str, expire: int = 30):
        self.redis = redis_client
        self.lock_name = f"lock:{lock_name}"
        self.identifier = str(uuid.uuid4())
        self.expire = expire
        self._watchdog = None
    
    def acquire(self) -> bool:
        if self.redis.set(self.lock_name, self.identifier, nx=True, ex=self.expire):
            self._start_watchdog()
            return True
        return False
    
    def _start_watchdog(self):
        import threading
        def renew():
            while True:
                time.sleep(self.expire * 0.5)
                lua_script = """
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("expire", KEYS[1], ARGV[2])
                else
                    return 0
                end
                """
                result = self.redis.eval(lua_script, 1, self.lock_name, self.identifier, self.expire)
                if not result:
                    break
        self._watchdog = threading.Thread(target=renew, daemon=True)
        self._watchdog.start()
```
