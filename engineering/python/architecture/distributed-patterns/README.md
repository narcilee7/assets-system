# Python Distributed Patterns

Python 在分布式系统中常用的设计模式：分布式事务、Saga、分布式锁、分布式 ID。

## 分布式事务（TCC）

```python
# tcc_example.py
from dataclasses import dataclass
from typing import Callable, Awaitable
import asyncio

@dataclass
class TCCAction:
    try_func: Callable[[], Awaitable[bool]]
    confirm_func: Callable[[], Awaitable[bool]]
    cancel_func: Callable[[], Awaitable[bool]]

class TCCTransaction:
    def __init__(self):
        self.actions: list[TCCAction] = []
    
    def add(self, action: TCCAction):
        self.actions.append(action)
    
    async def execute(self):
        confirmed = []
        try:
            # Try 阶段
            for action in self.actions:
                success = await action.try_func()
                if not success:
                    raise Exception("Try failed")
                confirmed.append(action)
            
            # Confirm 阶段
            for action in confirmed:
                await action.confirm_func()
        except Exception:
            # Cancel 阶段
            for action in confirmed:
                await action.cancel_func()
            raise
```

## 分布式锁（Redis）

```python
# redis_lock.py
import redis
import uuid
import time

r = redis.Redis()

class DistributedLock:
    def __init__(self, lock_name: str, expire: int = 30):
        self.lock_name = f"lock:{lock_name}"
        self.identifier = str(uuid.uuid4())
        self.expire = expire
    
    def acquire(self) -> bool:
        return r.set(self.lock_name, self.identifier, nx=True, ex=self.expire)
    
    def release(self):
        # Lua 脚本保证原子性
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        r.eval(lua_script, 1, self.lock_name, self.identifier)
    
    def __enter__(self):
        while not self.acquire():
            time.sleep(0.1)
        return self
    
    def __exit__(self, *args):
        self.release()

# 使用
with DistributedLock("order:123"):
    # 处理订单
    pass
```
