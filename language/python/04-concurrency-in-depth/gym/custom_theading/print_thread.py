import threading
import os

def show():
  print(f"Python thread: {threading.current_thread().name}")
  print(f"OS thread ID: {os.getpid()}-{threading.current_thread().native_id}")

if __name__ == "__main__":
  t = threading.Thread(target=show)
  t.start()