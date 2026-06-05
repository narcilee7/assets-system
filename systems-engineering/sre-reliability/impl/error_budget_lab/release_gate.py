#!/usr/bin/env python3
"""Release gate decision based on remaining error budget.
Run: python3 release_gate.py --slo 99.9 --budget-remaining 0.25"""
import argparse


def decide(slo: float, remaining_ratio: float) -> dict:
    if remaining_ratio > 0.5:
        action = "ALLOW"
        note = "Budget healthy, normal release pace"
    elif remaining_ratio > 0.3:
        action = "REVIEW"
        note = "Budget tightening, require SRE review"
    elif remaining_ratio > 0.1:
        action = "APPROVAL"
        note = "Budget low, require manager approval"
    else:
        action = "BLOCK"
        note = "Budget exhausted or critical, freeze non-urgent releases"
    return {"action": action, "note": note}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--slo", type=float, default=99.9)
    parser.add_argument("--budget-remaining", type=float, required=True,
                        help="Remaining budget ratio, e.g. 0.25 for 25%")
    args = parser.parse_args()

    result = decide(args.slo, args.budget_remaining)
    print(f"SLO: {args.slo}% | Remaining budget: {args.budget_remaining*100:.1f}%")
    print(f"Release decision: {result['action']}")
    print(f"Reason: {result['note']}")


if __name__ == "__main__":
    main()
