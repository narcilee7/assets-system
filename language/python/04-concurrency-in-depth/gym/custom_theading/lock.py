'''原始锁'''

import threading

lock = threading.Lock()

def critical_section():
  with lock:
    pass

# 致命陷阱：Lock 不可重入。同一线程如果尝试再次 acquire，会死锁。

def outer():
  with lock:
    print("outer running before inner()")
    inner()
    print("outer running after inner()")

def inner():
  print(f"inner function running")
  with lock:
    print(f"inner locked")
    pass

if __name__ == "__main__":
  outer()