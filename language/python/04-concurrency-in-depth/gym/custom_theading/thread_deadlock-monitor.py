import sys
import traceback
import threading
import time

lock_a = threading.Lock()
lock_b = threading.Lock()

def worker_1():
  with lock_a:
    time.sleep(0.1)
    with lock_b:
      print("Worker 1 成功拿到两把锁...")

def worker_2():
  with lock_b:
    time.sleep(0.1)
    with lock_a:
      print("Worker 2 成功拿到两把锁")

def dump_on_deadlock():
  time.sleep(0.5) # 等下死锁
  print("\n [MONITOR] 监测到系统挂起，开始强行dump线程堆栈")

  for thread_id, frame in sys._current_frames().items():
    print(f"\n--- thread id: {thread_id} --")
    traceback.print_stack(frame)


if __name__ == "__main__":
  t1 = threading.Thread(target=worker_1)
  t2 = threading.Thread(target=worker_2)
  monitor = threading.Thread(target=dump_on_deadlock)

  t1.start()
  t2.start()
  monitor.start()

  t1.join()
  t2.join()
  