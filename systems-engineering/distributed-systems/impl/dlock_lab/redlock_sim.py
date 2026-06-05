#!/usr/bin/env python3
"""Simulate RedLock with N independent Redis nodes.
Run: python3 redlock_sim.py --nodes 5 --quorum 3 --delay 0.1 --ttl 10"""
import argparse
import random
import time


class FakeRedis:
    def __init__(self, name: str, latency: float):
        self.name = name
        self.latency = latency
        self.locks = {}  # key -> (owner, expires_at)

    def try_lock(self, key: str, owner: str, ttl: float) -> bool:
        time.sleep(self.latency)
        now = time.time()
        if key not in self.locks or now > self.locks[key][1]:
            self.locks[key] = (owner, now + ttl)
            return True
        return False

    def unlock(self, key: str, owner: str):
        if self.locks.get(key, (None, 0))[0] == owner:
            del self.locks[key]


def redlock(nodes: list, key: str, owner: str, ttl: float, quorum: int) -> bool:
    t1 = time.time()
    successes = 0
    locked_nodes = []
    for node in nodes:
        if node.try_lock(key, owner, ttl):
            successes += 1
            locked_nodes.append(node)
    t2 = time.time()
    elapsed = t2 - t1
    valid_time = ttl - elapsed
    if successes >= quorum and valid_time > 0:
        print(f"  [OK] locked {successes}/{len(nodes)} nodes in {elapsed:.3f}s, valid_time={valid_time:.3f}s")
        return True
    else:
        print(f"  [FAIL] locked {successes}/{len(nodes)}, elapsed={elapsed:.3f}s, valid_time={valid_time:.3f}s")
        for node in locked_nodes:
            node.unlock(key, owner)
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--nodes", type=int, default=5)
    parser.add_argument("--quorum", type=int, default=3)
    parser.add_argument("--delay", type=float, default=0.1, help="Base latency per node")
    parser.add_argument("--ttl", type=float, default=10)
    parser.add_argument("--clients", type=int, default=5)
    args = parser.parse_args()

    nodes = []
    for i in range(args.nodes):
        # Random jitter 0 ~ delay
        lat = random.uniform(0, args.delay)
        nodes.append(FakeRedis(f"redis-{i}", lat))

    print(f"RedLock: {args.nodes} nodes, quorum={args.quorum}, TTL={args.ttl}s")
    print("-" * 50)

    success_count = 0
    for c in range(args.clients):
        owner = f"client-{c}"
        ok = redlock(nodes, "my-lock", owner, args.ttl, args.quorum)
        if ok:
            success_count += 1

    print("-" * 50)
    print(f"Clients succeeded: {success_count}/{args.clients}")
    print("Note: high latency or partition can make elapsed > TTL, causing false positives.")


if __name__ == "__main__":
    main()
