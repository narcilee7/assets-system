#!/usr/bin/env python3
"""
Copy-on-Write demo using mmap + fork.
Run on Linux: python3 cow_demo.py
"""

import mmap
import os
import time


def read_private_dirty(pid: int) -> int:
    """Read Private_Dirty from /proc/<pid>/smaps for the first mmap region."""
    try:
        with open(f"/proc/{pid}/smaps", "r") as f:
            dirty = 0
            in_region = False
            for line in f:
                if line.startswith("7") or line.startswith("6") or line.startswith("5"):
                    in_region = True
                if in_region and line.startswith("Private_Dirty:"):
                    parts = line.split()
                    dirty = int(parts[1])  # kB
                    break
            return dirty
    except FileNotFoundError:
        return -1


def main():
    # Create a shared anonymous mapping
    size = 4096  # one page
    mm = mmap.mmap(-1, size, mmap.MAP_SHARED | mmap.MAP_ANONYMOUS)
    mm.write(b"A" * size)

    parent_pid = os.getpid()
    print(f"[Parent {parent_pid}] Before fork: Private_Dirty ≈ {read_private_dirty(parent_pid)} kB")

    pid = os.fork()
    if pid == 0:
        # Child
        time.sleep(0.1)
        child_pid = os.getpid()
        print(f"[Child  {child_pid}] After fork, before write: Private_Dirty ≈ {read_private_dirty(child_pid)} kB")
        mm.seek(0)
        mm.write(b"B" * size)  # trigger COW
        print(f"[Child  {child_pid}] After write:          Private_Dirty ≈ {read_private_dirty(child_pid)} kB")
        os._exit(0)
    else:
        os.waitpid(pid, 0)
        print(f"[Parent {parent_pid}] After child wrote:      Private_Dirty ≈ {read_private_dirty(parent_pid)} kB")
        mm.close()


if __name__ == "__main__":
    main()
