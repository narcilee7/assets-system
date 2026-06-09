# Python Event Loop

Python asyncio 的核心是事件循环，理解它是掌握异步编程的关键。

## 事件循环基础

```python
import asyncio

# 获取/创建事件循环
loop = asyncio.get_event_loop()
# 或
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)

# 运行协程
loop.run_until_complete(my_coroutine())

# Python 3.7+ 推荐
asyncio.run(my_coroutine())
```

## 底层原理

```python
# 简化版事件循环原理
class SimpleEventLoop:
    def __init__(self):
        self._ready = []      # 准备执行的回调
        self._scheduled = []  # 定时任务（按时间排序）
        self._stopping = False
    
    def call_soon(self, callback, *args):
        self._ready.append((callback, args))
    
    def call_later(self, delay, callback, *args):
        when = time.time() + delay
        self._scheduled.append((when, callback, args))
        self._scheduled.sort(key=lambda x: x[0])
    
    def run_forever(self):
        while not self._stopping:
            # 1. 执行所有准备好的回调
            while self._ready:
                callback, args = self._ready.pop(0)
                callback(*args)
            
            # 2. 检查定时任务
            now = time.time()
            while self._scheduled and self._scheduled[0][0] <= now:
                when, callback, args = self._scheduled.pop(0)
                callback(*args)
            
            # 3. 等待 I/O（简化，实际使用 selector）
            time.sleep(0.001)
```

## 事件循环策略

```python
# 不同平台的事件循环
# Unix: SelectorEventLoop (默认)
# Windows: ProactorEventLoop (Python 3.8+ 默认)

# 切换事件循环策略
asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# uvloop（C 实现，性能提升 2-4 倍）
import uvloop
asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
```
