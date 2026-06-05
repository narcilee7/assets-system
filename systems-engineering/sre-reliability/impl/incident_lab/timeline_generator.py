#!/usr/bin/env python3
"""
Incident timeline simulator for drill practice.
Run: python3 timeline_generator.py
"""

from datetime import datetime, timedelta
import random


def generate_drill():
    base = datetime(2024, 6, 1, 14, 0, 0)
    events = [
        (base + timedelta(minutes=0),  "DEPLOY",     "Deployment v2.3.0 rolled out to 50%"),
        (base + timedelta(minutes=5),  "METRIC",     "Error rate increased from 0.1% to 5%"),
        (base + timedelta(minutes=8),  "ALERT",      "PagerDuty triggered: P1 - API error rate high"),
        (base + timedelta(minutes=12), "RESPONSE",   "On-call engineer acknowledged"),
        (base + timedelta(minutes=18), "TRIAGE",     "Identified new feature X as culprit"),
        (base + timedelta(minutes=22), "MITIGATION", "Feature flag 'new-x' turned OFF"),
        (base + timedelta(minutes=25), "METRIC",     "Error rate dropped to 0.2%"),
        (base + timedelta(minutes=35), "RESOLUTION", "Rollback to v2.2.9 completed"),
        (base + timedelta(minutes=40), "COMM",       "Status page updated: All clear"),
        (base + timedelta(minutes=120),"POSTMORTEM", "Scheduled postmortem for next day"),
    ]

    # Randomly drop one event to simulate incomplete logging
    if random.random() < 0.3:
        events.pop(random.randint(2, 5))

    print("=== Simulated Incident Timeline ===\n")
    for t, tag, desc in events:
        print(f"{t.strftime('%H:%M')}  [{tag:12}]  {desc}")

    print("\n=== Practice Questions ===")
    print("1. What is the MTTD (Mean Time To Detect)?")
    print("2. What is the MTTR (Mean Time To Recover)?")
    print("3. What was the first mitigation action?")
    print("4. What action items would you add?")

    # Answers
    detected = events[2][0]
    resolved = events[7][0] if len(events) > 7 else events[-2][0]
    mttr = (resolved - detected).total_seconds() / 60
    print(f"\n(Answer: MTTR ≈ {mttr:.0f} minutes from alert to resolution)")


if __name__ == "__main__":
    generate_drill()
