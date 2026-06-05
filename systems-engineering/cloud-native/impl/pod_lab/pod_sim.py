#!/usr/bin/env python3
"""
Simulate Kubernetes Pod lifecycle and probes.
Run: python3 pod_sim.py
"""

import time
from enum import Enum


class Phase(Enum):
    PENDING = "Pending"
    RUNNING = "Running"
    SUCCEEDED = "Succeeded"
    FAILED = "Failed"


class PodSimulator:
    def __init__(self, startup_delay=3, healthy=True):
        self.phase = Phase.PENDING
        self.startup_delay = startup_delay
        self.healthy = healthy
        self.start_time = time.time()
        self.ready = False
        self.restarts = 0

    def startup_probe(self) -> bool:
        return time.time() - self.start_time >= self.startup_delay

    def liveness_probe(self) -> bool:
        return self.healthy

    def readiness_probe(self) -> bool:
        return self.healthy and self.phase == Phase.RUNNING

    def tick(self):
        if self.phase == Phase.PENDING:
            if self.startup_probe():
                self.phase = Phase.RUNNING
                print(f"[{time.time()-self.start_time:.1f}s] Pod -> Running")
            else:
                print(f"[{time.time()-self.start_time:.1f}s] Pod -> Pending (startup)")

        elif self.phase == Phase.RUNNING:
            if not self.liveness_probe():
                self.phase = Phase.FAILED
                self.restarts += 1
                print(f"[{time.time()-self.start_time:.1f}s] Liveness failed -> Restarting (restart #{self.restarts})")
                # Simulate restart
                self.phase = Phase.PENDING
                self.start_time = time.time()
                self.ready = False
            else:
                was_ready = self.ready
                self.ready = self.readiness_probe()
                status = "Ready" if self.ready else "NotReady"
                if was_ready != self.ready:
                    print(f"[{time.time()-self.start_time:.1f}s] Readiness changed -> {status}")
                else:
                    print(f"[{time.time()-self.start_time:.1f}s] Running ({status})")

    def run(self, ticks=10, fail_at_tick=None):
        for i in range(ticks):
            if fail_at_tick is not None and i == fail_at_tick:
                self.healthy = False
            self.tick()
            time.sleep(0.5)


def demo():
    print("=== Normal Startup ===")
    pod = PodSimulator(startup_delay=2, healthy=True)
    pod.run(ticks=6)

    print("\n=== Liveness Failure at tick 4 ===")
    pod2 = PodSimulator(startup_delay=1, healthy=True)
    pod2.run(ticks=8, fail_at_tick=4)


if __name__ == "__main__":
    demo()
