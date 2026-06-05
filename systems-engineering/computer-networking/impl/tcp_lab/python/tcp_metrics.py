#!/usr/bin/env python3
"""
TCP metrics collector on Linux.
Reads /proc/net/snmp and /proc/net/tcp to compute retransmit rate, TIME_WAIT count.
"""

import os
import re


def parse_snmp():
    """Return TCP OutSegs and RetransSegs from /proc/net/snmp."""
    if not os.path.exists("/proc/net/snmp"):
        print("This script requires Linux /proc")
        return None, None
    with open("/proc/net/snmp", "r") as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        if line.startswith("Tcp:"):
            header = lines[i].strip().split()
            values = lines[i + 1].strip().split()
            data = dict(zip(header, values))
            return int(data.get("OutSegs", 0)), int(data.get("RetransSegs", 0))
    return None, None


def count_time_wait():
    count = 0
    if not os.path.exists("/proc/net/tcp"):
        return -1
    with open("/proc/net/tcp", "r") as f:
        for line in f.readlines()[1:]:
            parts = line.split()
            if len(parts) > 3:
                st = parts[3]
                if st == "06":  # TCP_TIME_WAIT
                    count += 1
    return count


def main():
    out_segs, retrans = parse_snmp()
    tw = count_time_wait()

    print("=== TCP Metrics ===")
    if out_segs is not None:
        rate = (retrans / out_segs * 100) if out_segs > 0 else 0.0
        print(f"OutSegs:      {out_segs}")
        print(f"RetransSegs:  {retrans}")
        print(f"Retrans rate: {rate:.4f}%")
    else:
        print("Failed to parse /proc/net/snmp")

    if tw >= 0:
        print(f"TIME_WAIT:    {tw}")
        if tw > 10000:
            print("  WARNING: high TIME_WAIT count, consider tcp_tw_reuse")
    else:
        print("Failed to parse /proc/net/tcp")


if __name__ == "__main__":
    main()
