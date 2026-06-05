#!/usr/bin/env python3
"""
Simulate HTTP/1.1 vs HTTP/2 multiplexing and head-of-line blocking.
Run: python3 http_simulator.py
"""

import time
import random


def simulate_http11(num_requests=6):
    """HTTP/1.1: sequential requests over one keep-alive connection."""
    print("=== HTTP/1.1 (Sequential) ===")
    total = 0
    for i in range(num_requests):
        latency = random.uniform(0.05, 0.15)
        # Simulate one slow request blocking the rest
        if i == 2:
            latency = 0.5
        time.sleep(latency)
        total += latency
        print(f"  Request {i+1}: {latency:.3f}s")
    print(f"  Total time: {total:.3f}s\n")
    return total


def simulate_http2(num_requests=6):
    """HTTP/2: multiplexed streams over one TCP connection.
    TCP HoL still exists if a packet is lost."""
    print("=== HTTP/2 (Multiplexed) ===")
    streams = []
    for i in range(num_requests):
        latency = random.uniform(0.05, 0.15)
        if i == 2:
            latency = 0.5
        streams.append(latency)

    # Ideal multiplexing: streams overlap, total = max(latencies)
    # But with TCP HoL (simulate 10% packet loss on the slow stream):
    # all streams wait for retransmission.
    max_latency = max(streams)
    total_ideal = max_latency
    print(f"  Stream latencies: {[f'{s:.3f}s' for s in streams]}")
    print(f"  Ideal multiplex time: {total_ideal:.3f}s")

    # Simulate TCP HoL: one packet loss adds 0.3s to ALL streams
    hol_penalty = 0.3 if random.random() < 0.3 else 0.0
    total_hol = max_latency + hol_penalty
    print(f"  With TCP HoL penalty (+{hol_penalty:.3f}s): {total_hol:.3f}s\n")
    return total_hol


def simulate_http3(num_requests=6):
    """HTTP/3 (QUIC): stream-level independent delivery."""
    print("=== HTTP/3 (QUIC Streams) ===")
    streams = []
    for i in range(num_requests):
        latency = random.uniform(0.05, 0.15)
        if i == 2:
            latency = 0.5
        streams.append(latency)

    # QUIC: each stream independent, packet loss on stream 2 only delays stream 2
    total = max(streams)
    print(f"  Stream latencies: {[f'{s:.3f}s' for s in streams]}")
    print(f"  Total time (no HoL): {total:.3f}s\n")
    return total


def main():
    t1 = simulate_http11()
    t2 = simulate_http2()
    t3 = simulate_http3()
    print("Summary:")
    print(f"  HTTP/1.1: {t1:.3f}s")
    print(f"  HTTP/2:   {t2:.3f}s")
    print(f"  HTTP/3:   {t3:.3f}s")


if __name__ == "__main__":
    main()
