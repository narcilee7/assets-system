'''
目标：实现一个可以work的线程池，不考虑返回值、异常传播、关闭、取消等特性

ThreadPool = Worker Threads + Task Queue
'''

from queue import Queue
from threading import Thread
from typing import Callable, List
import time

class ThreadPool:
  def __init__(self, workers: int):
    self.queue = Queue()
    self.workers: List[Thread] = []

    for _ in range(workers):
      t = Thread(target=self.worker, daemon=True)
      t.start()
      self.workers.append(t)

  def worker(self):
    while True:
      task = self.queue.get()
      task()

  def submit(self, fn: Callable):
    self.queue.put(fn)


def main():
  pool = ThreadPool(3)

  def work(i: int):
    print(f"\nstart {i}")
    time.sleep(2)
    print(f"finish {i}")


  for i in range(10):
    pool.submit(lambda i=i: work(i))


  time.sleep(10)

if __name__ == "__main__":
  main()