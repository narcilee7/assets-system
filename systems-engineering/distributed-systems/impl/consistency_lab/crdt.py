#!/usr/bin/env python3
"""
CRDT demo: G-Counter and LWW-Register.
Run: python3 crdt.py
"""

from typing import Dict


class GCounter:
    """Grow-only counter CRDT."""
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.payload: Dict[str, int] = {node_id: 0}

    def increment(self):
        self.payload[self.node_id] += 1

    def merge(self, other: "GCounter"):
        for node, count in other.payload.items():
            self.payload[node] = max(self.payload.get(node, 0), count)

    def value(self) -> int:
        return sum(self.payload.values())

    def __repr__(self):
        return f"GCounter({self.node_id}, payload={self.payload}, total={self.value()})"


class LWWRegister:
    """Last-Write-Wins Register CRDT."""
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.value = None
        self.timestamp = 0

    def set(self, value, timestamp: int):
        if timestamp > self.timestamp:
            self.value = value
            self.timestamp = timestamp

    def merge(self, other: "LWWRegister"):
        if other.timestamp > self.timestamp:
            self.value = other.value
            self.timestamp = other.timestamp

    def __repr__(self):
        return f"LWWRegister({self.node_id}, value={self.value}, ts={self.timestamp})"


def demo():
    print("=== G-Counter ===")
    a = GCounter("A")
    b = GCounter("B")
    a.increment()
    a.increment()
    b.increment()
    print(f"Before merge: A={a.value()}, B={b.value()}")
    a.merge(b)
    b.merge(a)
    print(f"After merge:  A={a.value()}, B={b.value()}")

    print("\n=== LWW-Register ===")
    x = LWWRegister("X")
    y = LWWRegister("Y")
    x.set("foo", 10)
    y.set("bar", 20)
    print(f"Before merge: X={x.value}, Y={y.value}")
    x.merge(y)
    print(f"After merge:  X={x.value}")


if __name__ == "__main__":
    demo()
