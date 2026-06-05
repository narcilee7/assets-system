#!/usr/bin/env python3
"""Simulate Redis single-instance lock with TTL and watchdog.
Run: python3 redis_lock.py --ttl 5 --task-time 8 --watchdog"""
import argparse
import time
import threading


class RedisLock:
    def __init__(self, ttl: int):
        self.ttl = ttl
        self.owner = None
        self.expires_at = 0.0
        self._lock = threading.Lock()

    def acquire(self, client: str) -> bool:
        with self._lock:
            if self.owner is None or time.time() > self.expires_at:
                self.owner = client
                self.expires_at = time.time() + self.ttl
                return True
            return False

    def release(self, client: str) -> bool:
        with self._lock:
            if self.owner == client:
                self.owner = None
                self.expires_at = 0
                return True
            return False

    def watch_dog(self, client: str, interval: float, extend: float):
        """Background thread renews lock every interval."""
        while True:
            time.sleep(interval)
            with self._lock:
                if self.owner == client:
                    self.expires_at = time.time() + extend
                else:
                    break


def client_task(name: str, lock: RedisLock, task_time: float, use_watchdog: bool):
    acquired = lock.acquire(name)
    print(f"[{name}] acquire={'OK' if acquired else 'FAIL'} at t={time.time()-start:.2f}")
    if not acquired:
        return

    wd_thread = None
    if use_watchdog:
        wd_thread = threading.Thread(
            target=lock.watch_dog,
            args=(name, lock.ttl / 3, lock.ttl),
            daemon=True,
        )
        wd_thread.start()
        print(f"[{name}] watchdog started")

    time.sleep(task_time)

    # Check if still holding lock
    still_holding = lock.owner == name and time.time() < lock.expires_at
    print(f"[{name}] after task (t={time.time()-start:.2f}), still_holding={still_holding}")

    if still_holding:
        lock.release(name)
        print(f"[{name}] released lock")
    else:
        print(f"[{name}] LOCK LOST before completion (race possible!)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ttl", type=int, default=5, help="Lock TTL in seconds")
    parser.add_argument("--task-time", type=float, default=8, help="Task duration > TTL")
    parser.add_argument("--watchdog", action="store_true", help="Enable watchdog auto-renewal")
    args = parser.parse_args()

    global start
    start = time.time()
    lock = RedisLock(args.ttl)

    print(f"Scenario: TTL={args.ttl}s, task_time={args.task_time}s, watchdog={args.watchdog}")
    print("-" * 50)

    t1 = threading.Thread(target=client_task, args=("client-A", lock, args.task_time, args.watchdog))
    # client-B tries to acquire after TTL should have expired (if no watchdog)
    t2 = threading.Thread(target=client_task, args=("client-B", lock, 2, False))

    t1.start()
    time.sleep(args.ttl + 0.5)  # wait for TTL to expire
    t2.start()

    t1.join()
    t2.join()

    print("-" * 50)
    if args.watchdog:
        print("Watchdog kept lock alive; client-B had to wait or fail.")
    else:
        print("No watchdog: lock expired, client-B stole it. client-A lost ownership mid-task.")


if __name__ == "__main__":
    main()
