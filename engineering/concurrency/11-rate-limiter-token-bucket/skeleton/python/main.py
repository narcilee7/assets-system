# 并发模型：threading
import threading
import time

class TokenBucket:
    def __init__(self, capacity: int, rate: float):
        # TODO: 初始化容量、速率、当前令牌数、上次填充时间
        pass

    def allow(self) -> bool:
        # TODO:
        # 1. 加锁
        # 2. 根据时间差计算应添加的令牌数
        # 3. 更新状态
        # 4. 如果令牌数 >= 1，减 1 并返回 True；否则返回 False
        return False

def main():
    tb = TokenBucket(5, 2.0)

    allowed = 0
    for _ in range(10):
        if tb.allow():
            allowed += 1
    if allowed == 5:
        print(f"PASS: burst allowed = {allowed} (capacity = 5)")
    else:
        print(f"FAIL: burst allowed = {allowed} (expected 5)")

    time.sleep(1)
    allowed = 0
    for _ in range(10):
        if tb.allow():
            allowed += 1
    if allowed == 2:
        print(f"PASS: sustained allowed = {allowed} (rate = 2/sec)")
    else:
        print(f"FAIL: sustained allowed = {allowed} (expected 2)")

if __name__ == "__main__":
    main()
