#!/usr/bin/env python3
"""Simulate externalTrafficPolicy: Local black-hole traffic.
Run: python3 local_policy.py --nodes 3 --pods 2 --requests 1000"""
import argparse
import random


def simulate(nodes: int, pods: int, requests: int):
    node_list = [f"node-{i}" for i in range(nodes)]
    # Distribute pods randomly across nodes
    pod_nodes = {}
    for p in range(pods):
        pod_nodes[f"pod-{p}"] = random.choice(node_list)

    # Count pods per node
    node_pod_count = {n: 0 for n in node_list}
    for n in pod_nodes.values():
        node_pod_count[n] += 1

    print(f"Cluster: {nodes} nodes, {pods} pods")
    print("Pod distribution:", {k: v for k, v in node_pod_count.items() if v > 0})

    # Simulate requests hitting random nodes (e.g. via LoadBalancer)
    success = 0
    blackhole = 0
    for _ in range(requests):
        target_node = random.choice(node_list)
        if node_pod_count.get(target_node, 0) > 0:
            success += 1
        else:
            blackhole += 1

    print(f"\nRequests: {requests}")
    print(f"Success:   {success} ({success/requests*100:.1f}%)")
    print(f"Blackhole: {blackhole} ({blackhole/requests*100:.1f}%)")
    print("\nMitigation: use DaemonSet or externalTrafficPolicy: Cluster (sacrifices client IP).")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--nodes", type=int, default=3)
    parser.add_argument("--pods", type=int, default=2)
    parser.add_argument("--requests", type=int, default=1000)
    args = parser.parse_args()
    simulate(args.nodes, args.pods, args.requests)


if __name__ == "__main__":
    main()
