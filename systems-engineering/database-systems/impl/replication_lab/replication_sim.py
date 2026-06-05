#!/usr/bin/env python3
"""
Simulate MySQL master-slave replication lag.
Run: python3 replication_sim.py
"""

import time
import random
from collections import deque


class ReplicationSimulator:
    def __init__(self, slave_workers=1):
        self.master_log: deque = deque()
        self.relay_log: deque = deque()
        self.applied_log: deque = deque()
        self.slave_workers = slave_workers
        self.seconds_behind_master = 0
        self.clock = 0

    def master_write(self, trx_size: int):
        """Master generates a transaction."""
        self.clock += 1
        self.master_log.append((self.clock, trx_size))

    def io_thread(self):
        """Simulate network transfer from master to relay log."""
        if self.master_log:
            trx = self.master_log.popleft()
            # Network latency
            time.sleep(0.01)
            self.relay_log.append(trx)

    def sql_thread(self):
        """Apply relay log events. Single-threaded or multi-threaded."""
        # Simulate: each worker can apply one trx per tick
        applied = 0
        while self.relay_log and applied < self.slave_workers:
            clock, trx_size = self.relay_log.popleft()
            # Large trx takes longer
            apply_time = 0.02 + trx_size * 0.005
            time.sleep(apply_time)
            self.applied_log.append((clock, trx_size))
            applied += 1

        # Calculate lag
        if self.master_log:
            self.seconds_behind_master = len(self.master_log) + len(self.relay_log)
        else:
            self.seconds_behind_master = len(self.relay_log)

    def status(self):
        print(f"  Master queue: {len(self.master_log)}  "
              f"Relay queue: {len(self.relay_log)}  "
              f"Applied: {len(self.applied_log)}  "
              f"Lag: {self.seconds_behind_master}")


def demo():
    print("=== Single-threaded Slave ===")
    sim = ReplicationSimulator(slave_workers=1)
    for _ in range(10):
        sim.master_write(trx_size=random.randint(1, 5))
    for _ in range(20):
        sim.io_thread()
        sim.sql_thread()
    sim.status()

    print("\n=== Multi-threaded Slave (4 workers) ===")
    sim2 = ReplicationSimulator(slave_workers=4)
    for _ in range(10):
        sim2.master_write(trx_size=random.randint(1, 5))
    for _ in range(20):
        sim2.io_thread()
        sim2.sql_thread()
    sim2.status()

    print("\n=== Big Transaction (size=50) ===")
    sim3 = ReplicationSimulator(slave_workers=4)
    for _ in range(5):
        sim3.master_write(trx_size=random.randint(1, 3))
    sim3.master_write(trx_size=50)  # big trx
    for _ in range(30):
        sim3.io_thread()
        sim3.sql_thread()
    sim3.status()


if __name__ == "__main__":
    demo()
