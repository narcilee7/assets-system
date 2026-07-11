'''可重入锁'''

from theading import RLock


rlock = RLock()


def outer():
    with rlock:
        inner()  # ✅ 同一线程可以再次获取，计数器 +1

def inner():
    with rlock:
        pass