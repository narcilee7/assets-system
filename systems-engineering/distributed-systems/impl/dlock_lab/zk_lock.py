#!/usr/bin/env python3
"""Simulate ZooKeeper ephemeral sequential lock with filesystem.
Run: python3 zk_lock.py --clients 5 --contention 20"""
import argparse
import os
import tempfile
import time
import threading


LOCK_DIR = tempfile.mkdtemp(prefix="zk_lock_")


def acquire_lock(client: str) -> str:
    """Create ephemeral sequential file; return path."""
    seq = int(time.time() * 1000000)
    path = os.path.join(LOCK_DIR, f"lock-{seq}-{client}.tmp")
    open(path, "w").close()
    return path


def release_lock(path: str):
    if os.path.exists(path):
        os.remove(path)


def get_sorted_locks() -> list:
    files = sorted(f for f in os.listdir(LOCK_DIR) if f.endswith(".tmp"))
    return [os.path.join(LOCK_DIR, f) for f in files]


def client_task(name: str, contention: int, results: dict):
    acquired_count = 0
    wait_times = []
    for _ in range(contention):
        path = acquire_lock(name)
        start_wait = time.time()
        while True:
            locks = get_sorted_locks()
            my_index = locks.index(path)
            if my_index == 0:
                # Got the lock
                wait_times.append(time.time() - start_wait)
                acquired_count += 1
                time.sleep(0.01)  # simulate work
                release_lock(path)
                break
            else:
                # Watch predecessor
                pred = locks[my_index - 1]
                # Polling simulation
                while os.path.exists(pred):
                    time.sleep(0.005)
    results[name] = {"acquired": acquired_count, "total_wait": sum(wait_times)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--clients", type=int, default=5)
    parser.add_argument("--contention", type=int, default=20, help="Lock acquisitions per client")
    args = parser.parse_args()

    print(f"Simulating ZK lock: {args.clients} clients, {args.contention} rounds each")
    print(f"Lock dir: {LOCK_DIR}")
    print("-" * 50)

    results = {}
    threads = []
    start = time.time()
    for i in range(args.clients):
        t = threading.Thread(target=client_task, args=(f"client-{i}", args.contention, results))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    elapsed = time.time() - start
    total_acquired = sum(r["acquired"] for r in results.values())
    total_wait = sum(r["total_wait"] for r in results.values())
    print(f"Total acquisitions: {total_acquired}")
    print(f"Total wait time: {total_wait:.3f}s")
    print(f"Throughput: {total_acquired/elapsed:.1f} locks/s")
    print("\nFairness: each client gets lock in creation order (FIFO).")
    print("Herding risk: all clients wake when first node deleted; Curator watches predecessor only.")

    # Cleanup
    for f in os.listdir(LOCK_DIR):
        os.remove(os.path.join(LOCK_DIR, f))
    os.rmdir(LOCK_DIR)


if __name__ == "__main__":
    main()
