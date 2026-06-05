#!/usr/bin/env python3
"""Burn rate simulator with multi-window alerts.
Run: python3 burn_rate_simulator.py --requests 100000 --error-rate 0.005"""
import argparse
import random


def simulate_requests(total: int, error_rate: float) -> list:
    """Return list of 0=success, 1=error."""
    return [1 if random.random() < error_rate else 0 for _ in range(total)]


def burn_rate(errors: int, total: int, slo_pct: float) -> float:
    allowed_error_rate = (100 - slo_pct) / 100
    actual_error_rate = errors / total if total else 0
    if allowed_error_rate == 0:
        return float('inf')
    return actual_error_rate / allowed_error_rate


def window_burn_rate(log: list, window_size: int, slo_pct: float) -> list:
    """Sliding window burn rates."""
    rates = []
    for i in range(window_size, len(log) + 1):
        chunk = log[i - window_size:i]
        rates.append(burn_rate(sum(chunk), len(chunk), slo_pct))
    return rates


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--requests", type=int, default=100_000)
    parser.add_argument("--error-rate", type=float, default=0.005)
    parser.add_argument("--slo", type=float, default=99.9)
    args = parser.parse_args()

    log = simulate_requests(args.requests, args.error_rate)
    slo = args.slo
    allowed = (100 - slo) / 100

    print(f"Simulated {args.requests} requests @ {args.error_rate*100:.2f}% error rate")
    print(f"SLO = {slo}% (allowed error rate = {allowed*100:.3f}%)")
    print("-" * 60)

    # Multi-window multi-burn-rate (Google SRE style)
    configs = [
        ("Fast burn (1h window,  burn rate > 14.4)", 1000, 14.4),
        ("Slow burn (6h window,  burn rate > 2)", 6000, 2.0),
        ("Very slow (3d window,  burn rate > 1)", 30000, 1.0),
    ]

    for label, size, threshold in configs:
        if size > len(log):
            continue
        rates = window_burn_rate(log, size, slo)
        alerts = sum(1 for r in rates if r > threshold)
        max_rate = max(rates) if rates else 0
        print(f"{label}: max burn rate = {max_rate:.2f}x | alerts triggered = {alerts}")

    # Budget remaining after simulation
    total_errors = sum(log)
    budget_total = args.requests * allowed
    remaining = budget_total - total_errors
    print("-" * 60)
    print(f"Total errors: {total_errors} | Budget: {budget_total:.0f} | Remaining: {remaining:.0f}")
    if remaining < 0:
        print("WARNING: Error budget EXHAUSTED!")
    else:
        print(f"Budget remaining: {remaining/budget_total*100:.1f}%")


if __name__ == "__main__":
    main()
