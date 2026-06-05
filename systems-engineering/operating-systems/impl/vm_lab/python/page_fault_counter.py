#!/usr/bin/env python3
"""
Page fault counter demo.
Run on Linux: python3 page_fault_counter.py
"""

import os


def get_faults() -> tuple:
    """Return (minflt, majflt) from /proc/self/stat."""
    with open("/proc/self/stat", "r") as f:
        parts = f.read().split()
        # Field 10 = minflt, Field 12 = majflt (man proc)
        return int(parts[9]), int(parts[11])


def main():
    minflt_before, majflt_before = get_faults()
    print(f"Before allocation: minflt={minflt_before} majflt={majflt_before}")

    # Allocate 100MB but do not touch
    arr = bytearray(100 * 1024 * 1024)
    minflt_after_alloc, majflt_after_alloc = get_faults()
    print(f"After allocation (no touch): minflt={minflt_after_alloc}(+{minflt_after_alloc - minflt_before}) majflt={majflt_after_alloc}")

    # Touch every page
    for i in range(0, len(arr), 4096):
        arr[i] = 1

    minflt_after_touch, majflt_after_touch = get_faults()
    print(f"After touch: minflt={minflt_after_touch}(+{minflt_after_touch - minflt_after_alloc}) majflt={majflt_after_touch}")
    print(f"Expected ≈ {len(arr) // 4096} minor faults for touching every page")


if __name__ == "__main__":
    main()
