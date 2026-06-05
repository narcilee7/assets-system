#!/usr/bin/env python3
"""
SLO burn rate simulator.
Run: python3 burn_rate.py
"""

import random
from collections import deque


class SLOSimulator:
    def __init__(self, slo: float, window_minutes: int = 60):
        self.slo = slo
        self.window = window_minutes
        self.total = 0
        self.errors = 0
        self.history: deque = deque()

    def record(self, success: bool):
        self.total += 1
        if not success:
            self.errors += 1
        self.history.append(success)
        if len(self.history) > self.window * 60:
            old = self.history.popleft()
            if not old:
                self.errors -= 1
            self.total -= 1

    def error_rate(self) -> float:
        if self.total == 0:
            return 0.0
        return self.errors / self.total

    def burn_rate(self) -> float:
        """How many times faster than the ideal error budget consumption."""
        ideal_rate = 1 - self.slo
        if ideal_rate == 0:
            return 0.0
        return self.error_rate() / ideal_rate

    def status(self) -> str:
        br = self.burn_rate()
        if br >= 100:
            return "CRITICAL (100x+)"
        if br >= 10:
            return "HIGH (10x+)"
        if br >= 2:
            return "ELEVATED (2x+)"
        return "OK"


def demo():
    slo = 0.999  # 99.9%
    sim = SLOSimulator(slo, window_minutes=60)
    print(f"SLO = {slo*100}% | Ideal error rate = {(1-slo)*100:.4f}%")
    print("-" * 50)

    # Normal traffic
    for i in range(1000):
        sim.record(random.random() < 0.9995)
    print(f"Normal:   error_rate={sim.error_rate()*100:.4f}%  burn_rate={sim.burn_rate():.2f}x  {sim.status()}")

    # Incident: 5% errors for 5 minutes
    for i in range(300):
        sim.record(random.random() < 0.95)
    print(f"Incident: error_rate={sim.error_rate()*100:.4f}%  burn_rate={sim.burn_rate():.2f}x  {sim.status()}")

    # Recovery
    for i in range(600):
        sim.record(random.random() < 0.9999)
    print(f"Recovery: error_rate={sim.error_rate()*100:.4f}%  burn_rate={sim.burn_rate():.2f}x  {sim.status()}")


if __name__ == "__main__":
    demo()
