#!/usr/bin/env python3
"""
Simplified WAL + Checkpoint simulator.
Run: python3 wal_simulator.py
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class LogRecord:
    lsn: int
    page_id: int
    old_val: int
    new_val: int
    committed: bool = False


class WALSimulator:
    def __init__(self):
        self.log_buffer: List[LogRecord] = []
        self.log_file: List[LogRecord] = []
        self.data_pages: dict = {}  # page_id -> value
        self.lsn_counter = 0
        self.checkpoint_lsn = 0
        self.active_trx: set = set()

    def begin(self, trx_id: int):
        self.active_trx.add(trx_id)

    def write(self, trx_id: int, page_id: int, old_val: int, new_val: int):
        self.lsn_counter += 1
        rec = LogRecord(lsn=self.lsn_counter, page_id=page_id,
                        old_val=old_val, new_val=new_val)
        self.log_buffer.append(rec)
        return rec.lsn

    def commit(self, trx_id: int, lsn: int):
        # flush log buffer to disk (fsync)
        self.log_file.extend(self.log_buffer)
        for rec in self.log_buffer:
            if rec.lsn <= lsn:
                rec.committed = True
        self.log_buffer.clear()
        self.active_trx.discard(trx_id)

    def modify_page(self, page_id: int, new_val: int):
        # simulate in-memory dirty page
        self.data_pages[page_id] = new_val

    def checkpoint(self):
        # flush dirty pages to disk (simplified: just record checkpoint)
        # In reality, we would fsync data pages here.
        if self.log_file:
            self.checkpoint_lsn = max(r.lsn for r in self.log_file if r.committed)
        print(f"CHECKPOINT at LSN={self.checkpoint_lsn}")

    def crash(self) -> List[LogRecord]:
        # lose in-memory state
        lost_pages = dict(self.data_pages)
        self.data_pages.clear()
        self.log_buffer.clear()
        self.active_trx.clear()
        print(f"CRASH! Data pages lost: {lost_pages}")
        return self.log_file

    def recover(self, log: List[LogRecord]):
        print(f"RECOVER from checkpoint LSN={self.checkpoint_lsn}")
        for rec in log:
            if rec.lsn > self.checkpoint_lsn and rec.committed:
                self.data_pages[rec.page_id] = rec.new_val
                print(f"  REDO page {rec.page_id} = {rec.new_val} (LSN {rec.lsn})")

    def status(self):
        print(f"  Log records on disk: {len(self.log_file)}")
        print(f"  Checkpoint LSN: {self.checkpoint_lsn}")
        print(f"  Data pages in memory: {self.data_pages}")


def demo():
    db = WALSimulator()
    db.begin(1)
    lsn1 = db.write(1, page_id=5, old_val=0, new_val=100)
    db.commit(1, lsn1)
    db.modify_page(5, 100)

    db.begin(2)
    lsn2 = db.write(2, page_id=5, old_val=100, new_val=200)
    db.commit(2, lsn2)
    db.modify_page(5, 200)

    print("Before checkpoint:")
    db.status()

    db.checkpoint()

    db.begin(3)
    lsn3 = db.write(3, page_id=5, old_val=200, new_val=300)
    db.commit(3, lsn3)
    db.modify_page(5, 300)

    print("\nBefore crash:")
    db.status()

    log = db.crash()
    db.recover(log)

    print("\nAfter recovery:")
    db.status()


if __name__ == "__main__":
    demo()
