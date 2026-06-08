# 并发模型：threading
import threading
import time
from enum import Enum

class State(Enum):
    CLOSED = 0
    OPEN = 1
    HALF_OPEN = 2

class CircuitBreaker:
    def __init__(self, failure_threshold: int, recovery_timeout: float, half_open_max_calls: int):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        self._mu = threading.Lock()
        # TODO: 添加状态、失败计数、成功计数、最后失败时间、半开探测计数等

    def call(self, fn):
        with self._mu:
            # TODO: 检查状态，决定是否允许执行，更新探测计数
            pass

        # TODO: 执行 fn，根据结果更新状态
        # 注意：更新状态时需要重新获取锁
        return fn()

def main():
    cb = CircuitBreaker(failure_threshold=3, recovery_timeout=0.2, half_open_max_calls=1)

    def fail_fn():
        raise RuntimeError("service down")

    def ok_fn():
        return None

    for _ in range(5):
        try:
            cb.call(fail_fn)
        except Exception:
            pass

    try:
        cb.call(ok_fn)
        print("FAIL: expected rejection when circuit is open")
        return
    except Exception:
        pass

    time.sleep(0.25)

    try:
        cb.call(ok_fn)
    except Exception as e:
        print(f"FAIL: expected success on half-open probe, got {e}")
        return

    try:
        cb.call(ok_fn)
    except Exception as e:
        print(f"FAIL: expected success after recovery, got {e}")
        return

    print("PASS: circuit breaker state transitions correct")

if __name__ == "__main__":
    main()
