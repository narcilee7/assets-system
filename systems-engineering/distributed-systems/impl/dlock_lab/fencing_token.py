#!/usr/bin/env python3
"""Demonstrate fencing token preventing delayed writes.
Run: python3 fencing_token.py --delay 2"""
import argparse
import time


class Storage:
    def __init__(self):
        self.data = "initial"
        self.max_token = 0

    def write(self, value: str, token: int) -> bool:
        if token < self.max_token:
            print(f"  [REJECT] token={token} < current max_token={self.max_token}")
            return False
        self.max_token = token
        self.data = value
        print(f"  [ACCEPT] token={token} -> data='{value}'")
        return True

    def read(self) -> str:
        return self.data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--delay", type=float, default=2, help="Simulated network delay for old write")
    args = parser.parse_args()

    store = Storage()
    print("Storage with fencing token enforcement")
    print("-" * 50)

    # Client A gets lock, token=1
    token_a = 1
    print(f"Client A gets lock, token={token_a}")
    print("Client A prepares write('A') but delayed...")

    # Client B gets lock after A's lock expires, token=2
    token_b = 2
    print(f"Client B gets lock, token={token_b}")
    store.write("B", token_b)

    # A's delayed write arrives
    print(f"After {args.delay}s, Client A's delayed write arrives...")
    time.sleep(args.delay)
    store.write("A", token_a)

    print("-" * 50)
    print(f"Final data: '{store.read()}'")
    print("Without fencing token, delayed write from A would overwrite B's data.")


if __name__ == "__main__":
    main()
