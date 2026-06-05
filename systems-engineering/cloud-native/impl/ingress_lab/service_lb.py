#!/usr/bin/env python3
"""Simulate iptables random DNAT vs IPVS source-hashing load distribution.
Run: python3 service_lb.py --mode iptables --endpoints 10 --requests 10000"""
import argparse
import random


def iptables_random(endpoints: list, requests: int) -> dict:
    """iptables: uniform random selection."""
    counts = {e: 0 for e in endpoints}
    for _ in range(requests):
        choice = random.choice(endpoints)
        counts[choice] += 1
    return counts


def ipvs_sh(endpoints: list, requests: int, client_ips: int = 1000) -> dict:
    """IPVS sh (source hashing): same client IP -> same endpoint."""
    counts = {e: 0 for e in endpoints}
    # Precompute hash mapping for each client
    mapping = {}
    for c in range(client_ips):
        mapping[c] = endpoints[c % len(endpoints)]
    for _ in range(requests):
        client = random.randint(0, client_ips - 1)
        counts[mapping[client]] += 1
    return counts


def analyze(label: str, counts: dict, requests: int):
    vals = list(counts.values())
    avg = requests / len(vals)
    max_dev = max(abs(v - avg) for v in vals)
    print(f"\n{label}")
    print(f"  Requests: {requests}, Endpoints: {len(vals)}")
    print(f"  Avg/endpoint: {avg:.1f}, Max deviation: {max_dev:.1f} ({max_dev/avg*100:.1f}%)")
    for k, v in sorted(counts.items()):
        bar = "█" * int(v / max(vals) * 30)
        print(f"  {k}: {v:>6} {bar}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["iptables", "ipvs", "both"], default="both")
    parser.add_argument("--endpoints", type=int, default=10)
    parser.add_argument("--requests", type=int, default=10_000)
    args = parser.parse_args()

    endpoints = [f"pod-{i}" for i in range(args.endpoints)]

    if args.mode in ("iptables", "both"):
        counts = iptables_random(endpoints, args.requests)
        analyze("iptables (random DNAT)", counts, args.requests)

    if args.mode in ("ipvs", "both"):
        counts = ipvs_sh(endpoints, args.requests)
        analyze("IPVS source-hashing (sh)", counts, args.requests)
        print("\nNote: IPVS sh pins same client IP to same endpoint.")
        print("      Endpoint changes cause re-hash and session break.")


if __name__ == "__main__":
    main()
