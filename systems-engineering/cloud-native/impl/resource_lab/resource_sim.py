#!/usr/bin/env python3
"""
Kubernetes resource scheduling and throttling simulator.
Run: python3 resource_sim.py
"""

from dataclasses import dataclass
from typing import List


@dataclass
class Pod:
    name: str
    cpu_request: float
    cpu_limit: float
    mem_request: int
    mem_limit: int
    cpu_usage: float = 0.0
    mem_usage: int = 0
    oom_killed: bool = False
    throttled: bool = False


class Node:
    def __init__(self, name: str, cpu_allocatable: float, mem_allocatable: int):
        self.name = name
        self.cpu_allocatable = cpu_allocatable
        self.mem_allocatable = mem_allocatable
        self.pods: List[Pod] = []

    def can_schedule(self, pod: Pod) -> bool:
        used_cpu = sum(p.cpu_request for p in self.pods)
        used_mem = sum(p.mem_request for p in self.pods)
        return (used_cpu + pod.cpu_request <= self.cpu_allocatable and
                used_mem + pod.mem_request <= self.mem_allocatable)

    def schedule(self, pod: Pod) -> bool:
        if self.can_schedule(pod):
            self.pods.append(pod)
            return True
        return False

    def run_tick(self):
        total_cpu_usage = sum(p.cpu_usage for p in self.pods)
        for pod in self.pods:
            # CPU throttling: if node is oversubscribed or pod exceeds limit
            if pod.cpu_usage > pod.cpu_limit or total_cpu_usage > self.cpu_allocatable:
                pod.throttled = True
            else:
                pod.throttled = False

            # OOM: if mem usage exceeds limit
            if pod.mem_usage > pod.mem_limit:
                pod.oom_killed = True
                print(f"  [OOM] {pod.name} killed (usage {pod.mem_usage}Mi > limit {pod.mem_limit}Mi)")

    def status(self):
        used_cpu = sum(p.cpu_request for p in self.pods)
        used_mem = sum(p.mem_request for p in self.pods)
        print(f"  Node {self.name}: CPU {used_cpu:.1f}/{self.cpu_allocatable}  MEM {used_mem}Mi/{self.mem_allocatable}Mi")
        for pod in self.pods:
            status = ""
            if pod.throttled:
                status += " [THROTTLED]"
            if pod.oom_killed:
                status += " [OOMKILLED]"
            print(f"    Pod {pod.name}: cpu_usage={pod.cpu_usage:.1f} mem_usage={pod.mem_usage}Mi{status}")


def demo():
    node = Node("node-1", cpu_allocatable=2.0, mem_allocatable=2048)

    pods = [
        Pod("web", cpu_request=0.5, cpu_limit=1.0, mem_request=512, mem_limit=1024, cpu_usage=0.8, mem_usage=600),
        Pod("cache", cpu_request=0.5, cpu_limit=0.5, mem_request=512, mem_limit=512, cpu_usage=0.6, mem_usage=400),
        Pod("worker", cpu_request=1.0, cpu_limit=2.0, mem_request=1024, mem_limit=1024, cpu_usage=1.5, mem_usage=1200),
    ]

    print("=== Scheduling ===")
    for pod in pods:
        ok = node.schedule(pod)
        print(f"  Schedule {pod.name}: {'OK' if ok else 'FAILED'}")

    print("\n=== Before Run ===")
    node.status()

    print("\n=== Running (checking throttling/OOM) ===")
    node.run_tick()

    print("\n=== After Run ===")
    node.status()


if __name__ == "__main__":
    demo()
