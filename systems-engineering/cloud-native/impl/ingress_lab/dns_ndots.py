#!/usr/bin/env python3
"""Simulate Pod DNS resolution with ndots and search domains.
Run: python3 dns_ndots.py --query google.com --ndots 5"""
import argparse


SEARCH_DOMAINS = [
    "default.svc.cluster.local",
    "svc.cluster.local",
    "cluster.local",
]


def resolve(query: str, ndots: int) -> list:
    """Return list of DNS queries Pod would actually send."""
    queries = []
    # If query has at least ndots dots, treat as FQDN
    if query.count(".") >= ndots:
        queries.append(query)
        return queries

    # Otherwise try search domains first, then bare query
    for domain in SEARCH_DOMAINS:
        queries.append(f"{query}.{domain}")
    queries.append(query)
    return queries


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", default="google.com")
    parser.add_argument("--ndots", type=int, default=5)
    args = parser.parse_args()

    queries = resolve(args.query, args.ndots)
    print(f"Query: {args.query}")
    print(f"ndots: {args.ndots}")
    print(f"Search domains: {SEARCH_DOMAINS}")
    print(f"Total DNS lookups: {len(queries)}")
    for i, q in enumerate(queries, 1):
        status = "MISS" if "cluster.local" in q and not q.endswith("cluster.local") else "(bare)"
        print(f"  {i}. {q}  {status}")

    timeout_per_query = 5  # default resolv timeout
    print(f"\nWorst-case time (no cache, each timeout {timeout_per_query}s): {len(queries)*timeout_per_query}s")
    print("Tip: use FQDN (trailing dot) or adjust ndots to reduce latency.")


if __name__ == "__main__":
    main()
